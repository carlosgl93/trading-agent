# TASK-005: backend/auth.py — JWT FastAPI dependency

**Status:** done
**Phase:** 1 — Tenancy
**Priority:** P0

## Description
Create `get_current_user` FastAPI dependency that extracts and validates `user_id` from Supabase JWT using `SUPABASE_JWT_SECRET`.

## Files
- `backend/auth.py` (new)

## Acceptance Criteria
- [ ] Raises 401 on missing/invalid/expired token
- [ ] Returns `user_id: str` (UUID string from `sub` claim)
- [ ] Uses PyJWT local verification (no network call per request)
