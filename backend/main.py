import asyncio
import json
import os
from datetime import date
from typing import List, Optional

from celery import chain as celery_chain
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import redis.asyncio as aioredis

from backend.alpaca_client import close_position as alpaca_close_position, submit_order
from backend.db import get_latest_results, get_open_positions, get_scouting_log, get_trade_log_by_id
from backend.review_task import review_all_positions
from backend.scout_task import scout_tickers
from backend.tasks import analyze_and_trade

# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: str = Field(example="ok")


class TradeLog(BaseModel):
    id: str
    ticker: str
    analysis_date: str
    rating: Optional[str] = Field(None, example="Buy", description="Buy | Overweight | Hold | Underweight | Sell")
    model_used: str
    alpaca_order_id: Optional[str] = None
    execution_status: str = Field(example="executed", description="executed | skipped | failed | pending")
    created_at: str


class TradeLogDetail(TradeLog):
    reasoning: Optional[str] = Field(None, description="Portfolio Manager's raw decision text")
    raw_report: Optional[dict] = Field(None, description="Structured report data")


class PortfolioPosition(BaseModel):
    id: str
    ticker: str
    direction: str = Field(example="long", description="long | short")
    entry_rating: str = Field(example="Buy")
    entry_date: str
    entry_order_id: Optional[str] = None
    exit_order_id: Optional[str] = None
    exit_date: Optional[str] = None
    exit_rating: Optional[str] = None
    status: str = Field(example="open", description="open | closed")
    last_reviewed_at: Optional[str] = None
    created_at: str


class TaskQueued(BaseModel):
    task_id: str
    ticker: str
    analysis_date: str
    paid: bool
    status: str = Field(example="queued")


class SequenceQueued(BaseModel):
    chain_id: str
    tickers: List[str]
    analysis_date: str
    paid: bool
    status: str = Field(example="chained — running sequentially")


class ReviewDispatched(BaseModel):
    task_id: str
    open_positions: int
    tickers: List[str]
    status: str = Field(example="dispatched")


class ScoutDispatched(BaseModel):
    task_id: str
    paid: bool
    max_picks: int
    min_conviction: int
    status: str = Field(example="scouting")


class ScoutLogEntry(BaseModel):
    id: str
    scout_date: str
    macro_context: Optional[str] = None
    tickers_json: list
    model_used: str
    created_at: str


class TradeOrder(BaseModel):
    order_id: Optional[str] = None
    ticker: str
    side: str = Field(description="buy | sell | close")
    notional: Optional[float] = Field(None, description="USD notional (None for close)")
    alpaca_status: str = Field(description="Alpaca order status or 'no_position'")


class ErrorResponse(BaseModel):
    error: str


# ---------------------------------------------------------------------------
# App + tags metadata
# ---------------------------------------------------------------------------

_TAGS = [
    {
        "name": "health",
        "description": "Service liveness check.",
    },
    {
        "name": "analysis",
        "description": (
            "Trigger multi-agent stock analysis via OpenRouter LLMs. "
            "Tasks run on Celery workers and results are stored in Supabase. "
            "Use `paid=true` to use **deepseek/deepseek-v4-flash** as the primary model "
            "instead of the free-tier ladder."
        ),
    },
    {
        "name": "results",
        "description": "Read analysis logs stored in the `trading_logs` Supabase table.",
    },
    {
        "name": "portfolio",
        "description": (
            "Portfolio position management. Positions are opened automatically "
            "when a Buy/Sell trade executes. Reviews run on a Beat schedule "
            "(12:00 PM ET and 3:30 PM ET Mon–Fri) and exit positions when the signal flips."
        ),
    },
    {
        "name": "trading",
        "description": (
            "Direct manual Alpaca paper-trading actions. "
            "Use **buy** / **sell** for notional market orders, or **close** to fully exit an open position."
        ),
    },
    {
        "name": "realtime",
        "description": (
            "WebSocket endpoint for real-time task completion events. "
            "Connect to `/ws` to receive `task_complete` events as Celery tasks finish."
        ),
    },
]

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

