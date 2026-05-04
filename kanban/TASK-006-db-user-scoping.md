# TASK-006: backend/db.py — Add user_id to all DB functions + credit helpers

**Status:** done
**Phase:** 1 — Tenancy
**Priority:** P0

## Description
Update all existing DB functions to accept `user_id` parameter and include it in queries/inserts. Add new credit functions: `debit_credit`, `credit_user`, `get_credit_balance`, `get_credit_transactions`, `get_or_create_user_settings`.

## Files
- `backend/db.py`

## Acceptance Criteria
- [ ] `log_trade`, `open_position`, `close_position`, `get_latest_results`, `get_open_positions`, `log_scouting`, `get_scouting_log` all accept `user_id`
- [ ] `debit_credit(user_id)` → bool (atomic UPDATE, returns False if balance=0)
- [ ] `credit_user(user_id, amount, type, stripe_event_id)` → inserts credit_transaction + updates balance
- [ ] `get_credit_balance(user_id)` → int
