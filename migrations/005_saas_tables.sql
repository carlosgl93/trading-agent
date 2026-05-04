-- Migration 005: Create SaaS tables — user_credits, credit_transactions, user_settings.

-- ── user_credits ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_credits (
    user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    balance    INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_credits' AND policyname = 'Users read own credits'
  ) THEN
    CREATE POLICY "Users read own credits" ON user_credits
        FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── credit_transactions ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS credit_transactions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount           INTEGER NOT NULL,
    transaction_type TEXT NOT NULL,   -- purchase | subscription_refill | analysis_debit | refund | free_grant
    stripe_event_id  TEXT,            -- idempotency key from Stripe webhooks
    metadata         JSONB DEFAULT '{}',
    created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'credit_transactions' AND policyname = 'Users read own transactions'
  ) THEN
    CREATE POLICY "Users read own transactions" ON credit_transactions
        FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_stripe_event ON credit_transactions (stripe_event_id)
    WHERE stripe_event_id IS NOT NULL;

-- ── user_settings ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_settings (
    user_id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id   TEXT,
    alpaca_vault_key_id  UUID,           -- references vault secret UUID
    alpaca_configured    BOOLEAN NOT NULL DEFAULT false,
    tier                 TEXT NOT NULL DEFAULT 'free',  -- free | pro | developer
    created_at           TIMESTAMPTZ DEFAULT now(),
    updated_at           TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_settings' AND policyname = 'Users read own settings'
  ) THEN
    CREATE POLICY "Users read own settings" ON user_settings
        FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
