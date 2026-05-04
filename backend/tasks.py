"""Celery task: run multi-agent analysis for a ticker and paper-trade the signal.

Retry strategy
--------------
429 Too Many Requests  → cycle to next model immediately (15s gap).
404/502/503/524        → cycle to next model immediately (15s gap).
After full model cycle → exponential backoff: 60 → 120 → 240 s.
Any other exception    → log failure to Supabase, re-raise (no retry).
"""

import os
import time
from datetime import date
from typing import List, Optional

from celery.utils.log import get_task_logger
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.outputs import LLMResult

from backend.celery_app import celery_app
from backend.db import debit_credit, log_trade, open_position
from tradingagents.default_config import DEFAULT_CONFIG
from tradingagents.graph.trading_graph import TradingAgentsGraph

logger = get_task_logger(__name__)

FREE_MODELS = [
    "google/gemma-4-31b-it:free",
    "google/gemma-4-26b-a4b-it:free",
    "minimax/minimax-m2.5:free",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "openrouter/owl-alpha",
]

PAID_MODELS = [
    "deepseek/deepseek-v4-flash",
    "deepseek/deepseek-v3.2",
] + FREE_MODELS


def _get_model_list(paid: bool) -> list:
    return PAID_MODELS if paid else FREE_MODELS

_COMPRESS_PROMPT = (
    "You smart agent. But context window small. So you follow rules:\n"
    "1. ALL reports: max 250 words. Short = good. Long = bad.\n"
    "2. News analyst: give 5 bullet facts only. No big story.\n"
    "3. Market analyst: give 3 numbers + 1 trend sentence. Nothing more.\n"
    "4. Fundamentals analyst: give 4 key numbers (P/E, revenue, debt, growth).\n"
    "5. When pass data to next agent: summarize first. No copy-paste big blocks.\n"
    "6. Portfolio Manager: make final decision. State rating and 3 reasons. Done.\n"
    "Me no want big essay. Me want small, dense, useful summary. Caveman speak ok."
)

_PROGRESS_STEPS = [
    ("market_report",                                      1,  "Market Analyst"),
    ("sentiment_report",                                   2,  "Social Analyst"),
    ("news_report",                                        3,  "News Analyst"),
    ("fundamentals_report",                                4,  "Fundamentals Analyst"),
    ("investment_debate_state.bull_history",               5,  "Bull Researcher"),
    ("investment_debate_state.bear_history",               6,  "Bear Researcher"),
    ("investment_debate_state.judge_decision",             7,  "Research Manager"),
    ("trader_investment_plan",                             8,  "Trader"),
    ("risk_debate_state.aggressive_history",               9,  "Risk: Aggressive"),
    ("risk_debate_state.conservative_history",             10, "Risk: Conservative"),
    ("risk_debate_state.neutral_history",                  11, "Risk: Neutral"),
    ("risk_debate_state.judge_decision",                   12, "Portfolio Manager"),
]
_TOTAL_STEPS = len(_PROGRESS_STEPS)


def _get_nested(state: dict, dotted_key: str) -> str:
    parts = dotted_key.split(".", 1)
    val = state.get(parts[0])
    if len(parts) == 1:
        return val or ""
    if isinstance(val, dict):
        return val.get(parts[1]) or ""
    return ""


class TokenTracker(BaseCallbackHandler):
    def __init__(self):
        self.total = 0
        self.prompt = 0
        self.completion = 0
        self.calls = 0

    def on_llm_end(self, response: LLMResult, **kwargs):
        self.calls += 1
        usage = (response.llm_output or {}).get("token_usage", {})
        self.prompt     += usage.get("prompt_tokens", 0)
        self.completion += usage.get("completion_tokens", 0)
        self.total      += usage.get("total_tokens", 0)


