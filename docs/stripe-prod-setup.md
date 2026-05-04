# Stripe Production Setup

## Webhook

1. Stripe Dashboard → Developers → Webhooks → **Add endpoint**
2. URL: `https://your-domain.com/webhooks/stripe`
3. Events to send:
   - `checkout.session.completed`
   - `invoice.paid`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Save → click the endpoint → **Signing secret** → Reveal → copy `whsec_...`
5. Set `STRIPE_WEBHOOK_SECRET=whsec_...` in prod env

## Price IDs

- **Pro subscription** test price ID: `price_1TT8epGHK4PlaJNXV3G66B7p` → `STRIPE_PRO_PRICE_ID`
- **Credit Pack (10-pack)** test price ID: `price_1TT8fkGHK4PlaJNX40L83nHn` → `STRIPE_CREDIT_PACK_PRICE_ID`
- In prod, create equivalent live-mode products and use their `price_live_...` IDs instead.

## Restricted Key

Restricted key (for webhook processor only): `rk_test_51Oezk7G...`
In prod, create a restricted key with only the permissions the webhook handler needs (read customers, read checkout sessions).

## Environment Variables (prod)

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_CREDIT_PACK_PRICE_ID=price_...
STRIPE_SUCCESS_URL=https://your-domain.com/?checkout=success
STRIPE_CANCEL_URL=https://your-domain.com/?checkout=cancelled
```
