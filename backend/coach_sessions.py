"""Short-lived, per-browser AI credentials. Nothing is written to disk or logs."""
from collections import OrderedDict
from hashlib import sha256
import os
import secrets
import time
from threading import Timer, RLock
from urllib.parse import urlsplit

from fastapi import HTTPException, Request, Response
from pydantic import BaseModel, Field, SecretStr
from typing import Literal
from fastapi.responses import JSONResponse


async def validation_error(request, exc):
    # Never reflect invalid credential input in validation responses.
    if request.url.path.startswith("/api/ai"):
        return JSONResponse(status_code=422, content={"detail": "Invalid coach request. Check the required fields and lengths."}, headers={"Cache-Control": "no-store"})
    from fastapi.exception_handlers import request_validation_exception_handler
    return await request_validation_exception_handler(request, exc)


async def private_coach_responses(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith('/api/ai/'):
        response.headers['Cache-Control'] = 'no-store'
        response.headers['Pragma'] = 'no-cache'
    return response

COOKIE = "coach_session"
TTL = 8 * 60 * 60
sessions = OrderedDict()
attempts = OrderedDict()
session_lock = RLock()


def remove_session(token):
    with session_lock:
        session = sessions.pop(token, None)
        if session:
            session["timer"].cancel()


def allowed_origins():
    return [origin.strip().rstrip("/") for origin in os.getenv(
        "COACH_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",") if origin.strip()]


def trusted_origin(request: Request):
    origin = request.headers.get("origin") or str(request.base_url).rstrip("/")
    if origin not in allowed_origins():
        raise HTTPException(403, "This dashboard origin is not allowed by the coach backend.")
    url = urlsplit(str(request.url))
    if url.scheme != "https" and url.hostname not in ("localhost", "127.0.0.1", "::1"):
        raise HTTPException(400, "Use HTTPS for the coach backend.")
    return origin


class ConnectionRequest(BaseModel):
    access_code: SecretStr = Field(min_length=1, max_length=200)
    provider: Literal["deepseek", "openai", "gemini"] = "deepseek"
    api_key: SecretStr | None = Field(default=None, max_length=1000)


def connect(request: Request, response: Response, connection: ConnectionRequest):
    origin = trusted_origin(request)
    expected = os.getenv("COACH_ACCESS_CODE", "")
    if len(expected) < 24:
        raise HTTPException(503, "Backend setup required: configure a strong COACH_ACCESS_CODE.")
    now = time.monotonic()
    ip = request.client.host if request.client else "unknown"
    with session_lock:
        started, count = attempts.get(ip, (now, 0))
        if now - started >= 600:
            started, count = now, 0
        if count >= 5:
            raise HTTPException(429, "Too many connection attempts. Try again in ten minutes.")
        attempts[ip] = (started, count + 1)
        if len(attempts) > 512:
            attempts.popitem(last=False)
    if not secrets.compare_digest(expected, connection.access_code.get_secret_value()):
        raise HTTPException(401, "Incorrect coach access code.")
    key = (connection.api_key.get_secret_value().strip() if connection.api_key else "") or os.getenv(f"{connection.provider.upper()}_API_KEY", "")
    if not key:
        raise HTTPException(422, "Enter a provider API key, or configure it on the backend.")
    attempts.pop(ip, None)
    with session_lock:
        for token, session in list(sessions.items()):
            if session["expires"] <= now:
                remove_session(token)
    disconnect(request, response)
    token = secrets.token_urlsafe(32)
    token_hash = sha256(token.encode()).hexdigest()
    timer = Timer(TTL, remove_session, args=(token_hash,))
    timer.daemon = True
    with session_lock:
        sessions[token_hash] = {
            "key": key, "provider": connection.provider, "origin": origin,
            "expires": now + TTL, "window": now, "count": 0, "timer": timer,
        }
        while len(sessions) > 128:
            remove_session(next(iter(sessions)))
    timer.start()
    secure = request.url.scheme == "https"
    response.set_cookie(COOKIE, token, max_age=TTL, httponly=True, secure=secure,
                        samesite="none" if secure else "strict", path="/api/ai")
    response.headers["Cache-Control"] = "no-store"
    return {"connected": True, "provider": connection.provider, "expires_in": TTL}


def get_session(request: Request, consume=False):
    token = request.cookies.get(COOKIE, "")
    key = sha256(token.encode()).hexdigest()
    session = sessions.get(key)
    if not session:
        return None
    if session["expires"] <= time.monotonic():
        remove_session(key)
        return None
    if session["origin"] != trusted_origin(request):
        raise HTTPException(403, "Coach session belongs to another dashboard origin.")
    if consume:
        now = time.monotonic()
        if now - session["window"] >= 60:
            session["window"], session["count"] = now, 0
        if session["count"] >= 20:
            raise HTTPException(429, "Please wait a minute before asking again.")
        session["count"] += 1
    return session


def disconnect(request: Request, response: Response):
    token = request.cookies.get(COOKIE, "")
    remove_session(sha256(token.encode()).hexdigest())
    response.delete_cookie(COOKIE, path="/api/ai")
    response.headers["Cache-Control"] = "no-store"
    return {"connected": False}