def _fmt_elapsed(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    return f"{m}m {s:02d}s"


def _build_config(model: str, *, parallel: bool = True, debate_rounds: int = 1) -> dict:
    cfg = {**DEFAULT_CONFIG}
    cfg.update({
        "llm_provider": "openrouter",
        "deep_think_llm": model,
        "quick_think_llm": model,
        "max_debate_rounds": debate_rounds,
        "max_risk_discuss_rounds": debate_rounds,
        "parallel_analysts": parallel,
        "default_headers": {
            "HTTP-Referer": os.environ.get("SITE_URL", "http://localhost:4321"),
            "X-Title": os.environ.get("OPENROUTER_SITE_NAME", "TradingAgents POC"),
        },
    })
    return cfg


def _get_alpaca_clients(user_id: Optional[str]):
    """Return (submit_order_fn, close_position_fn) for the given user.

    Uses vault-stored keys when user_id is provided, falls back to env keys.
    """
    from backend.alpaca_client import (
        close_position as env_close,
        submit_order as env_submit,
        submit_order_for_user,
        close_position_for_user,
    )

    if user_id:
        try:
            from backend.vault import get_alpaca_keys
            api_key, api_secret = get_alpaca_keys(user_id)
            paper = os.environ.get("ALPACA_PAPER", "true").lower() == "true"
            return (
                lambda ticker, side, notional: submit_order_for_user(
                    api_key, api_secret, ticker, side, notional, paper
                ),
                lambda ticker: close_position_for_user(api_key, api_secret, ticker, paper),
            )
        except ValueError:
            logger.warning("[%s] No vault keys for user %s — falling back to env keys", user_id, user_id)

    return env_submit, env_close


@celery_app.task(
    bind=True,
    max_retries=5,
    name="backend.tasks.analyze_and_trade",
    queue="analysis",
)
def analyze_and_trade(
    self,
    ticker: str,
    analysis_date: Optional[str] = None,
    _model_index: int = 0,
    _seq_pos: Optional[int] = None,
    _seq_tickers: Optional[List[str]] = None,
    paid: bool = False,
    user_id: Optional[str] = None,
):
    if not analysis_date:
        analysis_date = str(date.today())

    # Debit 1 credit before running (user-facing tasks only)
    if user_id:
        if not debit_credit(user_id):
            logger.warning("[%s] Insufficient credits for user %s", ticker, user_id)
            return {"ticker": ticker, "status": "insufficient_credits", "user_id": user_id}

    models = _get_model_list(paid)
    model = models[_model_index % len(models)]
    retry_num = self.request.retries
    start_time = time.time()

    if _seq_pos is not None and _seq_tickers:
        total_in_seq = len(_seq_tickers)
        remaining = _seq_tickers[_seq_pos + 1:] if _seq_pos + 1 < total_in_seq else []
        seq_label = f"[{_seq_pos + 1}/{total_in_seq}]"
        remaining_label = f"remaining={remaining}" if remaining else "remaining=none (last)"
    else:
        seq_label = ""
        remaining_label = ""

    logger.info(
        "[%s]%s Starting analysis | model=%s | attempt=%d | user=%s | %s",
        ticker, f" {seq_label}" if seq_label else "", model, retry_num + 1,
        user_id or "system", remaining_label,
    )

    completed_steps: set = set()
    token_tracker = TokenTracker()
    submit_order, close_position = _get_alpaca_clients(user_id)

    try:
        config = _build_config(model, parallel=False)
        graph = TradingAgentsGraph(
            selected_analysts=["market", "social", "news", "fundamentals"],
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
            elapsed = time.time() - start_time

            for state_key, step_num, agent_name in _PROGRESS_STEPS:
                if step_num in completed_steps:
                    continue
                if _get_nested(chunk, state_key):
                    completed_steps.add(step_num)
                    pct = int(step_num / _TOTAL_STEPS * 100)
                    logger.info(
                        "[%s]%s  %3d%% | step %2d/%-2d | %-22s done | elapsed=%s | tokens=%d (↑%d ↓%d)",
                        ticker,
                        f" {seq_label}" if seq_label else "",
                        pct, step_num, _TOTAL_STEPS, agent_name,
                        _fmt_elapsed(elapsed),
                        token_tracker.total, token_tracker.prompt, token_tracker.completion,
                    )

        elapsed = time.time() - start_time

        pm_decision = ""
        if final_state:
            risk_state = final_state.get("risk_debate_state") or {}
            pm_decision = risk_state.get("judge_decision", "")

        rating = graph.signal_processor.process_signal(pm_decision) if pm_decision else "Hold"

        logger.info(
            "[%s]%s DONE | rating=%-12s | elapsed=%s | total_tokens=%d (prompt=%d completion=%d) | %s",
            ticker,
            f" {seq_label}" if seq_label else "",
            rating, _fmt_elapsed(elapsed),
            token_tracker.total, token_tracker.prompt, token_tracker.completion,
            remaining_label,
        )

        order_id = None
        execution_status = "skipped"
        notional = float(os.environ.get("ALPACA_NOTIONAL", "100"))

        if rating in ("Buy", "Overweight"):
            order = submit_order(ticker, side="buy", notional=notional)
            order_id = str(order.id) if order else None
            execution_status = "executed" if order_id else "failed"
            logger.info("[%s] BUY order submitted: %s", ticker, order_id)
            if order_id:
                open_position(
                    ticker=ticker, direction="long", entry_rating=rating,
                    entry_date=analysis_date, entry_order_id=order_id,
                    user_id=user_id,
                )
        elif rating in ("Sell", "Underweight"):
            order = submit_order(ticker, side="sell", notional=notional)
            order_id = str(order.id) if order else None
            execution_status = "executed" if order_id else "failed"
            logger.info("[%s] SELL order submitted: %s", ticker, order_id)
            if order_id:
                open_position(
                    ticker=ticker, direction="short", entry_rating=rating,
                    entry_date=analysis_date, entry_order_id=order_id,
                    user_id=user_id,
                )

        log_trade(
            ticker=ticker,
            analysis_date=analysis_date,
            rating=rating,
            reasoning=pm_decision,
            model_used=model,
            alpaca_order_id=order_id,
            execution_status=execution_status,
            user_id=user_id,
        )

        return {"ticker": ticker, "rating": rating, "order_id": order_id, "status": execution_status}

    except Exception as exc:
        exc_str = str(exc)

        is_rate_limited = (
            "429" in exc_str
            or "rate_limit" in exc_str.lower()
            or "too many requests" in exc_str.lower()
        )
        is_unavailable = any(
            token in exc_str
            for token in (
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

            reason = "429 rate-limited" if is_rate_limited else "model unavailable"
            logger.warning(
                "[%s]%s %s on %s — switching to %s (backoff=%ds, cycle=%d)",
                ticker, f" {seq_label}" if seq_label else "",
                reason, model, next_model, backoff, full_cycles,
            )
            raise self.retry(
                exc=exc,
                countdown=backoff,
                args=[ticker, analysis_date],
                kwargs={
                    "_model_index": next_index,
                    "_seq_pos": _seq_pos,
                    "_seq_tickers": _seq_tickers,
                    "paid": paid,
                    "user_id": user_id,
                },
            )

        try:
            log_trade(
                ticker=ticker,
                analysis_date=analysis_date,
                rating=None,
                reasoning=f"Error: {exc_str[:500]}",
                model_used=model,
                execution_status="failed",
                user_id=user_id,
            )
        except Exception:
            pass

        logger.error("[%s] Fatal error: %s", ticker, exc, exc_info=True)
        raise
