CREATE TABLE IF NOT EXISTS portfolio_positions (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker          text        NOT NULL,
    direction       text        NOT NULL DEFAULT 'long',  -- 'long' | 'short'
    entry_rating    text        NOT NULL,                 -- Buy | Overweight | Sell | Underweight
    entry_date      date        NOT NULL,
    entry_order_id  text,
    exit_order_id   text,
    exit_date       date,
    exit_rating     text,
    status          text        NOT NULL DEFAULT 'open',  -- 'open' | 'closed'
    last_reviewed_at timestamptz,
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_status  ON portfolio_positions (status);
CREATE INDEX IF NOT EXISTS idx_portfolio_ticker  ON portfolio_positions (ticker);

ALTER TABLE portfolio_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON portfolio_positions FOR SELECT USING (true);
