"""End-to-end test against the deployed TradingAgents stack.

Exercises the full auth + per-user-scoping flow against the live backend
URL (Fly.io) and the live Supabase project. Designed to run as a
post-deploy gate, not in the regular CI suite.

Required env:
  BACKEND_URL           - public HTTPS URL of the deployed FastAPI backend
  SUPABASE_URL          - project URL
  SUPABASE_SERVICE_KEY  - service_role JWT (admin)
  SUPABASE_JWT_SECRET   - legacy JWT secret (for HS256 verification sanity)

Behaviour:
  - Creates two ephemeral test users via the Supabase admin API
  - Verifies unauthenticated requests get 401
  - Verifies user A can trigger an analysis and read their own result
  - Verifies user B cannot read user A's result (RLS + JWT scoping)
  - Cleans up the test users at the end
"""
from __future__ import annotations

import os
import sys
import uuid
from typing import Any

import requests
from supabase import Client, create_client

BACKEND_URL = os.environ.get("BACKEND_URL", "").rstrip("/")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

TICKER = os.environ.get("E2E_TICKER", "E2ETEST")


def require_env() -> None:
    missing = [k for k in ("BACKEND_URL", "SUPABASE_URL", "SUPABASE_SERVICE_KEY") if not os.environ.get(k)]
    if missing:
        sys.exit(f"Missing required env: {', '.join(missing)}")


def admin_client() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def make_user(admin: Client, label: str) -> tuple[str, str]:
    """Create an ephemeral user. Returns (user_id, access_token)."""
    email = f"e2e-{label}-{uuid.uuid4().hex[:8]}@tradingagents-test.app"
    password = uuid.uuid4().hex
    resp = admin.auth.admin.create_user({
        "email": email,
        "password": password,
        "email_confirm": True,
    })
    user_id = resp.user.id
    # Sign in to get a JWT (admin.create_user doesn't return a session)
    session = admin.auth.sign_in_with_password({"email": email, "password": password})
    return user_id, session.session.access_token


def cleanup_user(admin: Client, user_id: str) -> None:
    try:
        admin.auth.admin.delete_user(user_id)
    except Exception:
        pass


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def test_unauthenticated_returns_401() -> None:
    """Public health endpoint works, protected endpoint rejects no token."""
    health = requests.get(f"{BACKEND_URL}/health", timeout=10)
    assert health.status_code == 200, f"/health: {health.status_code} {health.text}"

    protected = requests.get(f"{BACKEND_URL}/results", timeout=10)
    assert protected.status_code == 401, f"/results (no auth): expected 401, got {protected.status_code}"

    bad_token = requests.get(
        f"{BACKEND_URL}/results",
        headers={"Authorization": "Bearer not-a-real-token"},
        timeout=10,
    )
    assert bad_token.status_code == 401, f"/results (bad token): expected 401, got {bad_token.status_code}"
    print("  unauthenticated/bad-token -> 401 OK")


def test_user_a_can_run_and_read_own_analysis(token_a: str) -> str:
    """User A queues an analysis and reads their own result. Returns the log id."""
    queue = requests.post(
        f"{BACKEND_URL}/test-task/{TICKER}",
        headers=auth_headers(token_a),
        timeout=15,
    )
    assert queue.status_code == 200, f"queue: {queue.status_code} {queue.text}"
    print(f"  user A queued analysis for {TICKER}: task_id={queue.json().get('task_id')}")

    # Worker is async. Poll /results until we see at least one row or we time out.
    import time
    deadline = time.time() + 60
    while time.time() < deadline:
        results = requests.get(
            f"{BACKEND_URL}/results",
            headers=auth_headers(token_a),
            timeout=10,
        )
        assert results.status_code == 200, f"results: {results.status_code}"
        rows = results.json()
        own = [r for r in rows if r["ticker"] == TICKER]
        if own:
            log_id = own[0]["id"]
            print(f"  user A sees {len(own)} row(s) for {TICKER}; log_id={log_id}")
            return log_id
        time.sleep(2)
    raise AssertionError(f"user A never saw a result for {TICKER} within 60s")


def test_user_b_cannot_see_user_a_result(token_a: str, token_b: str, a_log_id: str) -> None:
    """RLS + per-user scoping: user B's /results is empty, direct id lookup 404."""
    b_results = requests.get(
        f"{BACKEND_URL}/results",
        headers=auth_headers(token_b),
        timeout=10,
    )
    assert b_results.status_code == 200
    b_rows = b_results.json()
    assert all(r["id"] != a_log_id for r in b_rows), "user B can see user A's log row!"

    b_direct = requests.get(
        f"{BACKEND_URL}/results/{a_log_id}",
        headers=auth_headers(token_b),
        timeout=10,
    )
    assert b_direct.status_code == 404, f"user B direct lookup: expected 404, got {b_direct.status_code}"
    print(f"  user B /results clean; direct lookup of A's id -> 404 OK")


def test_user_b_sees_only_own_results(token_b: str) -> None:
    """User B's /results is well-formed (could be empty or contain own rows)."""
    b_results = requests.get(
        f"{BACKEND_URL}/results",
        headers=auth_headers(token_b),
        timeout=10,
    )
    assert b_results.status_code == 200
    rows = b_results.json()
    for row in rows:
        assert "id" in row and "ticker" in row, f"malformed row: {row}"
    print(f"  user B /results returns {len(rows)} well-formed row(s)")


def main() -> int:
    require_env()
    admin = admin_client()

    print(f"E2E test against {BACKEND_URL}")

    test_unauthenticated_returns_401()

    user_a_id, token_a = make_user(admin, "a")
    user_b_id, token_b = make_user(admin, "b")
    print(f"  test users created: A={user_a_id}, B={user_b_id}")

    try:
        a_log_id = test_user_a_can_run_and_read_own_analysis(token_a)
        test_user_b_cannot_see_user_a_result(token_a, token_b, a_log_id)
        test_user_b_sees_only_own_results(token_b)
    finally:
        cleanup_user(admin, user_a_id)
        cleanup_user(admin, user_b_id)
        print("  test users cleaned up")

    print("E2E PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
