# TASK-004: pyproject.toml — Add new backend dependencies

**Status:** done
**Phase:** 1 — Tenancy
**Priority:** P0

## Description
Add `PyJWT`, `stripe`, and `cryptography` to the `[backend]` optional-dependencies in pyproject.toml.

## Files
- `pyproject.toml`

## Acceptance Criteria
- [ ] `PyJWT>=2.8` in backend extras
- [ ] `stripe>=10.0` in backend extras
- [ ] `cryptography>=42.0` in backend extras (PyJWT RS256 support)
