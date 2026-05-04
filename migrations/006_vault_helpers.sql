-- Migration 006: Vault helper RPC functions for Alpaca key storage.
-- These are called by the backend service role; they use SECURITY DEFINER
-- so the vault operations run as the postgres superuser.

-- ── store_alpaca_keys ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION store_alpaca_keys(
    p_user_id UUID,
    p_key     TEXT,
    p_secret  TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
    v_key_name    TEXT := 'alpaca_key_' || p_user_id::TEXT;
    v_secret_name TEXT := 'alpaca_secret_' || p_user_id::TEXT;
    v_existing_key_id   UUID;
    v_existing_secret_id UUID;
BEGIN
    -- Upsert API key secret
    SELECT id INTO v_existing_key_id
    FROM vault.secrets WHERE name = v_key_name LIMIT 1;

    IF v_existing_key_id IS NOT NULL THEN
        UPDATE vault.secrets SET secret = p_key WHERE id = v_existing_key_id;
    ELSE
        v_existing_key_id := vault.create_secret(p_key, v_key_name);
    END IF;

    -- Upsert API secret secret
    SELECT id INTO v_existing_secret_id
    FROM vault.secrets WHERE name = v_secret_name LIMIT 1;

    IF v_existing_secret_id IS NOT NULL THEN
        UPDATE vault.secrets SET secret = p_secret WHERE id = v_existing_secret_id;
    ELSE
        v_existing_secret_id := vault.create_secret(p_secret, v_secret_name);
    END IF;

    -- Track vault key IDs in user_settings
    INSERT INTO user_settings (user_id, alpaca_vault_key_id, alpaca_configured, updated_at)
    VALUES (p_user_id, v_existing_key_id, true, now())
    ON CONFLICT (user_id) DO UPDATE
        SET alpaca_vault_key_id = v_existing_key_id,
            alpaca_configured   = true,
            updated_at          = now();
END;
$$;

-- ── get_alpaca_keys ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_alpaca_keys(p_user_id UUID)
RETURNS TABLE(api_key TEXT, api_secret TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
    v_key_name    TEXT := 'alpaca_key_' || p_user_id::TEXT;
    v_secret_name TEXT := 'alpaca_secret_' || p_user_id::TEXT;
BEGIN
    RETURN QUERY
    SELECT
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = v_key_name LIMIT 1),
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = v_secret_name LIMIT 1);
END;
$$;
