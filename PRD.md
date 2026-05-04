# TradingAgents SaaS — PRD

## Summary

Multi-tenant SaaS platform built on the existing TradingAgents codebase.
Retail traders and developers run AI-powered stock analysis on their own
Alpaca paper/live accounts through a self-serve web dashboard.
Monetization via hybrid tiered subscriptions + credit top-ups.

---

## 1. Target Customers

| Segment | Description | Acquisition |
|---|---|---|
| **Primary** | Individual retail traders | Self-serve, credit card, free tier acquisition |
| **Secondary** | Quants / developers | API-first, credit packs, pay-per-use |

---

## 2. Pricing Tiers

| Tier | Price | Credits / month | Overage |
|---|---|---|---|
| **Free** | $0 | 5 analyses | — |
| **Pro** | $49/mo | 100 analyses | Credit packs at $5 (10 analyses) |
| **Developer API** | Credits only | — | Credit packs at $5 (10 analyses) |

Credit pack: $5.00 for 10 analysis credits ($0.50 each).

---

## 3. Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Auth | Supabase Auth (magic link + Google/GitHub OAuth) | Native `auth.uid()` in RLS, already in stack |
| Tenancy | Row-level (`user_id` UUID on all tables) | Cheapest, fastest, works for 10k+ users |
| Payments | Stripe (subscriptions + one-time credit packs) | Industry standard, best docs, Chile supported |
| Credit system | `user_credits` table in Supabase, updated via Stripe webhooks | Simple, auditable, you control it |
| Webhook delivery | Stripe CLI in dev → direct POST to FastAPI in prod | Single runtime, no edge functions needed |
| Credit debit | Atomic `UPDATE` in Celery task start | Prevents races, 402 if balance = 0 |
| Broker keys | Supabase Vault (per user) | Encrypted at rest, no custom crypto code |
| Migration | Hard reset — drop + recreate tables | Single user, test data, cleanest schema |
| Billing UI | Stripe Customer Portal via backend `POST /billing/portal` | Stripe handles the UI, backend generates session URL |

---

## 4. Database Schema Changes

### 4.1 Modified Tables

All existing tables gain a `user_id UUID NOT NULL REFERENCES auth.users(id)` column.

| Table | New columns | RLS Policy |
|---|---|---|
| `trading_logs` | `user_id UUID NOT NULL` | `auth.uid() = user_id` |
| `portfolio_positions` | `user_id UUID NOT NULL` | `auth.uid() = user_id` |
| `scouting_log` | `user_id UUID NOT NULL` | `auth.uid() = user_id` |

### 4.2 New Tables

```sql
-- Credit balance per user
CREATE TABLE user_credits (
    user_id     UUID PRIMARY KEY REFERENCES auth.users(id),
    balance     INTEGER NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own credits" ON user_credits
    FOR SELECT USING (auth.uid() = user_id);

-- Audit trail for every credit mutation
CREATE TABLE credit_transactions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES auth.users(id),
    amount        INTEGER NOT NULL,
    transaction_type TEXT NOT NULL,  -- 'purchase', 'subscription_refill', 'analysis_debit', 'refund', 'free_grant'
    stripe_event_id TEXT,
    metadata      JSONB DEFAULT '{}',
    created_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own transactions" ON credit_transactions
    FOR SELECT USING (auth.uid() = user_id);

-- User settings (Stripe customer_id, Alpaca vault reference)
CREATE TABLE user_settings (
    user_id             UUID PRIMARY KEY REFERENCES auth.users(id),
    stripe_customer_id  TEXT,
    alpaca_vault_key_id UUID,         -- references vault.secret_id
    tier                TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'pro' | 'developer'
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own settings" ON user_settings
    FOR SELECT USING (auth.uid() = user_id);
```

### 4.3 Supabase Vault Usage

Per user:
```
vault.create_secret(name='alpaca_key_{user_id}', secret=api_key)
vault.create_secret(name='alpaca_secret_{user_id}', secret=api_secret)
```

Retrieved at task execution time via service-role SQL:
```sql
SELECT decrypted_secret FROM vault.decrypted_secrets
WHERE name IN ('alpaca_key_{user_id}', 'alpaca_secret_{user_id}');
```

---

## 5. API Endpoints (New / Modified)

### 5.1 Auth-Required Endpoints

All existing endpoints become auth-required. Middleware or dependency extracts `user_id` from Supabase JWT.

