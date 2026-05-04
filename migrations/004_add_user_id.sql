-- Migration 004: Add user_id to existing tables for multi-tenancy.
-- Run in Supabase SQL editor (service role / postgres).

-- ── trading_logs ─────────────────────────────────────────────────────────────

ALTER TABLE trading_logs
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Backfill existing rows to a sentinel so NOT NULL can be enforced later.
-- In prod you would UPDATE with the real owner's UUID before adding NOT NULL.

-- Drop the open anonymous read policy and replace with user-scoped policy.
DROP POLICY IF EXISTS "Allow anon read" ON trading_logs;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trading_logs' AND policyname = 'Users access own logs'
  ) THEN
    CREATE POLICY "Users access own logs" ON trading_logs
        FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_trading_logs_user_id ON trading_logs (user_id);

-- ── portfolio_positions ───────────────────────────────────────────────────────

ALTER TABLE portfolio_positions
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

DROP POLICY IF EXISTS "Allow anon read" ON portfolio_positions;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'portfolio_positions' AND policyname = 'Users access own positions'
  ) THEN
    CREATE POLICY "Users access own positions" ON portfolio_positions
        FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_portfolio_positions_user_id ON portfolio_positions (user_id);

-- ── scouting_log ──────────────────────────────────────────────────────────────

ALTER TABLE scouting_log
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

DROP POLICY IF EXISTS "Allow anon read" ON scouting_log;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'scouting_log' AND policyname = 'Users access own scouts'
  ) THEN
    CREATE POLICY "Users access own scouts" ON scouting_log
        FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_scouting_log_user_id ON scouting_log (user_id);
