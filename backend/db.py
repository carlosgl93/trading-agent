import os
from typing import Any, Optional

from supabase import Client, create_client

_client: Optional[Client] = None


def get_client() -> Client:
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        # Prefer service role key (bypasses RLS) in backend context
        key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_ANON_KEY"]
        _client = create_client(url, key)
    return _client


def log_trade(
    *,
    ticker: str,
    analysis_date: str,
    rating: Optional[str],
    reasoning: str = "",
    model_used: str = "",
    alpaca_order_id: Optional[str] = None,
    execution_status: str = "pending",
    raw_report: Optional[dict] = None,
) -> None:
    get_client().table("trading_logs").insert({
        "ticker": ticker,
        "analysis_date": analysis_date,
        "rating": rating,
        "reasoning": reasoning,
        "model_used": model_used,
        "alpaca_order_id": alpaca_order_id,
        "execution_status": execution_status,
        "raw_report": raw_report or {},
    }).execute()


def get_trade_log_by_id(log_id: str) -> dict[str, Any] | None:
    result = (
        get_client()
        .table("trading_logs")
        .select("*")
        .eq("id", log_id)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def get_latest_results(limit: int = 50) -> list[dict[str, Any]]:
    result = (
        get_client()
        .table("trading_logs")
        .select("id,ticker,analysis_date,rating,model_used,alpaca_order_id,execution_status,created_at")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data


# ---------------------------------------------------------------------------
# Portfolio positions
# ---------------------------------------------------------------------------

def open_position(
    *,
    ticker: str,
    direction: str,
    entry_rating: str,
    entry_date: str,
    entry_order_id: Optional[str] = None,
) -> None:
    get_client().table("portfolio_positions").insert({
        "ticker": ticker,
        "direction": direction,
        "entry_rating": entry_rating,
        "entry_date": entry_date,
        "entry_order_id": entry_order_id,
        "status": "open",
    }).execute()


def close_position(
    *,
    ticker: str,
    exit_rating: str,
    exit_date: str,
    exit_order_id: Optional[str] = None,
) -> None:
    get_client().table("portfolio_positions").update({
        "status": "closed",
        "exit_rating": exit_rating,
        "exit_date": exit_date,
        "exit_order_id": exit_order_id,
    }).eq("ticker", ticker).eq("status", "open").execute()


def touch_position_review(ticker: str) -> None:
    """Update last_reviewed_at timestamp for open positions of ticker."""
    from datetime import datetime, timezone
    get_client().table("portfolio_positions").update({
        "last_reviewed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("ticker", ticker).eq("status", "open").execute()


def get_open_positions() -> list[dict[str, Any]]:
    result = (
        get_client()
        .table("portfolio_positions")
        .select("*")
        .eq("status", "open")
        .order("created_at")
        .execute()
    )
    return result.data


# ---------------------------------------------------------------------------
# Scouting log
# ---------------------------------------------------------------------------

def log_scouting(
    *,
    scout_date: str,
    macro_context: str,
    picks: list,
    model_used: str,
) -> None:
    get_client().table("scouting_log").insert({
        "scout_date": scout_date,
        "macro_context": macro_context,
        "tickers_json": picks,
        "model_used": model_used,
    }).execute()


def get_scouting_log(limit: int = 20) -> list[dict[str, Any]]:
    result = (
        get_client()
        .table("scouting_log")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data
