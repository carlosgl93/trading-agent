# TASK-016: Frontend — Supabase Auth UI + auth guard

**Status:** done
**Phase:** 5 — Frontend
**Priority:** P1

## Description
Add `@supabase/supabase-js` to frontend. Create login page with magic link + Google/GitHub OAuth. Add auth guard that redirects unauthenticated users to `/login`. Store session and expose user/session via context.

## Files
- `frontend/src/lib/supabase.ts` (new)
- `frontend/src/pages/login.astro` (new)
- `frontend/src/components/AuthGuard.tsx` (new)

## Acceptance Criteria
- [ ] Magic link login works
- [ ] OAuth buttons present (Google, GitHub)
- [ ] Unauthenticated visit to `/` redirects to `/login`
- [ ] After login, redirects back to `/`
- [ ] JWT stored in session, accessible to API calls
