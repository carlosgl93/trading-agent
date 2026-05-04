# TASK-003: SQL Migration — Vault helper RPCs

**Status:** done
**Phase:** 4 — Vault
**Priority:** P1

## Description
Create `store_alpaca_keys` and `get_alpaca_keys` RPC functions in Supabase that wrap vault operations. The service role calls these via `.rpc()`.

## Files
- `migrations/006_vault_helpers.sql`

## Acceptance Criteria
- [ ] `store_alpaca_keys(p_user_id, p_key, p_secret)` creates/updates vault secrets
- [ ] `get_alpaca_keys(p_user_id)` returns `{key, secret}` or null
- [ ] Functions only callable by service role (SECURITY DEFINER)
