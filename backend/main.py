import asyncio
import json
import os
from datetime import date
from typing import List, Optional

import stripe as stripe_lib
from celery import chain as celery_chain
from fastapi import Depends, FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import redis.asyncio as aioredis

from backend.alpaca_client import close_position as alpaca_close_position, submit_order
from backend.auth import get_current_user
from backend.db import (
    credit_user,
    get_credit_balance,
    get_credit_transactions,
    get_latest_results,
    get_open_positions,
    get_scouting_log,
    get_trade_log_by_id,
    get_user_settings,
    upsert_user_settings,
)
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
    rating: Optional[str] = Field(None, example="Buy")
    model_used: str
    alpaca_order_id: Optional[str] = None
    execution_status: str = Field(example="executed")
    created_at: str


class TradeLogDetail(TradeLog):
    reasoning: Optional[str] = None
    raw_report: Optional[dict] = None


class PortfolioPosition(BaseModel):
    id: str
    ticker: str
    direction: str
    entry_rating: str
    entry_date: str
    entry_order_id: Optional[str] = None
    exit_order_id: Optional[str] = None
    exit_date: Optional[str] = None
    exit_rating: Optional[str] = None
    status: str
    last_reviewed_at: Optional[str] = None
    created_at: str


class TaskQueued(BaseModel):
    task_id: str
    ticker: str
    analysis_date: str
    paid: bool
    status: str


class SequenceQueued(BaseModel):
    chain_id: str
    tickers: List[str]
    analysis_date: str
    paid: bool
    status: str


class ReviewDispatched(BaseModel):
    task_id: str
    open_positions: int
    tickers: List[str]
    status: str


class ScoutDispatched(BaseModel):
    task_id: str
    paid: bool
    max_picks: int
    min_conviction: int
    status: str


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
    side: str
    notional: Optional[float] = None
    alpaca_status: str


class CreditBalance(BaseModel):
    balance: int
    transactions: list


class CheckoutSession(BaseModel):
    url: str


class BillingPortal(BaseModel):
    url: str


class AlpacaSettings(BaseModel):
    api_key: str = Field(..., min_length=1)
    api_secret: str = Field(..., min_length=1)
    paper: bool = True


class AlpacaSettingsSaved(BaseModel):
    status: str


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

_TAGS = [
    {"name": "health", "description": "Service liveness check."},
    {"name": "analysis", "description": "Trigger multi-agent stock analysis."},
    {"name": "results", "description": "Read analysis logs."},
    {"name": "portfolio", "description": "Portfolio position management."},
    {"name": "trading", "description": "Direct manual Alpaca paper-trading actions."},
    {"name": "credits", "description": "Credit balance and billing."},
    {"name": "settings", "description": "User configuration and Alpaca keys."},
    {"name": "realtime", "description": "WebSocket real-time task events."},
]

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

