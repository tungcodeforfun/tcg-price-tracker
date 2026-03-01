"""eBay marketplace webhook endpoints."""

import hashlib
import hmac
import logging

from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse

from tcgtracker.config import get_settings

router = APIRouter()
logger = logging.getLogger(__name__)
settings = get_settings()


def _verify_ebay_signature(body: bytes, signature_header: str | None) -> bool:
    """Verify eBay webhook request signature."""
    token = settings.external_apis.ebay_verification_token
    if not token or not signature_header:
        return False
    expected = hmac.new(
        token.encode(), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)


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
    body = await request.body()
    signature = request.headers.get("X-EBAY-SIGNATURE")

    if not _verify_ebay_signature(body, signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature",
        )

    logger.info("eBay account deletion notification received")

    return JSONResponse(content={"status": "ok"}, status_code=200)
