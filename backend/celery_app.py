import json
import os
from celery import Celery
from celery.signals import task_postrun
from kombu import Queue
import redis

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "tradingagents",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["backend.tasks", "backend.scheduler", "backend.review_task", "backend.scout_task"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_queues=[
        Queue("default"),
        Queue("analysis"),
    ],
    task_default_queue="default",
    # Process one analysis at a time per worker to avoid hammering the free-tier LLM
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    # Beat schedule is defined in scheduler.py and loaded via autodiscover
    beat_schedule_filename="/tmp/celerybeat-schedule",
)


# ---------------------------------------------------------------------------
# task_postrun signal — publish task completion events to Redis pub/sub
# ---------------------------------------------------------------------------

@task_postrun.connect
def on_task_postrun(task_id, task, retval, state, kwargs, **_kw):
    """Publish a task_complete event to the 'task_events' Redis channel."""
    try:
        task_name = task.name if task else ""
        status = "failed" if state == "FAILURE" else None

        if task_name == "backend.tasks.analyze_and_trade":
            kind = "analysis"
            # Prefer ticker from kwargs, fall back to retval
            ticker = (kwargs or {}).get("ticker") or (kwargs or {}).get("args", [None])[0]
            if not ticker and isinstance(retval, dict):
                ticker = retval.get("ticker")
            if not status:
                status = retval.get("status", "executed") if isinstance(retval, dict) else "executed"
            payload = {
                "type": "task_complete",
                "kind": kind,
                "ticker": ticker,
                "tickers": None,
                "status": status,
                "task_id": task_id,
            }

        elif task_name == "backend.scout_task.scout_tickers":
            kind = "scout"
            tickers = None
            if isinstance(retval, list):
                tickers = [item["ticker"] for item in retval if isinstance(item, dict) and "ticker" in item] or None
            if not status:
                status = "scouting"
            payload = {
                "type": "task_complete",
                "kind": kind,
                "ticker": None,
                "tickers": tickers,
                "status": status,
                "task_id": task_id,
            }

        elif task_name == "backend.review_task.review_all_positions":
            kind = "review"
            if not status:
                status = "dispatched"
            payload = {
                "type": "task_complete",
                "kind": kind,
                "ticker": None,
                "tickers": None,
                "status": status,
                "task_id": task_id,
            }

        else:
            # Fallback: treat as analysis
            kind = "analysis"
            ticker = (kwargs or {}).get("ticker") or (kwargs or {}).get("args", [None])[0]
            if not ticker and isinstance(retval, dict):
                ticker = retval.get("ticker")
            if not status:
                status = retval.get("status", "executed") if isinstance(retval, dict) else "executed"
            payload = {
                "type": "task_complete",
                "kind": kind,
                "ticker": ticker,
                "tickers": None,
                "status": status,
                "task_id": task_id,
            }

        r = redis.from_url(REDIS_URL)
        r.publish("task_events", json.dumps(payload))
        r.close()
    except Exception:
        # Never crash the worker
        pass