app = FastAPI(
    title="TradingAgents API",
    version="2.0.0",
    description=(
        "Automated multi-agent trading platform — multi-tenant SaaS edition.\n\n"
        "All endpoints except `/health`, `/ws`, and `/webhooks/stripe` require "
        "a Supabase JWT in the `Authorization: Bearer <token>` header."
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
# Health (public)
# ---------------------------------------------------------------------------

@app.get("/health", tags=["health"], response_model=HealthResponse)
async def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Analysis
# ---------------------------------------------------------------------------

@app.post("/test-task/{ticker}", tags=["analysis"], response_model=TaskQueued)
async def test_task(
    ticker: str,
    analysis_date: Optional[str] = Query(None, example="2026-05-01"),
    paid: bool = Query(False),
    user_id: str = Depends(get_current_user),
):
    ad = analysis_date or str(date.today())
    task = analyze_and_trade.delay(ticker.upper(), ad, paid=paid, user_id=user_id)
    return {"task_id": task.id, "ticker": ticker.upper(), "analysis_date": ad, "paid": paid, "status": "queued"}


@app.post("/run-sequence", tags=["analysis"], response_model=SequenceQueued)
async def run_sequence(
    tickers: List[str],
    analysis_date: Optional[str] = Query(None),
    paid: bool = Query(False),
    user_id: str = Depends(get_current_user),
):
    if not tickers:
        raise HTTPException(status_code=400, detail="tickers list is empty")
    ad = analysis_date or str(date.today())
    cleaned = [t.upper() for t in tickers]
    steps = celery_chain(*[
        analyze_and_trade.si(t, ad, _seq_pos=i, _seq_tickers=cleaned, paid=paid, user_id=user_id)
        for i, t in enumerate(cleaned)
    ])
    result = steps.delay()
    return {"chain_id": result.id, "tickers": cleaned, "analysis_date": ad,
            "paid": paid, "status": "chained — running sequentially"}


# ---------------------------------------------------------------------------
# Results
# ---------------------------------------------------------------------------

@app.get("/results", tags=["results"], response_model=List[TradeLog])
async def results(
    limit: int = Query(default=50, ge=1, le=200),
    user_id: str = Depends(get_current_user),
):
    return get_latest_results(limit=limit, user_id=user_id)


@app.get("/results/{log_id}", tags=["results"], response_model=TradeLogDetail)
async def result_detail(log_id: str, user_id: str = Depends(get_current_user)):
    record = get_trade_log_by_id(log_id, user_id=user_id)
    if not record:
        raise HTTPException(status_code=404, detail="Log entry not found")
    return record


# ---------------------------------------------------------------------------
# Portfolio
# ---------------------------------------------------------------------------

@app.get("/positions", tags=["portfolio"], response_model=List[PortfolioPosition])
async def positions(user_id: str = Depends(get_current_user)):
    return get_open_positions(user_id=user_id)


@app.post("/review-positions", tags=["portfolio"], response_model=ReviewDispatched)
async def trigger_review(
    paid: bool = Query(False),
    user_id: str = Depends(get_current_user),
):
    task = review_all_positions.delay(paid=paid)
    open_pos = get_open_positions(user_id=user_id)
    return {"task_id": task.id, "open_positions": len(open_pos),
            "tickers": [p["ticker"] for p in open_pos], "status": "dispatched"}


# ---------------------------------------------------------------------------
# Scout
# ---------------------------------------------------------------------------

@app.post("/scout", tags=["analysis"], response_model=ScoutDispatched)
async def trigger_scout(
    paid: bool = Query(True),
    max_picks: int = Query(5, ge=1, le=10),
    min_conviction: Optional[int] = Query(None, ge=1, le=5),
    risk_level: str = Query("moderate"),
    focus_sectors: List[str] = Query(default=[]),
    time_horizon: str = Query("medium"),
    style: str = Query("any"),
    user_id: str = Depends(get_current_user),
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
    return {"task_id": task.id, "paid": paid, "max_picks": max_picks,
            "min_conviction": resolved_conviction, "status": "scouting"}


@app.get("/scout-history", tags=["results"], response_model=List[ScoutLogEntry])
async def scout_history(
    limit: int = Query(default=20, ge=1, le=100),
    user_id: str = Depends(get_current_user),
):
    return get_scouting_log(limit=limit, user_id=user_id)


# ---------------------------------------------------------------------------
# Manual trading
# ---------------------------------------------------------------------------

@app.post("/trade/{ticker}", tags=["trading"], response_model=TradeOrder)
async def manual_trade(
    ticker: str,
    side: str = Query(..., description="buy | sell | close"),
    notional: float = Query(100.0, ge=1.0),
    user_id: str = Depends(get_current_user),
):
    ticker = ticker.upper()
    if side not in ("buy", "sell", "close"):
        raise HTTPException(status_code=400, detail=f"Invalid side '{side}'.")

    try:
        if side == "close":
            order = alpaca_close_position(ticker)
            if order is None:
                return TradeOrder(order_id=None, ticker=ticker, side=side,
                                  notional=None, alpaca_status="no_position")
            return TradeOrder(order_id=str(order.id), ticker=ticker, side=side,
                              notional=None, alpaca_status=str(order.status))
        else:
            order = submit_order(ticker, side=side, notional=notional)
            return TradeOrder(
                order_id=str(order.id) if order else None,
                ticker=ticker, side=side, notional=notional,
                alpaca_status=str(order.status) if order else "failed",
            )
    except Exception as exc:
        detail = str(exc)
        if "40310000" in detail or "wash trade" in detail.lower():
            raise HTTPException(status_code=409, detail=(
                f"Alpaca rejected: potential wash trade for {ticker}. "
                f"Use side=close to exit a long position. Raw: {detail}"
            ))
        raise HTTPException(status_code=502, detail=detail)


# ---------------------------------------------------------------------------
# Credits
# ---------------------------------------------------------------------------

@app.get("/credits", tags=["credits"], response_model=CreditBalance)
async def get_credits(user_id: str = Depends(get_current_user)):
    balance = get_credit_balance(user_id)
    transactions = get_credit_transactions(user_id, limit=20)
    return {"balance": balance, "transactions": transactions}


# ---------------------------------------------------------------------------
# Stripe Checkout
# ---------------------------------------------------------------------------

@app.post("/checkout/subscription/{tier}", tags=["credits"], response_model=CheckoutSession)
async def checkout_subscription(
    tier: str,
    user_id: str = Depends(get_current_user),
):
    from backend.stripe_client import (
        PRO_PRICE_ID, SUCCESS_URL, CANCEL_URL, get_or_create_customer,
        get_user_email_from_supabase,
    )

    if tier != "pro":
        raise HTTPException(status_code=400, detail="Only 'pro' tier available")
    if not PRO_PRICE_ID:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    email = get_user_email_from_supabase(user_id)
    customer_id = get_or_create_customer(user_id, email)

    session = stripe_lib.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": PRO_PRICE_ID, "quantity": 1}],
        success_url=SUCCESS_URL,
        cancel_url=CANCEL_URL,
        metadata={"user_id": user_id},
    )
    return {"url": session.url}


@app.post("/checkout/credits", tags=["credits"], response_model=CheckoutSession)
async def checkout_credits(user_id: str = Depends(get_current_user)):
    from backend.stripe_client import (
        CREDIT_PACK_PRICE_ID, SUCCESS_URL, CANCEL_URL, get_or_create_customer,
        get_user_email_from_supabase,
    )

    if not CREDIT_PACK_PRICE_ID:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    email = get_user_email_from_supabase(user_id)
    customer_id = get_or_create_customer(user_id, email)

    session = stripe_lib.checkout.Session.create(
        customer=customer_id,
        mode="payment",
        line_items=[{"price": CREDIT_PACK_PRICE_ID, "quantity": 1}],
        success_url=SUCCESS_URL,
        cancel_url=CANCEL_URL,
        metadata={"user_id": user_id, "type": "credit_pack"},
    )
    return {"url": session.url}


@app.post("/billing/portal", tags=["credits"], response_model=BillingPortal)
async def billing_portal(
    user_id: str = Depends(get_current_user),
    return_url: str = Query(default="http://localhost:4321/settings"),
):
    from backend.stripe_client import get_or_create_customer, get_user_email_from_supabase

    email = get_user_email_from_supabase(user_id)
    customer_id = get_or_create_customer(user_id, email)

    session = stripe_lib.billing_portal.Session.create(
        customer=customer_id,
        return_url=return_url,
    )
    return {"url": session.url}


# ---------------------------------------------------------------------------
# Stripe Webhook (public — Stripe signature verified internally)
# ---------------------------------------------------------------------------

@app.post("/webhooks/stripe", include_in_schema=False)
async def stripe_webhook(request: Request):
    from backend.stripe_client import WEBHOOK_SECRET, CREDIT_PACK_AMOUNT, PRO_MONTHLY_AMOUNT

    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    if not WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Webhook secret not configured")

    try:
        event = stripe_lib.Webhook.construct_event(payload, sig, WEBHOOK_SECRET)
    except stripe_lib.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid Stripe signature")

    event_id = event["id"]
    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        user_id = data.get("metadata", {}).get("user_id")
        if not user_id:
            return {"received": True}

        mode = data.get("mode")
        if mode == "payment":
            credit_user(user_id, CREDIT_PACK_AMOUNT, "purchase", event_id,
                        {"stripe_session_id": data.get("id")})
        elif mode == "subscription":
            credit_user(user_id, PRO_MONTHLY_AMOUNT, "subscription_refill", event_id,
                        {"stripe_session_id": data.get("id")})
            upsert_user_settings(user_id, tier="pro",
                                 stripe_customer_id=data.get("customer"))

    elif event_type == "invoice.paid":
        customer_id = data.get("customer")
        if customer_id:
            user_id = _user_id_from_customer(customer_id)
            if user_id:
                credit_user(user_id, PRO_MONTHLY_AMOUNT, "subscription_refill", event_id,
                            {"invoice_id": data.get("id")})

    elif event_type == "customer.subscription.updated":
        customer_id = data.get("customer")
        status = data.get("status")
        if customer_id and status == "active":
            user_id = _user_id_from_customer(customer_id)
            if user_id:
                upsert_user_settings(user_id, tier="pro")

    elif event_type == "customer.subscription.deleted":
        customer_id = data.get("customer")
        if customer_id:
            user_id = _user_id_from_customer(customer_id)
            if user_id:
                upsert_user_settings(user_id, tier="free")

    return {"received": True}


def _user_id_from_customer(stripe_customer_id: str) -> Optional[str]:
    from backend.db import get_client
    result = (
        get_client()
        .table("user_settings")
        .select("user_id")
        .eq("stripe_customer_id", stripe_customer_id)
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]["user_id"]
    return None


# ---------------------------------------------------------------------------
# Settings — Alpaca keys
# ---------------------------------------------------------------------------

@app.post("/settings/alpaca", tags=["settings"], response_model=AlpacaSettingsSaved)
async def save_alpaca_keys(
    body: AlpacaSettings,
    user_id: str = Depends(get_current_user),
):
    from backend.vault import store_alpaca_keys
    store_alpaca_keys(user_id, body.api_key, body.api_secret)
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# WebSocket — real-time task events (public)
# ---------------------------------------------------------------------------

@app.websocket("/ws")
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
