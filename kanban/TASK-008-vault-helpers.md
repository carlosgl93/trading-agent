# TASK-008: backend/vault.py — Vault helper functions

**Status:** done
**Phase:** 4 — Vault
**Priority:** P1

## Description
Create Python helpers that call the `store_alpaca_keys` and `get_alpaca_keys` RPC functions in Supabase.

## Files
- `backend/vault.py` (new)

## Acceptance Criteria
- [ ] `store_alpaca_keys(user_id, api_key, api_secret)` calls RPC
- [ ] `get_alpaca_keys(user_id)` → `(key, secret)` tuple or raises
- [ ] Uses service role client