app = FastAPI(
    title="TradingAgents API",
    version="1.0.0",
    description=(
        "Automated multi-agent trading platform built on the **TradingAgents** framework.\n\n"
        "### Architecture\n"
        "- **LLM provider**: OpenRouter (free-tier model ladder + optional paid model)\n"
        "- **Agent graph**: 4 analysts → researchers → trader → risk team → portfolio manager\n"
        "- **Parallelism**: analysts run concurrently to cut wall-clock time ~4×\n"
        "- **Broker**: Celery + Redis\n"
        "- **Storage**: Supabase (PostgreSQL)\n"
        "- **Trading**: Alpaca Paper Trading API\n\n"
        "### Model ladder (free tier)\n"
        "```\n"
        "google/gemma-4-31b-it:free → google/gemma-4-26b-a4b-it:free\n"
        "→ minimax/minimax-m2.5:free → nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free\n"
        "→ openrouter/owl-alpha → deepseek/deepseek-v3.2\n"
        "```\n"
        "With `paid=true`: **deepseek/deepseek-chat** leads, free models are the fallback.\n\n"
        "### Retry strategy\n"
        "429 / 404 / 502 / 503 / 524 → switch model (15 s gap). "
        "After full cycle → exponential backoff (60 → 120 → 240 s)."
    ),
    openapi_tags=_TAGS,
    contact={"name": "Carlos Gumucio", "email": "cgumucio93@gmail.com"},
    license_info={"name": "Private"},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("BACKEND_CORS_ORIGIN", "http://localhost:4321"), "*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get(
    "/health",
    tags=["health"],
    response_model=HealthResponse,
    summary="Health check",
)
async def health():
    return {"status": "ok"}


@app.get(
    "/results",
    tags=["results"],
    response_model=List[TradeLog],
    summary="Latest analysis results",
    description="Returns the most recent rows from `trading_logs`, newest first.",
)
async def results(
    limit: int = Query(default=50, ge=1, le=200, description="Number of rows to return (max 200)"),
):
    return get_latest_results(limit=limit)


@app.get(
    "/results/{log_id}",
    tags=["results"],
    response_model=TradeLogDetail,
    summary="Full analysis detail",
    description="Returns a single `trading_logs` row including `reasoning` and `raw_report`.",
)
async def result_detail(log_id: str):
    record = get_trade_log_by_id(log_id)
    if not record:
        raise HTTPException(status_code=404, detail="Log entry not found")
    return record


@app.post(
    "/test-task/{ticker}",
    tags=["analysis"],
    response_model=TaskQueued,
    summary="Trigger single-ticker analysis",
    description=(
        "Enqueues one `analyze_and_trade` Celery task for the given ticker. "
        "Use for smoke-testing a single symbol before running a full sequence."
    ),
)
async def test_task(
    ticker: str,
    analysis_date: Optional[str] = Query(None, example="2026-05-01", description="ISO date (defaults to today)"),
    paid: bool = Query(False, description="Use deepseek/deepseek-chat as primary model"),
):
    ad = analysis_date or str(date.today())
    task = analyze_and_trade.delay(ticker.upper(), ad, paid=paid)
    return {"task_id": task.id, "ticker": ticker.upper(), "analysis_date": ad, "paid": paid, "status": "queued"}


