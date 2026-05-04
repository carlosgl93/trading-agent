# TASK-001: SQL Migration — Add user_id to existing tables

**Status:** done
**Phase:** 1 — Tenancy
**Priority:** P0

## Description
Add `user_id UUID NOT NULL REFERENCES auth.users(id)` to `trading_logs`, `portfolio_positions`, and `scouting_log`. Drop open anonymous RLS policies and replace with user-scoped policies.

## Files
- `migrations/004_add_user_id.sql`

## Acceptance Criteria
- [ ] All three tables have `user_id` column
- [ ] RLS policies updated: `auth.uid() = user_id`
- [ ] Migration is idempotent (IF NOT EXISTS / DO $$)
