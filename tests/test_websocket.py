"""
WebSocket real-time task events — behavioral tests.

All tests use FastAPI's sync TestClient (WebSocket support built-in).
The Redis async client is mocked with an AsyncMock whose pubsub.listen()
blocks forever (via asyncio.Future) so the handler stays alive during tests.
"""
import asyncio
import json
import sys
from unittest.mock import AsyncMock, MagicMock, patch, call

import pytest

# Stub heavy transitive deps before importing backend.main
for _stub in ("backend.db", "backend.tasks", "backend.review_task", "backend.scout_task"):
    sys.modules.setdefault(_stub, MagicMock())

from fastapi.testclient import TestClient  # noqa: E402
from backend.main import app              # noqa: E402
from backend.celery_app import on_task_postrun  # noqa: E402

_client = TestClient(app)


# ---------------------------------------------------------------------------
# Shared fixture — builds a controllable async Redis mock
# ---------------------------------------------------------------------------

class _PubSubMock:
    """Fake pubsub that yields a given sequence of messages then blocks."""
    def __init__(self, messages=()):
        self._messages = list(messages)
        self.subscribed_channels: list = []
        self._unsubscribed = False

    async def subscribe(self, *channels):
        self.subscribed_channels.extend(channels)

    async def unsubscribe(self, *channels):
        self._unsubscribed = True

    async def listen(self):
        for msg in self._messages:
            yield msg
        # Block forever so the handler doesn't exit prematurely
        await asyncio.Future()


@pytest.fixture()
def ws_redis(monkeypatch):
    """Patches aioredis.from_url in main to return a controllable mock.

    r.pubsub() is called synchronously in the handler, so we use a plain
    MagicMock for that method. r.aclose() is awaited, so it stays AsyncMock.
    """
    import backend.main as backend_main

    pubsub = _PubSubMock()
    fake_redis = MagicMock()
    fake_redis.pubsub = MagicMock(return_value=pubsub)
    fake_redis.aclose = AsyncMock()
    # backend.main.aioredis IS redis.asyncio module — patch on the object
    monkeypatch.setattr(backend_main.aioredis, "from_url", lambda *_a, **_kw: fake_redis)
    return pubsub


# ---------------------------------------------------------------------------
# 1. Connection handshake
# ---------------------------------------------------------------------------

@pytest.mark.smoke
def test_ws_connected_message_on_handshake(ws_redis):
    """Connecting to /ws immediately receives {"type": "connected"}."""
    with _client.websocket_connect("/ws") as ws:
        msg = ws.receive_json()
        assert msg == {"type": "connected"}


# ---------------------------------------------------------------------------
# 2. Event forwarding: Redis message → WebSocket client
# ---------------------------------------------------------------------------

@pytest.mark.unit
def test_ws_forwards_redis_message_to_client(monkeypatch):
    """A task_complete event published to Redis is forwarded to the WS client."""
    import backend.main as backend_main

    event = {
        "type": "task_complete", "kind": "analysis",
        "ticker": "NVDA", "tickers": None,
        "status": "executed", "task_id": "test-123",
    }
    pubsub = _PubSubMock(messages=[
        {"type": "message", "data": json.dumps(event)},
    ])
    fake_redis = MagicMock()
    fake_redis.pubsub = MagicMock(return_value=pubsub)
    fake_redis.aclose = AsyncMock()
    monkeypatch.setattr(backend_main.aioredis, "from_url", lambda *_a, **_kw: fake_redis)

    with _client.websocket_connect("/ws") as ws:
        ws.receive_json()           # discard "connected"
        forwarded = ws.receive_json()

    assert forwarded == event


# ---------------------------------------------------------------------------
# 3. @task_postrun: analyze_and_trade → kind="analysis" payload
# ---------------------------------------------------------------------------

@pytest.mark.unit
def test_postrun_analysis_task_publishes_correct_payload():
    """on_task_postrun for analyze_and_trade publishes kind=analysis with ticker."""
    task = MagicMock()
    task.name = "backend.tasks.analyze_and_trade"

    with patch("backend.celery_app.redis.from_url") as mock_from_url:
        mock_redis = MagicMock()
        mock_from_url.return_value = mock_redis

        on_task_postrun(
            task_id="abc-111",
            task=task,
            retval={"ticker": "AAPL", "rating": "Buy", "status": "executed"},
            state="SUCCESS",
            kwargs={"ticker": "AAPL"},
        )

    published = json.loads(mock_redis.publish.call_args[0][1])
    assert published["type"] == "task_complete"
    assert published["kind"] == "analysis"
    assert published["ticker"] == "AAPL"
    assert published["status"] == "executed"
    assert published["task_id"] == "abc-111"


# ---------------------------------------------------------------------------
# 4. @task_postrun: scout_tickers → kind="scout" with tickers list
# ---------------------------------------------------------------------------

@pytest.mark.unit
def test_postrun_scout_task_publishes_tickers_list():
    """on_task_postrun for scout_tickers publishes kind=scout with tickers."""
    task = MagicMock()
    task.name = "backend.scout_task.scout_tickers"

    retval = [
        {"ticker": "NVDA", "sector": "Technology", "thesis": "AI", "conviction": 5},
        {"ticker": "LLY", "sector": "Healthcare", "thesis": "GLP-1", "conviction": 4},
    ]

    with patch("backend.celery_app.redis.from_url") as mock_from_url:
        mock_redis = MagicMock()
        mock_from_url.return_value = mock_redis

        on_task_postrun(
            task_id="abc-222",
            task=task,
            retval=retval,
            state="SUCCESS",
            kwargs={},
        )

    published = json.loads(mock_redis.publish.call_args[0][1])
    assert published["kind"] == "scout"
    assert published["tickers"] == ["NVDA", "LLY"]
    assert published["ticker"] is None
    assert published["status"] == "scouting"


# ---------------------------------------------------------------------------
# 5. @task_postrun: FAILURE state → status="failed"
# ---------------------------------------------------------------------------

@pytest.mark.unit
def test_postrun_failure_state_maps_to_failed_status():
    """state=FAILURE always produces status=failed regardless of task kind."""
    task = MagicMock()
    task.name = "backend.tasks.analyze_and_trade"

    with patch("backend.celery_app.redis.from_url") as mock_from_url:
        mock_redis = MagicMock()
        mock_from_url.return_value = mock_redis

        on_task_postrun(
            task_id="abc-333",
            task=task,
            retval=Exception("LLM timeout"),
            state="FAILURE",
            kwargs={"ticker": "TSLA"},
        )

    published = json.loads(mock_redis.publish.call_args[0][1])
    assert published["status"] == "failed"


# ---------------------------------------------------------------------------
# 6. @task_postrun: exception safety — Redis down never crashes worker
# ---------------------------------------------------------------------------

@pytest.mark.unit
def test_postrun_exception_never_propagates():
    """If Redis is unreachable, on_task_postrun swallows the exception silently."""
    task = MagicMock()
    task.name = "backend.tasks.analyze_and_trade"

    with patch("backend.celery_app.redis.from_url", side_effect=ConnectionError("Redis down")):
        # Must not raise
        on_task_postrun(
            task_id="abc-444",
            task=task,
            retval={"ticker": "MSFT", "status": "executed"},
            state="SUCCESS",
            kwargs={"ticker": "MSFT"},
        )
