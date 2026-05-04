# TASK-009: backend/alpaca_client.py — Per-user Alpaca keys

**Status:** done
**Phase:** 4 — Vault
**Priority:** P1

## Description
Update `alpaca_client.py` to support per-user Alpaca keys alongside the existing env-based singleton. Add `get_client_for_user(api_key, api_secret)` factory that creates a non-cached client.

## Files
- `backend/alpaca_client.py`

## Acceptance Criteria
- [ ] Existing `get_client()` still works (backward-compatible for scheduler tasks)
- [ ] `get_client_for_user(key, secret, paper)` returns a fresh TradingClient
- [ ] `submit_order_for_user(key, secret, ticker, side, notional)` convenience wrapper
