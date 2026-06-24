"""Celery Beat schedule and the ticker-loop task.

The beat schedule triggers `run_ticker_loop` once a day after market close
(4:30 PM UTC, which is 12:30 PM ET — adjust to your timezone if needed).

Each ticker gets its own `analyze_and_trade` task, staggered by COOLDOWN_SECONDS
to respect OpenRouter free-tier rate limits.
"""

import os
from datetime import date

from celery import chain as celery_chain
from celery.schedules import crontab

from backend.celery_app import celery_app
from backend.tasks import analyze_and_trade

TARGET_TICKERS = [
    t.strip() for t in os.environ.get("TARGET_TICKERS", "AAPL,MSFT,GOOGL,NVDA,TSLA").split(",") if t.strip()
]


celery_app.conf.beat_schedule = {
    "scout-daily": {
        "task": "backend.scout_task.scout_tickers",
        # Mon–Fri at 14:00 UTC = 9:00 AM ET (before market open)
        "schedule": crontab(hour=14, minute=0, day_of_week="mon-fri"),
        # SYSTEM_USER_ID from env attributes the auto-scout row to a real
        # Supabase user so the UI filter (single-tenant POC) shows it.
        # Manual scouts use the requesting user's id instead.
        "kwargs": {
            "paid": True,
            "max_picks": 1,
            "min_conviction": 3,
            "user_id": os.environ.get("SYSTEM_USER_ID"),
        },
    },
    "analyze-tickers-daily": {
        "task": "backend.scheduler.run_ticker_loop",
        # Mon–Fri at 21:30 UTC = 4:30 PM ET (after NYSE close)
        "schedule": crontab(hour=21, minute=30, day_of_week="mon-fri"),
    },
    "review-positions-midday": {
        "task": "backend.review_task.review_all_positions",
        # Mon–Fri at 17:00 UTC = 12:00 PM ET (midday check)
        "schedule": crontab(hour=17, minute=0, day_of_week="mon-fri"),
    },
    "review-positions-preclose": {
        "task": "backend.review_task.review_all_positions",
        # Mon–Fri at 20:30 UTC = 3:30 PM ET (30 min before close)
        "schedule": crontab(hour=20, minute=30, day_of_week="mon-fri"),
    },
}


@celery_app.task(name="backend.scheduler.run_ticker_loop")
def run_ticker_loop():
    """Run TARGET_TICKERS sequentially — each analysis starts only after the previous one finishes.

    Using a Celery chain guarantees no two analyses run concurrently, which
    avoids hammering the OpenRouter free-tier rate limits regardless of how
    long each individual analysis takes.
    """
    analysis_date = str(date.today())
    if not TARGET_TICKERS:
        return {"error": "TARGET_TICKERS is empty"}

    steps = celery_chain(*[
        analyze_and_trade.si(t, analysis_date, _seq_pos=i, _seq_tickers=TARGET_TICKERS)
        for i, t in enumerate(TARGET_TICKERS)
    ])
    steps.delay()
    return {"chained": TARGET_TICKERS, "date": analysis_date}
