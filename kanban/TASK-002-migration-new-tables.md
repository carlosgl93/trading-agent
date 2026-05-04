# TASK-002: SQL Migration — New SaaS tables

**Status:** done
**Phase:** 1 — Tenancy
**Priority:** P0

## Description
Create `user_credits`, `credit_transactions`, and `user_settings` tables with RLS policies.

## Files
- `migrations/005_saas_tables.sql`

## Acceptance Criteria
- [ ] `user_credits` table with balance + RLS
- [ ] `credit_transactions` audit table with RLS
- [ ] `user_settings` table with stripe_customer_id, alpaca_vault_key_id, tier + RLS
