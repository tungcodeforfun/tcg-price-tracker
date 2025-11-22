"""API v1 module."""

from fastapi import APIRouter

from tcgtracker.api.v1.auth import router as auth_router
from tcgtracker.api.v1.cards import router as cards_router
from tcgtracker.api.v1.collections import router as collections_router
from tcgtracker.api.v1.prices import router as prices_router
from tcgtracker.api.v1.search import router as search_router
from tcgtracker.api.v1.users import router as users_router

router = APIRouter(prefix="/api/v1")

router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
router.include_router(users_router, prefix="/users", tags=["Users"])
router.include_router(cards_router, prefix="/cards", tags=["Cards"])
router.include_router(collections_router, prefix="/collections", tags=["Collections"])
router.include_router(prices_router, prefix="/prices", tags=["Prices"])
router.include_router(search_router, prefix="/search", tags=["Search"])

__all__ = ["router"]
