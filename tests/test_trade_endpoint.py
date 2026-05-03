"""Unit tests for the POST /trade/{ticker} manual-order endpoint.

We stub the heavy transitive deps (Celery tasks, DB, full tradingagents
graph) in sys.modules before importing backend.main so the test runs
without the full LangChain/yfinance stack.
"""

import sys
from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Stub heavy transitive dependencies before importing backend.main
# ---------------------------------------------------------------------------
for _stub in (
    "backend.db",
    "backend.tasks",
    "backend.review_task",
    "backend.scout_task",
):
    sys.modules.setdefault(_stub, MagicMock())

from fastapi.testclient import TestClient  # noqa: E402
from backend.main import app  # noqa: E402

_client = TestClient(app)


def _mock_order(order_id: str = "abc-123", status: str = "accepted") -> MagicMock:
    order = MagicMock()
    order.id = order_id
    order.status = status
    return order


@pytest.mark.unit
class TestManualTradeEndpoint:
    # ------------------------------------------------------------------
    # Tracer bullet: the core fix — wash trade → 409
    # ------------------------------------------------------------------

    def test_wash_trade_returns_409(self):
        """Alpaca wash-trade rejection (code 40310000) must surface as 409."""
        with patch(
            "backend.main.submit_order",
            side_effect=Exception('{"code":40310000,"message":"potential wash trade detected"}'),
        ):
            res = _client.post("/trade/AAPL?side=sell&notional=100")

        assert res.status_code == 409
        assert "wash trade" in res.json()["detail"].lower()

    def test_generic_error_returns_502(self):
        """Non-wash-trade exceptions must remain 502 Bad Gateway."""
        with patch(
            "backend.main.submit_order",
            side_effect=Exception("connection timeout"),
        ):
            res = _client.post("/trade/AAPL?side=buy&notional=100")

        assert res.status_code == 502

    def test_close_existing_position_returns_200(self):
        """Closing an open position returns 200 with the Alpaca order data."""
        order = _mock_order(order_id="order-xyz", status="pending_cancel")
        with patch("backend.main.alpaca_close_position", return_value=order):
            res = _client.post("/trade/AAPL?side=close")

        assert res.status_code == 200
        data = res.json()
        assert data["order_id"] == "order-xyz"
        assert data["alpaca_status"] == "pending_cancel"
        assert data["side"] == "close"

    def test_close_no_position_returns_no_position_status(self):
        """side=close with no open position returns 200 with alpaca_status=no_position."""
        with patch("backend.main.alpaca_close_position", return_value=None):
            res = _client.post("/trade/AAPL?side=close")

        assert res.status_code == 200
        assert res.json()["alpaca_status"] == "no_position"

    def test_invalid_side_returns_400(self):
        """Unrecognised side value is rejected before hitting Alpaca."""
        res = _client.post("/trade/AAPL?side=flip&notional=100")

        assert res.status_code == 400
