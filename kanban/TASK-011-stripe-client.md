# TASK-011: backend/stripe_client.py — Stripe client setup

**Status:** done
**Phase:** 3 — Stripe
**Priority:** P1

## Description
Create `backend/stripe_client.py` with Stripe initialization and product/price ID constants. Defines IDs for Pro subscription and credit pack.

## Files
- `backend/stripe_client.py` (new)

## Acceptance Criteria
- [ ] Stripe initialized from `STRIPE_SECRET_KEY`
- [ ] `PRO_PRICE_ID` and `CREDIT_PACK_PRICE_ID` constants (from env)
- [ ] `get_or_create_customer(user_id, email)` helper
