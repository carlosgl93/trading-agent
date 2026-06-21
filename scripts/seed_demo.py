"""Idempotent seed script for the TradingAgents investor-demo account.

Creates a demo user, grants free credits, and populates a small set of
sample trading_logs / portfolio_positions / scouting_log rows so the
deployed dashboard is not empty for an investor walkthrough.

Re-runnable: detects existing data and skips inserts; safe to run on a
fresh DB or against a partially-seeded one.

Required env:
  SUPABASE_URL          - project URL (e.g. https://xxx.supabase.co)
  SUPABASE_SERVICE_KEY  - service_role JWT (admin, bypasses RLS)

Optional env (with defaults):
  DEMO_EMAIL            - default demo@tradingagents.app
  DEMO_PASSWORD         - default demo-investor-2026
  DEMO_TICKERS          - comma-separated, default NVDA,AAPL,MSFT,TSLA,AMD
  DEMO_USER_ID          - stable UUID, default 00000000-0000-0000-0000-0000000000d0

Usage:
  SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python scripts/seed_demo.py
"""
from __future__ import annotations

import os
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

from supabase import Client, create_client

DEMO_EMAIL = os.environ.get("DEMO_EMAIL", "demo@tradingagents.app")
DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "demo-investor-2026")
DEMO_TICKERS = [
    t.strip() for t in os.environ.get("DEMO_TICKERS", "NVDA,AAPL,MSFT,TSLA,AMD").split(",") if t.strip()
]
DEMO_USER_ID = uuid.UUID(os.environ.get("DEMO_USER_ID", "00000000-0000-0000-0000-0000000000d0"))


def get_client() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_KEY before running.")
    return create_client(url, key)


def ensure_user(client: Client) -> str:
    """Return demo user id, creating the user if missing."""
    try:
        resp = client.auth.admin.create_user({
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD,
            "email_confirm": True,
            "user_metadata": {"display_name": "Investor Demo"},
        })
        return resp.user.id
    except Exception as exc:
        msg = str(exc).lower()
        if "already" in msg or "registered" in msg or "exists" in msg:
            # Look up existing user by email via admin API
            listing = client.auth.admin.list_users()
            for u in listing:
                if u.email == DEMO_EMAIL:
                    return str(u.id)
        raise


def grant_free_credits(client: Client, user_id: str) -> None:
    """Call the grant_free_credits RPC (no-op if user already got them)."""
    client.rpc("grant_free_credits", {"p_user_id": user_id}).execute()


def seed_trading_logs(client: Client, user_id: str) -> int:
    """Insert sample trading_logs rows. Returns number of new rows inserted."""
    today = date.today()
    samples = [
        ("NVDA", 4, "Buy", "Q1 earnings beat, data-center revenue +250% YoY."),
        ("AAPL", 3, "Hold", "Services growth steady, hardware cycle softening."),
        ("MSFT", 4, "Overweight", "Azure growth reaccelerated, AI Copilot adoption strong."),
        ("TSLA", 2, "Underweight", "Margin compression, China competition intensifying."),
        ("AMD", 3, "Hold", "Data-center traction offset by gaming softness."),
    ]
    inserted = 0
    for offset, (ticker, conv, rating, reasoning) in enumerate(samples[:len(DEMO_TICKERS)]):
        analysis_date = (today - timedelta(days=offset * 3)).isoformat()
        # Skip if a row already exists for this (user, ticker, date)
        existing = (
            client.table("trading_logs")
            .select("id")
            .eq("user_id", user_id)
            .eq("ticker", ticker)
            .eq("analysis_date", analysis_date)
            .limit(1)
            .execute()
        )
        if existing.data:
            continue
        client.table("trading_logs").insert({
            "user_id": user_id,
            "ticker": ticker,
            "analysis_date": analysis_date,
            "rating": rating,
            "reasoning": reasoning,
            "model_used": "openrouter/auto",
            "execution_status": "executed",
            "raw_report": {
                "conviction": conv,
                "bull_bear_debate_rounds": 2,
                "source": "demo_seed",
            },
        }).execute()
        inserted += 1
    return inserted


def seed_positions(client: Client, user_id: str) -> int:
    """Insert open portfolio positions. Returns number of new rows."""
    samples = [
        ("NVDA", "long", "Buy", "2026-05-12", "demo-order-nvda-1"),
        ("MSFT", "long", "Overweight", "2026-05-15", "demo-order-msft-1"),
    ]
    inserted = 0
    for ticker, direction, entry_rating, entry_date, order_id in samples:
        existing = (
            client.table("portfolio_positions")
            .select("id")
            .eq("user_id", user_id)
            .eq("ticker", ticker)
            .eq("status", "open")
            .limit(1)
            .execute()
        )
        if existing.data:
            continue
        client.table("portfolio_positions").insert({
            "user_id": user_id,
            "ticker": ticker,
            "direction": direction,
            "entry_rating": entry_rating,
            "entry_date": entry_date,
            "entry_order_id": order_id,
            "status": "open",
        }).execute()
        inserted += 1
    return inserted


def seed_scout_log(client: Client, user_id: str) -> int:
    """Insert scout log entries. Returns number of new rows."""
    today = date.today()
    samples = [
        (
            (today - timedelta(days=1)).isoformat(),
            "Fed pause expected, tech earnings tailwind, AI capex cycle strong.",
            [
                {"ticker": "NVDA", "conviction": 5, "thesis": "AI capex leader, data-center moat."},
                {"ticker": "MSFT", "conviction": 4, "thesis": "Azure reaccel, Copilot monetization early."},
                {"ticker": "AVGO", "conviction": 4, "thesis": "Custom silicon tailwind."},
            ],
        ),
        (
            (today - timedelta(days=4)).isoformat(),
            "Risk-on, soft-landing consensus, mega-cap tech leadership.",
            [
                {"ticker": "META", "conviction": 4, "thesis": "Ad recovery + Reels monetization."},
                {"ticker": "AMZN", "conviction": 4, "thesis": "AWS stabilization, retail margin."},
            ],
        ),
    ]
    inserted = 0
    for scout_date, macro, picks in samples:
        existing = (
            client.table("scouting_log")
            .select("id")
            .eq("user_id", user_id)
            .eq("scout_date", scout_date)
            .limit(1)
            .execute()
        )
        if existing.data:
            continue
        client.table("scouting_log").insert({
            "user_id": user_id,
            "scout_date": scout_date,
            "macro_context": macro,
            "tickers_json": picks,
            "model_used": "openrouter/auto",
        }).execute()
        inserted += 1
    return inserted


def main() -> None:
    client = get_client()
    print(f"Seeding demo user {DEMO_EMAIL} (id={DEMO_USER_ID}) ...")

    user_id = ensure_user(client)
    if str(user_id) != str(DEMO_USER_ID):
        print(f"  note: existing user has id {user_id}, using it for the seed")
    else:
        print(f"  user created")

    grant_free_credits(client, user_id)
    print("  free credits granted (idempotent)")

    n_logs = seed_trading_logs(client, user_id)
    n_pos = seed_positions(client, user_id)
    n_scout = seed_scout_log(client, user_id)

    print(f"  trading_logs: +{n_logs}")
    print(f"  portfolio_positions: +{n_pos}")
    print(f"  scouting_log: +{n_scout}")
    print("done.")


if __name__ == "__main__":
    main()
