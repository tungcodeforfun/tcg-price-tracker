"""Rate limiting configuration."""

import os

from starlette.requests import Request

from slowapi import Limiter

_TRUSTED_PROXIES: set[str] = set(
    filter(None, os.getenv("TRUSTED_PROXIES", "127.0.0.1,::1").split(","))
)


def _get_client_ip(request: Request) -> str:
    """Get client IP, trusting forwarded headers only from known proxies."""
    client_ip = request.client.host if request.client else "unknown"

    if client_ip not in _TRUSTED_PROXIES:
        return client_ip

    x_real_ip = request.headers.get("X-Real-IP")
    if x_real_ip:
        return x_real_ip
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return client_ip


limiter = Limiter(key_func=_get_client_ip)