@app.post(
    "/run-sequence",
    tags=["analysis"],
    response_model=SequenceQueued,
    summary="Run a ticker list sequentially",
    description=(
        "Builds a Celery chain so each ticker's analysis starts **only after** the previous one "
        "completes. This prevents concurrent free-tier rate-limit collisions.\n\n"
        "```bash\n"
        "# Free tier\n"
        'curl -X POST http://localhost:8000/run-sequence \\\n'
        '     -H "Content-Type: application/json" \\\n'
        "     -d '[\"VST\", \"LLY\", \"NVDA\"]'\n\n"
        "# Paid (deepseek-v4-flash first)\n"
        'curl -X POST "http://localhost:8000/run-sequence?paid=true" \\\n'
        '     -H "Content-Type: application/json" \\\n'
        "     -d '[\"VST\", \"LLY\", \"NVDA\"]'\n"
        "```"
    ),
)
async def run_sequence(
    tickers: List[str],
    analysis_date: Optional[str] = Query(None, description="ISO date (defaults to today)"),
    paid: bool = Query(False, description="Use deepseek/deepseek-chat as primary model"),
):
    if not tickers:
        return {"error": "tickers list is empty"}
    ad = analysis_date or str(date.today())
    cleaned = [t.upper() for t in tickers]
    steps = celery_chain(*[
        analyze_and_trade.si(t, ad, _seq_pos=i, _seq_tickers=cleaned, paid=paid)
        for i, t in enumerate(cleaned)
    ])
    result = steps.delay()
    return {"chain_id": result.id, "tickers": cleaned, "analysis_date": ad,
            "paid": paid, "status": "chained — running sequentially"}


@app.get(
    "/positions",
    tags=["portfolio"],
    response_model=List[PortfolioPosition],
    summary="List open positions",
    description="Returns all portfolio positions with `status = open`.",
)
async def positions():
    return get_open_positions()


@app.post(
    "/review-positions",
    tags=["portfolio"],
    response_model=ReviewDispatched,
    summary="Trigger position review",
    description=(
        "Manually dispatches a lightweight review (market + fundamentals analysts only) "
        "for every open position. Exits a position if the new rating flips the signal.\n\n"
        "This also runs automatically on a Beat schedule: **12:00 PM ET** and **3:30 PM ET**, Mon–Fri."
    ),
)
async def trigger_review(
    paid: bool = Query(False, description="Use deepseek/deepseek-chat for reviews"),
):
    task = review_all_positions.delay(paid=paid)
    open_pos = get_open_positions()
    return {"task_id": task.id, "open_positions": len(open_pos),
            "tickers": [p["ticker"] for p in open_pos], "status": "dispatched"}


@app.post(
    "/scout",
    tags=["analysis"],
    response_model=ScoutDispatched,
    summary="Trigger autonomous scout",
    description=(
        "Runs the macro-to-micro scout: fetches sector ETF performance and macro news, "
        "asks the LLM to reason macro → sector → tickers, then queues the top picks "
        "for full analysis. Also runs automatically at **9:00 AM ET** Mon–Fri.\n\n"
        "```bash\n"
        "curl -X POST http://localhost:8000/scout\n"
        "curl -X POST 'http://localhost:8000/scout?paid=true&max_picks=3'\n"
        "```"
    ),
)
async def trigger_scout(
    paid: bool = Query(True, description="Use deepseek/deepseek-v4-flash as primary model"),
    max_picks: int = Query(5, ge=1, le=10, description="Maximum tickers to queue"),
    min_conviction: Optional[int] = Query(None, ge=1, le=5, description="Override min conviction (derived from risk_level if omitted)"),
    risk_level: str = Query("moderate", description="conservative | moderate | aggressive"),
    focus_sectors: List[str] = Query(default=[], description="Limit to specific sectors (empty = all)"),
    time_horizon: str = Query("medium", description="short | medium | long"),
    style: str = Query("any", description="any | growth | value | momentum | quality"),
):
    _risk_conviction = {"conservative": 4, "moderate": 3, "aggressive": 2}
    resolved_conviction = min_conviction if min_conviction is not None else _risk_conviction.get(risk_level, 3)
    task = scout_tickers.delay(
        paid=paid,
        max_picks=max_picks,
        min_conviction=min_conviction,
        risk_level=risk_level,
        focus_sectors=focus_sectors or None,
        time_horizon=time_horizon,
        style=style,
    )
    return {
        "task_id": task.id,
        "paid": paid,
        "max_picks": max_picks,
        "min_conviction": resolved_conviction,
        "status": "scouting",
    }


