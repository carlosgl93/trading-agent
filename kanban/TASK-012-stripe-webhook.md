# TASK-012: backend/main.py — /webhooks/stripe endpoint

**Status:** done
**Phase:** 3 — Stripe
**Priority:** P1

## Description
Implement `POST /webhooks/stripe` that verifies Stripe signature and handles: `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`.

## Files
- `backend/main.py`

## Acceptance Criteria
- [ ] Signature verified with `STRIPE_WEBHOOK_SECRET` — returns 400 on failure
- [ ] `checkout.session.completed` → credit user + update tier
- [ ] `invoice.paid` → refill 100 credits for Pro subscribers
- [ ] `customer.subscription.deleted` → downgrade to free tier
- [ ] Idempotent (check `stripe_event_id` in credit_transactions before crediting)