| Endpoint | Method | Auth | Note |
|---|---|---|---|
| `/results` | GET | Required | Scoped to `auth.uid()` via RLS |
| `/results/{log_id}` | GET | Required | RLS-enforced |
| `/positions` | GET | Required | RLS-enforced |
| `/test-task/{ticker}` | POST | Required | Queues Celery task for `auth.uid()` |
| `/run-sequence` | POST | Required | Chains tasks for `auth.uid()` |
| `/review-positions` | POST | Required | Dispatches review for user's open positions |
| `/scout` | POST | Required | Scouts tickers for `auth.uid()` |
| `/scout-history` | GET | Required | RLS-enforced |
| `/trade/{ticker}` | POST | Required | Uses user's vault-stored Alpaca keys |

### 5.2 New Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/webhooks/stripe` | POST | Receives Stripe events, verifies signature, updates `user_credits` |
| `/billing/portal` | POST | Creates Stripe Customer Portal session, returns URL |
| `/credits` | GET | Returns user's credit balance + recent transactions |
| `/settings/alpaca` | POST | Stores Alpaca API key + secret in Vault |
| `/checkout/subscription/{tier}` | POST | Creates Stripe Checkout Session for Pro subscription |
| `/checkout/credits` | POST | Creates Stripe Checkout Session for credit pack purchase |

---

## 6. Celery Task Flow

```
analyze_and_trade(ticker, analysis_date, user_id, paid)
  │
  ├─ 1. Atomic credit debit
  │     UPDATE user_credits
  │     SET balance = balance - 1
  │     WHERE user_id = {user_id} AND balance > 0
  │     RETURNING balance
  │     → if no rows returned → return {"status": "insufficient_credits"}
  │
  ├─ 2. Log credit_transaction (type='analysis_debit', amount=-1)
  │
  ├─ 3. Retrieve Alpaca keys from Vault
  │     SELECT decrypted_secret FROM vault.decrypted_secrets
  │     WHERE name IN ('alpaca_key_{user_id}', 'alpaca_secret_{user_id}')
  │
  ├─ 4. Run LLM analysis pipeline (existing logic, scoped to user_id)
  │
  ├─ 5. Execute trade on user's Alpaca account
  │
  ├─ 6. Insert trading_logs row with user_id
  │
  └─ 7. Publish task_complete WS event
```

Pro users get auto-refill: Stripe `invoice.paid` webhook for subscription →
upsert `user_credits SET balance = balance + 100`, log `credit_transactions`
(`type='subscription_refill'`).

---

## 7. Stripe Webhook Events Handled

| Event | Action |
|---|---|
| `checkout.session.completed` | Grant credits from one-time purchase or subscription |
| `invoice.paid` | Monthly Pro credit refill (100 credits) |
| `customer.subscription.updated` | Sync tier in `user_settings` |
| `customer.subscription.deleted` | Downgrade to free tier |
| `invoice.payment_failed` | Notify user, could suspend analysis |

---

## 8. Frontend Changes

### 8.1 Auth
- Supabase Auth UI (magic link + Google/GitHub OAuth buttons)
- Auth guard on all pages/routes
- Session persistence via Supabase client

### 8.2 New Components
- **CreditBalance** — shows remaining credits, links to top-up
- **BillingSettings** — Stripe Customer Portal link, current tier badge, upgrade CTA
- **AlpacaKeyForm** — input for API key + secret (stored via Vault)
- **PricingPage** — tier comparison, upgrade/downgrade flow

### 8.3 Modified Components
- **ExecutionLogs** — scoped to user's logs (automatic via RLS)
- **ScoutPanel** — disable scout button when credits = 0, show "Out of credits" state
- **AnalysisEngine** — show credit cost per run, warning when low
- **Header/Nav** — user avatar, credit display, settings link, sign out

---

## 9. Implementation Order

| Phase | Items | Est. effort |
|---|---|---|
| **Phase 1: Tenancy** | Migration (hard reset), `user_id` on all tables, RLS policies, auth middleware | 1 day |
| **Phase 2: Credits** | `user_credits` + `credit_transactions` tables, atomic debit in Celery task, credit API | 1 day |
| **Phase 3: Stripe** | Stripe product/customer setup, `/webhooks/stripe`, Checkout + Customer Portal, Stripe CLI dev flow | 1–2 days |
| **Phase 4: Vault** | Supabase Vault setup, `/settings/alpaca` endpoint, task-time credential retrieval | 1 day |
| **Phase 5: Frontend** | Auth UI, credit display, billing settings, pricing page, Alpaca key form | 2 days |
| **Phase 6: Polish** | Error states, 402 handling, refetch on credits change, WS events for credit updates | 1 day |

**Total: ~7–8 days for full SaaS readiness.**

---

## 10. Open Questions (for future)

- Chilean local payment methods (MercadoPago) — v2
- Team/org accounts — v2
- SOC 2 / compliance — enterprise tier
- Self-hosted deployment option — developer segment
- Usage analytics dashboard for users — v2