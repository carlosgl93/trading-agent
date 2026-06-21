-- Run this in your Supabase SQL editor to create the trading_logs table.

CREATE TABLE IF NOT EXISTS trading_logs (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker      text        NOT NULL,
    analysis_date date      NOT NULL,
    rating      text,                      -- Buy | Overweight | Hold | Underweight | Sell | null (on error)
    reasoning   text        DEFAULT '',    -- Truncated Portfolio Manager decision
    model_used  text        DEFAULT '',    -- OpenRouter model identifier
    alpaca_order_id text,                  -- Alpaca order UUID if a trade was placed
    execution_status text   NOT NULL DEFAULT 'pending',  -- pending | executed | skipped | failed
    raw_report  jsonb       DEFAULT '{}',  -- Full final graph state snapshot
    created_at  timestamptz DEFAULT now()
);

-- Index for the /results endpoint (latest-first, per-ticker queries)
CREATE INDEX IF NOT EXISTS idx_trading_logs_created_at ON trading_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trading_logs_ticker     ON trading_logs (ticker);

-- Optional: enable Row Level Security and grant anon read access
ALTER TABLE trading_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read" ON trading_logs
    FOR SELECT USING (true);

-- Service role (used by the backend) bypasses RLS automatically.
