# TASK-015: .env + .env.example — New env vars

**Status:** done
**Phase:** 1 — Tenancy
**Priority:** P0

## Description
Add `SUPABASE_JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `STRIPE_CREDIT_PACK_PRICE_ID` to .env.example (with placeholders) and document in README.

## Files
- `.env.example`

## Acceptance Criteria
- [ ] All new vars present in .env.example with placeholder values + comments
- [ ] .env.example is the canonical reference for required config
