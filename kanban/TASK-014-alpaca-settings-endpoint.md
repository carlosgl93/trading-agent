# TASK-014: backend/main.py — /settings/alpaca endpoint

**Status:** done
**Phase:** 4 — Vault
**Priority:** P1

## Description
Add `POST /settings/alpaca` that accepts `{api_key, api_secret, paper}` and stores them in Supabase Vault for the authenticated user.

## Files
- `backend/main.py`

## Acceptance Criteria
- [ ] Validates key/secret are non-empty
- [ ] Calls `vault.store_alpaca_keys(user_id, key, secret)`
- [ ] Updates `user_settings.alpaca_configured = true`
- [ ] Returns 200 on success
