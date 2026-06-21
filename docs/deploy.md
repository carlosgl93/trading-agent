# Deploy Runbook

Step-by-step deploy of the TradingAgents multi-tenant stack to Fly.io + Vercel using the free tier of each.

## Prerequisites

- `flyctl` CLI installed and authenticated (`fly auth login`)
- `supabase` CLI installed and authenticated (`supabase login`)
- A Supabase project (free tier) with `vault` extension enabled
- API keys for at least OpenRouter; Stripe test keys are optional for the POC

## 0. Supabase setup

```bash
supabase link --project-ref <your-project-ref>
supabase db push --include-all
```

Applies all 7 migrations in `supabase/migrations/`. Idempotent — safe to re-run.

Capture from the Supabase dashboard (Settings → API):
- `SUPABASE_URL` — project URL
- `SUPABASE_ANON_KEY` — public anon JWT
- `SUPABASE_SERVICE_KEY` — service_role JWT (admin, bypasses RLS)
- `SUPABASE_JWT_SECRET` — legacy JWT secret (HS256)

## 1. Fly.io backend

### First-time launch

```bash
cd /path/to/TradingAgents
fly launch --no-deploy
```

`fly launch` reads `fly.toml` (already committed) and creates the app `tradingagents-api` in the `personal` org. Refuse any prompt to modify the existing `fly.toml` (answer "No" or pass `--copy-config`).

### Set secrets

```bash
fly secrets set \
  SUPABASE_URL=https://<project-ref>.supabase.co \
  SUPABASE_SERVICE_KEY=eyJ... \
  SUPABASE_JWT_SECRET=<legacy-jwt-secret> \
  OPENROUTER_API_KEY=sk-or-v1-... \
  STRIPE_SECRET_KEY=sk_test_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  --app tradingagents-api
```

`SUPABASE_SERVICE_KEY` is the service_role JWT (not the new `sb_secret_*` format — `supabase-py` does not yet accept that).

### Deploy

```bash
fly deploy
```

This creates three machines: `app` (FastAPI on port 8000), `worker` (Celery worker), `redis` (Redis broker). All are shared-cpu-1x 256MB, within the free 3-VM budget.

Verify:
```bash
curl https://tradingagents-api.fly.dev/health
# expect: {"status":"ok"}
```

## 2. Wire Redis internal DNS

The Celery worker and FastAPI app need `REDIS_URL` pointing at the redis process. The redis machine's auto-generated id is not stable across deploys, so we name the machine once for stable DNS.

```bash
# Find the redis machine's id
REDIS_MACHINE_ID=$(fly machines list --json | jq -r '.[] | select(.config.processes[]? == "redis") | .id')

# Name it so internal DNS is stable
fly machine update $REDIS_MACHINE_ID --name redis

# Set REDIS_URL using the stable hostname
fly secrets set REDIS_URL=redis://redis.vm.tradingagents-api.internal:6379/0 --app tradingagents-api
```

Restart the app and worker so they pick up the new `REDIS_URL`:
```bash
fly machine restart $(fly machines list --json | jq -r '.[] | select(.config.processes[]? == "app") | .id')
fly machine restart $(fly machines list --json | jq -r '.[] | select(.config.processes[]? == "worker") | .id')
```

Verify Redis connectivity from the worker logs:
```bash
fly logs --process worker | grep -i "ready\|connected"
```

## 3. Vercel frontend

The simplest path: connect the repo via the Vercel dashboard (no CLI needed).

1. https://vercel.com/new → Import the `TradingAgents` repo
2. Project root: `frontend/`
3. Framework: Astro (auto-detected)
4. Environment variables:
   - `PUBLIC_SUPABASE_URL` — same as backend's `SUPABASE_URL`
   - `PUBLIC_SUPABASE_ANON_KEY` — same as backend's `SUPABASE_ANON_KEY`
   - `BACKEND_URL` — `https://tradingagents-api.fly.dev`
5. Deploy

Every push to `main` auto-deploys.

## 4. Seed demo data

For the investor pitch, seed a demo user with sample analyses:

```bash
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_SERVICE_KEY=eyJ... \
python scripts/seed_demo.py
```

Output confirms the demo user, free credits granted, and rows inserted into `trading_logs`, `portfolio_positions`, `scouting_log`. Re-runnable.

Default demo credentials:
- Email: `demo@tradingagents.app`
- Password: `demo-investor-2026`

Change via `DEMO_EMAIL` / `DEMO_PASSWORD` env vars.

## 5. End-to-end smoke test

```bash
BACKEND_URL=https://tradingagents-api.fly.dev \
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_SERVICE_KEY=eyJ... \
python tests/test_e2e_deploy.py
```

Creates two ephemeral test users, verifies:
- Unauthenticated requests get 401
- User A can queue and read their own analysis
- User B cannot see User A's data (RLS)
- User B's responses are well-formed

Cleans up the test users at the end. Run this after every deploy as a post-deploy gate.

## 6. Free-tier gotchas

- **Supabase pauses free projects after 7 days of inactivity.** To keep the demo project alive, schedule a weekly ping (e.g., a single `GET /health` from a cron job, or run an analysis).
- **Fly shared VMs can be evicted after idle periods.** First request after eviction takes several seconds. Acceptable for a POC, painful for production.
- **Redis data is ephemeral** (`--appendonly no`). If the redis machine is replaced, in-flight Celery tasks are lost. Persistent state is in Supabase Postgres, not Redis.
- **3-VM budget is fully used.** Adding a fourth process (e.g., a dedicated worker queue, or Celery beat) requires either consolidating or paying.

## Re-enabling Celery beat (optional)

If scheduled analysis is desired, add a fourth process group:

```toml
[processes]
  ...
  beat = "celery -A backend.celery_app beat --loglevel=info"
```

Then `fly scale count beat=1` deploys a fourth VM (out of free tier — would need Fly's $5/mo plan or another host like Upstash Redis to free a VM).
