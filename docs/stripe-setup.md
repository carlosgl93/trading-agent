# Stripe Setup

## Prod Setup (Stripe Dashboard)

1. Go to **Developers → Webhooks → Add endpoint**
2. **URL:** `https://your-domain.com/webhooks/stripe`
3. **Events to send:**
   - `checkout.session.completed`
   - `invoice.paid`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. After saving, click the endpoint → **Signing secret → Reveal** → copy the `whsec_...` value
5. Save that as `STRIPE_WEBHOOK_SECRET` in `.env`

## Prod Price IDs (already set in .env)

```
STRIPE_PRO_PRICE_ID=price_1TT8epGHK4PlaJNXV3G66B7p
STRIPE_CREDIT_PACK_PRICE_ID=price_1TT8fkGHK4PlaJNX40L83nHn
```

## Local Testing

### Backend (Docker)

```bash
docker compose up --build
```

This starts FastAPI + Celery + Redis on `localhost:8000`.

### Frontend (pnpm)

```bash
cd frontend
pnpm run dev
```

This starts the Astro dev server on `localhost:4321`.

### Stripe Webhook Forwarding (separate terminal)

```bash
stripe listen --forward-to localhost:8000/webhooks/stripe
```

Then trigger test events:

```bash
stripe trigger checkout.session.completed
stripe trigger invoice.paid
```
