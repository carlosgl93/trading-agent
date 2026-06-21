"""FastAPI dependency for Supabase JWT authentication.

Extracts user_id (UUID string) from a Supabase-issued Bearer token.

Supports two algorithms:
  * ES256 — modern Supabase asymmetric signing. Verifies against the
    project's JWKS endpoint (https://<project>.supabase.co/auth/v1/.well-known/jwks.json),
    fetched once and cached in-process.
  * HS256 — legacy shared-secret signing via SUPABASE_JWT_SECRET.

JWKS keys are cached for 10 minutes; cache is refreshed on a `kid` miss.
"""

import os
import threading
import time

import jwt
import requests
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.algorithms import ECAlgorithm

_bearer = HTTPBearer()

_lock = threading.Lock()
_jwks_cache: dict = {"keys": None, "fetched_at": 0.0}
_JWKS_TTL_SECONDS = 600
_JWKS_TIMEOUT_SECONDS = 5

_SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
_LEGACY_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")


def _get_jwks(force: bool = False) -> dict:
    """Fetch Supabase JWKS, with TTL cache. Raises on network failure."""
    now = time.time()
    if not force and _jwks_cache["keys"] is not None and now - _jwks_cache["fetched_at"] < _JWKS_TTL_SECONDS:
        return _jwks_cache["keys"]
    with _lock:
        if not force and _jwks_cache["keys"] is not None and now - _jwks_cache["fetched_at"] < _JWKS_TTL_SECONDS:
            return _jwks_cache["keys"]
        if not _SUPABASE_URL:
            raise HTTPException(status_code=500, detail="SUPABASE_URL not set")
        url = f"{_SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        resp = requests.get(url, timeout=_JWKS_TIMEOUT_SECONDS)
        resp.raise_for_status()
        _jwks_cache["keys"] = resp.json()
        _jwks_cache["fetched_at"] = now
        return _jwks_cache["keys"]


def _verify_es256(token: str, kid: str | None) -> str:
    jwks = _get_jwks()
    key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
    if key is None:
        # Unknown kid — maybe keys rotated. Refetch once.
        jwks = _get_jwks(force=True)
        key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
    if key is None:
        raise HTTPException(status_code=401, detail="Unknown signing key")
    try:
        public_key = ECAlgorithm.from_jwk(key)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid key format")
    try:
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["ES256"],
            audience="authenticated",
            issuer=f"{_SUPABASE_URL}/auth/v1",
            options={"require": ["exp", "sub"]},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload["sub"]


def _verify_hs256(token: str) -> str:
    if not _LEGACY_SECRET:
        raise HTTPException(status_code=500, detail="SUPABASE_JWT_SECRET not set")
    try:
        payload = jwt.decode(
            token,
            _LEGACY_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False, "require": ["exp", "sub"]},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload["sub"]


def _verify_token(token: str) -> str:
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    alg = header.get("alg")
    if alg == "ES256":
        return _verify_es256(token, header.get("kid"))
    if alg == "HS256":
        return _verify_hs256(token)
    raise HTTPException(status_code=401, detail="Unsupported algorithm")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> str:
    return _verify_token(credentials.credentials)
