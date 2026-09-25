"""Login keeps accepting legacy bcrypt hashes and migrates them to argon2."""

from unittest.mock import AsyncMock, MagicMock

import bcrypt
import pytest
from httpx import ASGITransport, AsyncClient

from tcgtracker.api.dependencies import get_session
from tcgtracker.main import create_app


def _legacy_bcrypt_hash(password: str) -> str:
    # passlib silently truncated bcrypt input to 72 bytes
    return bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt(rounds=4)).decode()


@pytest.fixture
def user():
    user = MagicMock()
    user.id = 1
    user.username = "ash"
    user.is_active = True
    return user


@pytest.fixture
def db(user):
    db = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = user
    db.execute.return_value = result
    return db


@pytest.fixture
async def client(db):
    app = create_app()

    async def override_session():
        yield db

    app.dependency_overrides[get_session] = override_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def _login(client: AsyncClient, password: str) -> int:
    resp = await client.post(
        "/api/v1/auth/login", data={"username": "ash", "password": password}
    )
    return resp.status_code


@pytest.mark.parametrize("password", ["correct horse battery", "p" * 100])
async def test_login_upgrades_legacy_bcrypt_hash_to_argon2(client, db, user, password):
    user.password_hash = _legacy_bcrypt_hash(password)

    assert await _login(client, password) == 200
    assert user.password_hash.startswith("$argon2id$")
    db.commit.assert_awaited_once()

    upgraded = user.password_hash
    db.commit.reset_mock()
    assert await _login(client, password) == 200
    assert user.password_hash == upgraded
    db.commit.assert_not_awaited()


async def test_login_rejects_wrong_password_without_rehash(client, db, user):
    legacy = _legacy_bcrypt_hash("right password")
    user.password_hash = legacy

    assert await _login(client, "wrong password") == 401
    assert user.password_hash == legacy
    db.commit.assert_not_awaited()