@app.get(
    "/scout-history",
    tags=["results"],
    response_model=List[ScoutLogEntry],
    summary="Recent scout results",
    description="Returns the most recent rows from `scouting_log`, newest first.",
)
async def scout_history(
    limit: int = Query(default=20, ge=1, le=100, description="Number of rows to return"),
):
    return get_scouting_log(limit=limit)


@app.post(
    "/trade/{ticker}",
    tags=["trading"],
    response_model=TradeOrder,
    summary="Manual Alpaca order",
    description=(
        "Submit a direct market order to Alpaca paper trading.\n\n"
        "- `side=buy` — notional market buy (fractional shares)\n"
        "- `side=sell` — notional market sell / open short\n"
        "- `side=close` — fully exit the existing position (uses Alpaca's close-position endpoint "
        "to avoid fractional-share rounding issues)\n\n"
        "```bash\n"
        "curl -X POST 'http://localhost:8000/trade/NVDA?side=buy&notional=200'\n"
        "curl -X POST 'http://localhost:8000/trade/NVDA?side=close'\n"
        "```"
    ),
)
async def manual_trade(
    ticker: str,
    side: str = Query(..., description="buy | sell | close"),
    notional: float = Query(100.0, ge=1.0, description="USD notional (ignored for close)"),
):
    ticker = ticker.upper()
    if side not in ("buy", "sell", "close"):
        raise HTTPException(status_code=400, detail=f"Invalid side '{side}'. Must be buy, sell, or close.")

    try:
        if side == "close":
            order = alpaca_close_position(ticker)
            if order is None:
                return TradeOrder(
                    order_id=None, ticker=ticker, side=side,
                    notional=None, alpaca_status="no_position",
                )
            return TradeOrder(
                order_id=str(order.id), ticker=ticker, side=side,
                notional=None, alpaca_status=str(order.status),
            )
        else:
            order = submit_order(ticker, side=side, notional=notional)
            return TradeOrder(
                order_id=str(order.id) if order else None,
                ticker=ticker,
                side=side,
                notional=notional,
                alpaca_status=str(order.status) if order else "failed",
            )
    except Exception as exc:
        detail = str(exc)
        # Alpaca wash-trade rejection (40310000) → 409 Conflict
        if "40310000" in detail or "wash trade" in detail.lower():
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Alpaca rejected the order: potential wash trade detected "
                    f"(an opposite-side order for {ticker} is already open). "
                    f"To exit a long position use side=close instead of side=sell. "
                    f"Raw: {detail}"
                ),
            )
        raise HTTPException(status_code=502, detail=detail)


# ---------------------------------------------------------------------------
# WebSocket — real-time task events
# ---------------------------------------------------------------------------

@app.get(
    "/ws",
    tags=["realtime"],
    summary="Real-time task events (WebSocket)",
    description=(
        "WebSocket endpoint. Connect to receive `task_complete` events whenever a "
        "Celery task finishes. An initial `{\"type\": \"connected\"}` message is sent "
        "on handshake. Events follow the agreed payload shape:\n\n"
        "```json\n"
        "{\"type\": \"task_complete\", \"kind\": \"analysis\", \"ticker\": \"NVDA\", "
        "\"tickers\": null, \"status\": \"executed\", \"task_id\": \"abc-123\"}\n"
        "```"
    ),
)
async def websocket_events(websocket: WebSocket):
    await websocket.accept()
    r: aioredis.Redis = aioredis.from_url(REDIS_URL)
    pubsub = r.pubsub()
    await pubsub.subscribe("task_events")
    try:
        await websocket.send_text(json.dumps({"type": "connected"}))
        async for message in pubsub.listen():
            if message["type"] == "message":
                await websocket.send_text(message["data"])
    except (WebSocketDisconnect, asyncio.CancelledError):
        pass
    finally:
        await pubsub.unsubscribe("task_events")
        await r.aclose()
