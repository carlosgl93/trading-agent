CREATE TABLE IF NOT EXISTS scouting_log (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    scout_date  DATE        NOT NULL,
    macro_context TEXT,
    tickers_json  JSONB     NOT NULL DEFAULT '[]',
    model_used  TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scouting_log_date_idx ON scouting_log (scout_date DESC);
