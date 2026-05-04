# TASK-017: Frontend — CreditBalance component

**Status:** done
**Phase:** 5 — Frontend
**Priority:** P1

## Description
Create `CreditBalance.tsx` that shows current credit count, lights up amber when low (<10), and links to top-up checkout.

## Files
- `frontend/src/components/CreditBalance.tsx` (new)
- `frontend/src/lib/hooks/useCredits.ts` (new)

## Acceptance Criteria
- [ ] Shows credit count with amber flash animation when ≤10
- [ ] "Top up" button links to `/checkout/credits`
- [ ] Refetches after analysis completes (invalidate on WS task_complete event)
