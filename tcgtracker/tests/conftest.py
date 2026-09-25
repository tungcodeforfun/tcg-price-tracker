"""Shared pytest setup."""

import os

# Settings refuse to load without a signing key; tests never need a real one.
os.environ.setdefault("SECRET_KEY", "test-only-secret-key-not-for-production-use")
