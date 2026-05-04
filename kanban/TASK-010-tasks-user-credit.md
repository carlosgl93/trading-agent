# TASK-010: backend/tasks.py — Add user_id + credit debit + vault keys

**Status:** done
**Phase:** 2 — Credits
**Priority:** P0

## Description
Add `user_id` parameter to `analyze_and_trade`. Debit 1 credit atomically before running. Retrieve user Alpaca keys from vault. Pass user_id to all DB calls.

## Files
- `backend/tasks.py`

## Acceptance Criteria
- [ ] Task accepts `user_id` kwarg
- [ ] Returns `{"status": "insufficient_credits"}` if debit fails
- [ ] Uses vault-stored Alpaca keys when user_id provided, falls back to env keys
- [ ] All DB calls include user_id
