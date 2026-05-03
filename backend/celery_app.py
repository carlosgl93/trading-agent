import os
from celery import Celery
from kombu import Queue

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
