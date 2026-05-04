import os
from typing import Any, Optional

from supabase import Client, create_client

_client: Optional[Client] = None


def get_client() -> Client:
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_ANON_KEY"]
        _client = create_client(url, key)
    return _client


# ---------------------------------------------------------------------------
# Trading logs
# ---------------------------------------------------------------------------

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
    user_id: Optional[str] = None,
) -> None:
    row: dict[str, Any] = {
        "ticker": ticker,
        "analysis_date": analysis_date,
        "rating": rating,
        "reasoning": reasoning,
        "model_used": model_used,
        "alpaca_order_id": alpaca_order_id,
        "execution_status": execution_status,
        "raw_report": raw_report or {},
    }
    if user_id:
        row["user_id"] = user_id
    get_client().table("trading_logs").insert(row).execute()


def get_trade_log_by_id(log_id: str, *, user_id: Optional[str] = None) -> dict[str, Any] | None:
    q = get_client().table("trading_logs").select("*").eq("id", log_id)
    if user_id:
        q = q.eq("user_id", user_id)
    result = q.limit(1).execute()
    return result.data[0] if result.data else None


def get_latest_results(limit: int = 50, *, user_id: Optional[str] = None) -> list[dict[str, Any]]:
    q = (
        get_client()
        .table("trading_logs")
        .select("id,ticker,analysis_date,rating,model_used,alpaca_order_id,execution_status,created_at")
        .order("created_at", desc=True)
        .limit(limit)
    )
    if user_id:
        q = q.eq("user_id", user_id)
    return q.execute().data


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
    user_id: Optional[str] = None,
) -> None:
    row: dict[str, Any] = {
        "ticker": ticker,
        "direction": direction,
        "entry_rating": entry_rating,
        "entry_date": entry_date,
        "entry_order_id": entry_order_id,
        "status": "open",
    }
    if user_id:
        row["user_id"] = user_id
    get_client().table("portfolio_positions").insert(row).execute()


def close_position(
    *,
    ticker: str,
    exit_rating: str,
    exit_date: str,
    exit_order_id: Optional[str] = None,
    user_id: Optional[str] = None,
) -> None:
    q = (
        get_client()
        .table("portfolio_positions")
        .update({
            "status": "closed",
            "exit_rating": exit_rating,
            "exit_date": exit_date,
            "exit_order_id": exit_order_id,
        })
        .eq("ticker", ticker)
        .eq("status", "open")
    )
    if user_id:
        q = q.eq("user_id", user_id)
    q.execute()


def touch_position_review(ticker: str, *, user_id: Optional[str] = None) -> None:
    from datetime import datetime, timezone
    q = (
        get_client()
        .table("portfolio_positions")
        .update({"last_reviewed_at": datetime.now(timezone.utc).isoformat()})
        .eq("ticker", ticker)
        .eq("status", "open")
    )
    if user_id:
        q = q.eq("user_id", user_id)
    q.execute()


def get_open_positions(*, user_id: Optional[str] = None) -> list[dict[str, Any]]:
    q = (
        get_client()
        .table("portfolio_positions")
        .select("*")
        .eq("status", "open")
        .order("created_at")
    )
    if user_id:
        q = q.eq("user_id", user_id)
    return q.execute().data


# ---------------------------------------------------------------------------
# Scouting log
# ---------------------------------------------------------------------------

def log_scouting(
    *,
    scout_date: str,
    macro_context: str,
    picks: list,
    model_used: str,
    user_id: Optional[str] = None,
) -> None:
    row: dict[str, Any] = {
        "scout_date": scout_date,
        "macro_context": macro_context,
        "tickers_json": picks,
        "model_used": model_used,
    }
    if user_id:
        row["user_id"] = user_id
    get_client().table("scouting_log").insert(row).execute()


def get_scouting_log(limit: int = 20, *, user_id: Optional[str] = None) -> list[dict[str, Any]]:
    q = (
        get_client()
        .table("scouting_log")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
    )
    if user_id:
        q = q.eq("user_id", user_id)
    return q.execute().data


# ---------------------------------------------------------------------------
# Credit system
# ---------------------------------------------------------------------------

def debit_credit(user_id: str) -> bool:
    """Atomically deduct 1 credit. Returns True on success, False if balance=0."""
    result = get_client().rpc("debit_credit", {"p_user_id": user_id}).execute()
    return bool(result.data)


def credit_user(
    user_id: str,
    amount: int,
    transaction_type: str,
    stripe_event_id: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> None:
    get_client().rpc("credit_user", {
        "p_user_id": user_id,
        "p_amount": amount,
        "p_transaction_type": transaction_type,
        "p_stripe_event_id": stripe_event_id,
        "p_metadata": metadata or {},
    }).execute()


def grant_free_credits(user_id: str) -> None:
    get_client().rpc("grant_free_credits", {"p_user_id": user_id}).execute()


def get_credit_balance(user_id: str) -> int:
    result = (
        get_client()
        .table("user_credits")
        .select("balance")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]["balance"]
    return 0


def get_credit_transactions(user_id: str, limit: int = 20) -> list[dict[str, Any]]:
    return (
        get_client()
        .table("credit_transactions")
        .select("id,amount,transaction_type,stripe_event_id,created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
        .data
    )


# ---------------------------------------------------------------------------
# User settings
# ---------------------------------------------------------------------------

def get_user_settings(user_id: str) -> dict[str, Any] | None:
    result = (
        get_client()
        .table("user_settings")
        .select("*")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def upsert_user_settings(user_id: str, **fields: Any) -> None:
    from datetime import datetime, timezone
    get_client().table("user_settings").upsert({
        "user_id": user_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        **fields,
    }).execute()
