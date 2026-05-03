import os
from typing import Optional

from alpaca.trading.client import TradingClient
from alpaca.trading.enums import OrderSide, TimeInForce
from alpaca.trading.requests import MarketOrderRequest

_client: Optional[TradingClient] = None


def get_client() -> TradingClient:
    global _client
    if _client is None:
        _client = TradingClient(
            api_key=os.environ["ALPACA_API_KEY"],
            secret_key=os.environ["ALPACA_API_SECRET"],
            paper=os.environ.get("ALPACA_PAPER", "true").lower() == "true",
        )
    return _client


def submit_order(ticker: str, side: str = "buy", notional: float = 100.0):
    """Submit a fractional notional market order. Returns Alpaca Order or None on error."""
    order_data = MarketOrderRequest(
        symbol=ticker,
        notional=notional,
        side=OrderSide.BUY if side == "buy" else OrderSide.SELL,
        time_in_force=TimeInForce.DAY,
    )
    return get_client().submit_order(order_data)


def close_position(ticker: str):
    """Close the entire open position for ticker using Alpaca's close-position endpoint.

    This avoids the fractional-share rounding mismatch that occurs when submitting
    a notional sell: Alpaca's own endpoint always uses the exact held quantity.
    Returns the closing Order or None if no position exists.
    """
    try:
        return get_client().close_position(ticker)
    except Exception as exc:
        if "position does not exist" in str(exc).lower() or "404" in str(exc):
            return None
        raise
