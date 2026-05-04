# TASK-018: Frontend — BillingSettings + AlpacaKeyForm components

**Status:** done
**Phase:** 5 — Frontend
**Priority:** P1

## Description
Create settings page/panel with two sections: billing (current tier badge + Stripe portal link + upgrade CTA) and Alpaca key form (paste key/secret, toggles paper mode).

## Files
- `frontend/src/components/BillingSettings.tsx` (new)
- `frontend/src/components/AlpacaKeyForm.tsx` (new)
- `frontend/src/pages/settings.astro` (new)

## Acceptance Criteria
- [ ] Current tier shown as badge (free/pro/developer)
- [ ] "Manage billing" opens Stripe Customer Portal in new tab
- [ ] Alpaca key form POSTs to `/settings/alpaca` and shows success/error state
