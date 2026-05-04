# TASK-007: backend/main.py — Add auth to all routes + /credits endpoint

**Status:** done
**Phase:** 1 — Tenancy
**Priority:** P0

## Description
Add `user_id: str = Depends(get_current_user)` to all existing routes. Thread `user_id` into DB calls. Add `/credits` GET endpoint.

## Files
- `backend/main.py`

## Acceptance Criteria
- [ ] All existing routes return 401 without valid JWT
- [ ] `/credits` returns `{balance, transactions}` for authenticated user
- [ ] DB calls pass user_id to scope queries
