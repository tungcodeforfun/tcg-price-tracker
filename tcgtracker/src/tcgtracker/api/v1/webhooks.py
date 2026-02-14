"""eBay marketplace webhook endpoints."""

import hashlib
import logging
from typing import Any

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse

from tcgtracker.config import get_settings

router = APIRouter()
logger = logging.getLogger(__name__)
settings = get_settings()


@router.get("/ebay/account-deletion")
async def ebay_challenge(challenge_code: str = Query(...)) -> JSONResponse:
    """Respond to eBay challenge verification request.

    eBay sends a challenge_code query param. We return the SHA-256 hash of
    (challenge_code + verification_token + endpoint_url).
    """
    token = settings.external_apis.ebay_verification_token
    endpoint = settings.external_apis.ebay_deletion_endpoint

    digest = hashlib.sha256(
        (challenge_code + token + endpoint).encode()
    ).hexdigest()

    return JSONResponse(
        content={"challengeResponse": digest},
        status_code=200,
    )


@router.post("/ebay/account-deletion")
async def ebay_account_deletion(request: Request) -> JSONResponse:
    """Handle eBay marketplace account deletion notification.

    eBay sends user deletion notifications here. Since we don't store any
    eBay user data, we just log the notification and acknowledge it.
    """
    body: dict[str, Any] = await request.json()
    logger.info("eBay account deletion notification received: %s", body)

    return JSONResponse(content={"status": "ok"}, status_code=200)
