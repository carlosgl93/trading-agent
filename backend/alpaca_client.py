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


def get_client_for_user(api_key: str, api_secret: str, paper: bool = True) -> TradingClient:
    """Create a non-cached TradingClient with per-user credentials."""
    return TradingClient(api_key=api_key, secret_key=api_secret, paper=paper)


def submit_order(ticker: str, side: str = "buy", notional: float = 100.0):
    """Submit a fractional notional market order. Returns Alpaca Order or None on error."""
    order_data = MarketOrderRequest(
        symbol=ticker,
        notional=notional,
        side=OrderSide.BUY if side == "buy" else OrderSide.SELL,
        time_in_force=TimeInForce.DAY,
    )
    return get_client().submit_order(order_data)


def submit_order_for_user(
    api_key: str,
    api_secret: str,
    ticker: str,
    side: str = "buy",
    notional: float = 100.0,
    paper: bool = True,
):
    """Submit a market order using per-user credentials."""
    client = get_client_for_user(api_key, api_secret, paper)
    order_data = MarketOrderRequest(
        symbol=ticker,
        notional=notional,
        side=OrderSide.BUY if side == "buy" else OrderSide.SELL,
        time_in_force=TimeInForce.DAY,
    )
    return client.submit_order(order_data)


def close_position(ticker: str):
    """Close position using env-level Alpaca credentials."""
    try:
        return get_client().close_position(ticker)
    except Exception as exc:
        if "position does not exist" in str(exc).lower() or "404" in str(exc):
            return None
        raise


def close_position_for_user(api_key: str, api_secret: str, ticker: str, paper: bool = True):
    """Close position using per-user credentials."""
    client = get_client_for_user(api_key, api_secret, paper)
    try:
        return client.close_position(ticker)
    except Exception as exc:
        if "position does not exist" in str(exc).lower() or "404" in str(exc):
            return None
        raise
