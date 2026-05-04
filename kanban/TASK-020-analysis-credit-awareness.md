# TASK-020: Frontend — AnalysisEngine + ScoutPanel credit awareness

**Status:** done
**Phase:** 5 — Frontend
**Priority:** P1

## Description
Update AnalysisEngine and ScoutPanel to show credit cost per run, disable buttons when credits=0, and show "Out of credits — top up" state with link.

## Files
- `frontend/src/components/AnalysisEngine.tsx`
- `frontend/src/components/ScoutPanel.tsx`

## Acceptance Criteria
- [ ] "1 credit" label shown on run button
- [ ] Button disabled + tooltip when credits=0
- [ ] 402 response from API triggers "Out of credits" toast
- [ ] Credits refetch after successful run
