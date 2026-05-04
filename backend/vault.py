"""Supabase Vault helpers for per-user Alpaca credential storage.

Calls the store_alpaca_keys / get_alpaca_keys RPC functions defined in
migrations/006_vault_helpers.sql — those run as SECURITY DEFINER so only
the service-role client can invoke them.
"""

from backend.db import get_client


def store_alpaca_keys(user_id: str, api_key: str, api_secret: str) -> None:
    get_client().rpc("store_alpaca_keys", {
        "p_user_id": user_id,
        "p_key": api_key,
        "p_secret": api_secret,
    }).execute()


def get_alpaca_keys(user_id: str) -> tuple[str, str]:
    """Return (api_key, api_secret) from Vault, or raise ValueError if not stored."""
    result = get_client().rpc("get_alpaca_keys", {"p_user_id": user_id}).execute()
    if result.data:
        row = result.data[0]
        key = row.get("api_key")
        secret = row.get("api_secret")
        if key and secret:
            return key, secret
    raise ValueError(f"No Alpaca keys stored for user {user_id}")
