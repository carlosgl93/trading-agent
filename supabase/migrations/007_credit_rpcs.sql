-- Migration 007: Credit system RPC functions.
-- Atomic operations for credit balance management.

-- ── ensure_user_credits ───────────────────────────────────────────────────────
-- Idempotently creates the user_credits row for a user.

CREATE OR REPLACE FUNCTION ensure_user_credits(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO user_credits (user_id, balance)
    VALUES (p_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- ── debit_credit ──────────────────────────────────────────────────────────────
-- Atomically deducts 1 credit from user balance.
-- Returns TRUE if debit succeeded, FALSE if insufficient balance.

CREATE OR REPLACE FUNCTION debit_credit(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rows_updated INT;
BEGIN
    -- Ensure row exists
    PERFORM ensure_user_credits(p_user_id);

    UPDATE user_credits
    SET balance    = balance - 1,
        updated_at = now()
    WHERE user_id = p_user_id AND balance > 0;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    IF v_rows_updated > 0 THEN
        INSERT INTO credit_transactions (user_id, amount, transaction_type)
        VALUES (p_user_id, -1, 'analysis_debit');
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

-- ── credit_user ───────────────────────────────────────────────────────────────
-- Adds credits to a user's balance with idempotency on stripe_event_id.

CREATE OR REPLACE FUNCTION credit_user(
    p_user_id          UUID,
    p_amount           INTEGER,
    p_transaction_type TEXT,
    p_stripe_event_id  TEXT DEFAULT NULL,
    p_metadata         JSONB DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Skip if this Stripe event was already processed
    IF p_stripe_event_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM credit_transactions
            WHERE stripe_event_id = p_stripe_event_id
        ) THEN
            RETURN;
        END IF;
    END IF;

    -- Ensure credits row exists
    PERFORM ensure_user_credits(p_user_id);

    UPDATE user_credits
    SET balance    = balance + p_amount,
        updated_at = now()
    WHERE user_id = p_user_id;

    INSERT INTO credit_transactions
        (user_id, amount, transaction_type, stripe_event_id, metadata)
    VALUES
        (p_user_id, p_amount, p_transaction_type, p_stripe_event_id, p_metadata);
END;
$$;

-- ── grant_free_credits ────────────────────────────────────────────────────────
-- Called once on first login to grant the free tier allotment.

CREATE OR REPLACE FUNCTION grant_free_credits(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only grant if no prior transactions exist for this user
    IF NOT EXISTS (SELECT 1 FROM credit_transactions WHERE user_id = p_user_id) THEN
        PERFORM credit_user(p_user_id, 5, 'free_grant');
    END IF;
END;
$$;
