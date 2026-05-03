"""Lightweight position review task.

Runs market + fundamentals analysts only (no social/news, 1 debate round).
Roughly 5–6 LLM calls vs. 12 for a full analysis — target ~8 min runtime.

Exit logic
----------
Long position  → exit when new rating is Sell or Underweight
Short position → exit (cover) when new rating is Buy or Overweight
Hold/unchanged → update last_reviewed_at, do nothing
"""

import os
import time
from datetime import date
from typing import Optional

from celery.utils.log import get_task_logger
from langchain_core.messages import HumanMessage, SystemMessage

from backend.alpaca_client import close_position as alpaca_close_position, submit_order
from backend.celery_app import celery_app
from backend.db import close_position, get_open_positions, log_trade, touch_position_review
from backend.tasks import (
    FREE_MODELS,
    PAID_MODELS,
    TokenTracker,
    _COMPRESS_PROMPT,
    _build_config,
    _fmt_elapsed,
    _get_model_list,
)
from tradingagents.graph.trading_graph import TradingAgentsGraph

logger = get_task_logger(__name__)

# Only 2 analysts — skip social and news to cut LLM calls roughly in half.
_REVIEW_ANALYSTS = ["market", "fundamentals"]


@celery_app.task(
    bind=True,
    max_retries=5,
    name="backend.review_task.review_position",
    queue="analysis",
)
def review_position(
    self,
    ticker: str,
    direction: str,       # "long" | "short"
    entry_rating: str,
    analysis_date: Optional[str] = None,
    _model_index: int = 0,
    paid: bool = False,
):
    """Review an open position. Exit if the signal has flipped."""
    if not analysis_date:
        analysis_date = str(date.today())

    models = _get_model_list(paid)
    model = models[_model_index % len(models)]
    retry_num = self.request.retries
    start_time = time.time()

    logger.info(
        "[REVIEW][%s] direction=%s entry=%s model=%s attempt=%d",
        ticker, direction, entry_rating, model, retry_num + 1,
    )

    token_tracker = TokenTracker()

    try:
        config = _build_config(model, parallel=False, debate_rounds=1)
        graph = TradingAgentsGraph(
            selected_analysts=_REVIEW_ANALYSTS,
            config=config,
            callbacks=[token_tracker],
        )

        init_state = graph.propagator.create_initial_state(ticker, analysis_date)
        init_state["messages"] = [
            SystemMessage(content=_COMPRESS_PROMPT),
            HumanMessage(content=ticker),
        ]

        args = graph.propagator.get_graph_args()
        final_state = None
        for chunk in graph.graph.stream(init_state, **args):
            final_state = chunk

        pm_decision = ""
        if final_state:
            risk_state = final_state.get("risk_debate_state") or {}
            pm_decision = risk_state.get("judge_decision", "")

        new_rating = graph.signal_processor.process_signal(pm_decision) if pm_decision else "Hold"
        elapsed = time.time() - start_time

        logger.info(
            "[REVIEW][%s] entry=%s new=%s elapsed=%s tokens=%d",
            ticker, entry_rating, new_rating, _fmt_elapsed(elapsed), token_tracker.total,
        )

        # Determine whether to exit
        should_exit = (
            (direction == "long"  and new_rating in ("Sell", "Underweight")) or
            (direction == "short" and new_rating in ("Buy", "Overweight"))
        )

        order_id = None
        execution_status = "skipped"
        notional = float(os.environ.get("ALPACA_NOTIONAL", "100"))

        if should_exit:
            # Use Alpaca's close-position endpoint to avoid fractional-share rounding
            # mismatch: a notional sell may request slightly more shares than held.
            order = alpaca_close_position(ticker)
            order_id = str(order.id) if order else None
            execution_status = "executed" if order_id else "failed"
            logger.info("[REVIEW][%s] EXIT close_position order: %s", ticker, order_id)

            if order_id:
                close_position(
                    ticker=ticker,
                    exit_rating=new_rating,
                    exit_date=analysis_date,
                    exit_order_id=order_id,
                )
        else:
            touch_position_review(ticker)

        log_trade(
            ticker=ticker,
            analysis_date=analysis_date,
            rating=new_rating,
            reasoning=pm_decision,
            model_used=model,
            alpaca_order_id=order_id,
            execution_status=execution_status,
        )

        return {"ticker": ticker, "entry": entry_rating, "new_rating": new_rating,
                "exited": should_exit, "order_id": order_id}

    except Exception as exc:
        exc_str = str(exc)

        is_rate_limited = (
            "429" in exc_str
            or "rate_limit" in exc_str.lower()
            or "too many requests" in exc_str.lower()
        )
        is_unavailable = any(
            t in exc_str
            for t in (
                "400", "404", "502", "503", "524",
                "overloaded", "model_error", "unavailable",
                "No endpoints found", "timeout",
                "reasoning_content",
            )
        )
        is_network_error = isinstance(exc, (OSError, ConnectionError)) or any(
            t in exc_str
            for t in ("Name or service not known", "Temporary failure in name resolution",
                      "ConnectError", "Connection refused", "Connection reset")
        )

        if is_rate_limited or is_unavailable or is_network_error:
            next_index = _model_index + 1
            next_model = models[next_index % len(models)]
            full_cycles = next_index // len(models)
            backoff = 60 * (2 ** (full_cycles - 1)) if full_cycles > 0 else 15
            logger.warning("[REVIEW][%s] %s — switching to %s (backoff=%ds)",
                           ticker, "429" if is_rate_limited else "unavailable", next_model, backoff)
            raise self.retry(
                exc=exc,
                countdown=backoff,
                args=[ticker, direction, entry_rating, analysis_date],
                kwargs={"_model_index": next_index, "paid": paid},
            )

        logger.error("[REVIEW][%s] Fatal: %s", ticker, exc, exc_info=True)
        raise


@celery_app.task(name="backend.review_task.review_all_positions")
def review_all_positions(paid: bool = False):
    """Dispatch a review_position task for every open portfolio position, sequentially."""
    from celery import chain as celery_chain

    positions = get_open_positions()
    if not positions:
        logger.info("[REVIEW] No open positions to review.")
        return {"reviewed": 0}

    today = str(date.today())
    steps = celery_chain(*[
        review_position.si(
            p["ticker"], p["direction"], p["entry_rating"], today, paid=paid
        )
        for p in positions
    ])
    steps.delay()
    logger.info("[REVIEW] Dispatched review chain for %d positions: %s",
                len(positions), [p["ticker"] for p in positions])
    return {"dispatched": len(positions)}
