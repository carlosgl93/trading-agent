# TASK-013: backend/main.py — Checkout sessions + billing portal

**Status:** done
**Phase:** 3 — Stripe
**Priority:** P1

## Description
Add `POST /checkout/subscription/{tier}`, `POST /checkout/credits`, and `POST /billing/portal` endpoints. Each creates a Stripe session and returns the URL.

## Files
- `backend/main.py`

## Acceptance Criteria
- [ ] `/checkout/subscription/pro` → Stripe Checkout URL for Pro monthly
- [ ] `/checkout/credits` → Stripe Checkout URL for $5 credit pack
- [ ] `/billing/portal` → Stripe Customer Portal URL
- [ ] All require auth, use/create Stripe customer for user
