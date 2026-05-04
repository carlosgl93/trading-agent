"""Stripe client and helpers.

Products / prices must be created manually in the Stripe Dashboard, then
their IDs set in the environment variables below.
"""

import os
from typing import Optional

import stripe

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")

WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
PRO_PRICE_ID = os.environ.get("STRIPE_PRO_PRICE_ID", "")
CREDIT_PACK_PRICE_ID = os.environ.get("STRIPE_CREDIT_PACK_PRICE_ID", "")
SUCCESS_URL = os.environ.get("STRIPE_SUCCESS_URL", "http://localhost:4321/?checkout=success")
CANCEL_URL = os.environ.get("STRIPE_CANCEL_URL", "http://localhost:4321/?checkout=cancelled")

# Credit amounts granted per event
CREDIT_PACK_AMOUNT = 10
PRO_MONTHLY_AMOUNT = 100


def get_or_create_customer(user_id: str, email: Optional[str] = None) -> str:
    """Return existing Stripe customer ID or create a new one."""
    from backend.db import get_user_settings, upsert_user_settings

    settings = get_user_settings(user_id)
    if settings and settings.get("stripe_customer_id"):
        return settings["stripe_customer_id"]

    create_kwargs: dict = {"metadata": {"user_id": user_id}}
    if email:
        create_kwargs["email"] = email
    customer = stripe.Customer.create(**create_kwargs)
    upsert_user_settings(user_id, stripe_customer_id=customer.id)
    return customer.id


def get_user_email_from_supabase(user_id: str) -> Optional[str]:
    """Fetch user email from Supabase Auth admin API."""
    from backend.db import get_client
    try:
        result = get_client().auth.admin.get_user_by_id(user_id)
        return result.user.email if result.user else None
    except Exception:
        return None
