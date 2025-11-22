"""Error handling and retry mechanisms for external API integrations."""

import asyncio
import random
from functools import wraps
from typing import Any, Callable, List, Optional, Type, TypeVar

import httpx
import structlog

logger = structlog.get_logger(__name__)

F = TypeVar("F", bound=Callable[..., Any])


class APIError(Exception):
    """Base exception for API-related errors."""

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        response_data: Optional[dict] = None,
        original_error: Optional[Exception] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.response_data = response_data
        self.original_error = original_error


class TransientError(APIError):
    """Error that might succeed if retried."""


class PermanentError(APIError):
    """Error that will not succeed if retried."""


class RateLimitError(TransientError):
    """Rate limit exceeded error."""

    def __init__(
        self,
        message: str = "Rate limit exceeded",
        retry_after: Optional[int] = None,
        **kwargs,
    ) -> None:
        super().__init__(message, **kwargs)
        self.retry_after = retry_after


class AuthenticationError(PermanentError):
    """Authentication failed error."""

    def __init__(self, message: str = "Authentication failed", **kwargs) -> None:
        super().__init__(message, **kwargs)


class ValidationError(PermanentError):
    """Request validation error."""

    def __init__(self, message: str = "Request validation failed", **kwargs) -> None:
        super().__init__(message, **kwargs)


class NetworkError(TransientError):
    """Network connectivity error."""

    def __init__(self, message: str = "Network error occurred", **kwargs) -> None:
        super().__init__(message, **kwargs)


class TimeoutError(TransientError):
    """Request timeout error."""

    def __init__(self, message: str = "Request timed out", **kwargs) -> None:
        super().__init__(message, **kwargs)


def classify_http_error(response: httpx.Response) -> Type[APIError]:
    """Classify HTTP response errors into transient or permanent."""
    status_code = response.status_code

    # Permanent errors (4xx client errors, except rate limiting)
    if 400 <= status_code < 500:
        if status_code == 429:  # Too Many Requests
            return RateLimitError
        elif status_code in (401, 403):  # Unauthorized, Forbidden
            return AuthenticationError
        elif status_code == 422:  # Unprocessable Entity
            return ValidationError
        else:
            return PermanentError

    # Transient errors (5xx server errors)
    elif 500 <= status_code < 600:
        return TransientError

    # Other errors are considered transient
    return TransientError


def classify_exception(exc: Exception) -> Type[APIError]:
    """Classify exceptions into transient or permanent."""
    if isinstance(exc, httpx.TimeoutException):
        return TimeoutError
    elif isinstance(exc, (httpx.NetworkError, httpx.ConnectError)):
        return NetworkError
    elif isinstance(exc, httpx.HTTPStatusError):
        return classify_http_error(exc.response)
    else:
        # Unknown errors are considered transient to allow retry
        return TransientError


async def exponential_backoff(
    attempt: int,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    jitter: bool = True,
) -> None:
    """
    Perform exponential backoff with optional jitter.

    Args:
        attempt: Current attempt number (0-based)
        base_delay: Base delay in seconds
        max_delay: Maximum delay in seconds
        jitter: Whether to add random jitter
    """
    delay = min(base_delay * (2**attempt), max_delay)

    if jitter:
        # Add random jitter (±25% of the delay)
        jitter_range = delay * 0.25
        delay += random.uniform(-jitter_range, jitter_range)

    delay = max(0, delay)  # Ensure non-negative delay

    if delay > 0:
        logger.info(f"Backing off for {delay:.2f} seconds", attempt=attempt + 1)
        await asyncio.sleep(delay)


def retry_on_transient_error(
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    backoff_factor: float = 2.0,
    jitter: bool = True,
    exceptions: Optional[List[Type[Exception]]] = None,
) -> Callable[[F], F]:
    """
    Decorator to retry functions on transient errors with exponential backoff.

    Args:
        max_attempts: Maximum number of retry attempts
        base_delay: Base delay between retries in seconds
        max_delay: Maximum delay between retries in seconds
        backoff_factor: Exponential backoff multiplier
        jitter: Whether to add random jitter to delays
        exceptions: List of exception types to retry on (defaults to transient errors)
    """
    if exceptions is None:
        exceptions = [TransientError, NetworkError, TimeoutError, RateLimitError]

    def decorator(func: F) -> F:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None

            for attempt in range(max_attempts):
                try:
                    return await func(*args, **kwargs)
                except Exception as exc:
                    last_exception = exc

                    # Check if this exception should be retried
                    should_retry = any(
                        isinstance(exc, exc_type) for exc_type in exceptions
                    )

                    if not should_retry or attempt == max_attempts - 1:
                        # Don't retry permanent errors or on last attempt
                        logger.error(
                            "Function failed permanently",
                            func_name=func.__name__,
                            attempt=attempt + 1,
                            max_attempts=max_attempts,
                            error=str(exc),
                            exc_info=exc,
                        )
                        raise

                    # Handle rate limiting with special backoff
                    if isinstance(exc, RateLimitError) and exc.retry_after:
                        retry_delay = exc.retry_after
                        logger.warning(
                            "Rate limited, using server-provided retry delay",
                            func_name=func.__name__,
                            attempt=attempt + 1,
                            retry_after=retry_delay,
                        )
                        await asyncio.sleep(retry_delay)
                    else:
                        # Regular exponential backoff
                        delay = min(base_delay * (backoff_factor**attempt), max_delay)
                        if jitter:
                            jitter_range = delay * 0.25
                            delay += random.uniform(-jitter_range, jitter_range)
                        delay = max(0, delay)

                        logger.warning(
                            "Function failed, retrying",
                            func_name=func.__name__,
                            attempt=attempt + 1,
                            max_attempts=max_attempts,
                            delay=delay,
                            error=str(exc),
                        )

                        if delay > 0:
                            await asyncio.sleep(delay)

            # This should never be reached, but just in case
            if last_exception:
                raise last_exception

        return wrapper

    return decorator


def handle_http_error(response: httpx.Response) -> None:
    """
    Handle HTTP error responses by raising appropriate exceptions.

    Args:
        response: HTTP response object

    Raises:
        APIError: Appropriate error based on response status
    """
    if response.is_success:
        return

    status_code = response.status_code

    try:
        response_data = response.json()
        error_message = response_data.get("message") or response_data.get("error")
    except Exception:
        response_data = None
        error_message = None

    if not error_message:
        error_message = f"HTTP {status_code}: {response.reason_phrase}"

    # Determine error type
    error_class = classify_http_error(response)

    # Handle specific error types
    if error_class == RateLimitError:
        retry_after = None
        retry_header = response.headers.get("retry-after")
        if retry_header:
            try:
                retry_after = int(retry_header)
            except ValueError:
                pass

        raise RateLimitError(
            message=error_message,
            status_code=status_code,
            response_data=response_data,
            retry_after=retry_after,
        )

    # Raise appropriate error
    raise error_class(
        message=error_message,
        status_code=status_code,
        response_data=response_data,
    )


async def safe_request(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    **kwargs,
) -> httpx.Response:
    """
    Make a safe HTTP request with proper error handling.

    Args:
        client: HTTP client instance
        method: HTTP method
        url: Request URL
        **kwargs: Additional request parameters

    Returns:
        HTTP response object

    Raises:
        APIError: On request failures
    """
    try:
        response = await client.request(method, url, **kwargs)
        handle_http_error(response)
        return response
    except httpx.HTTPError as exc:
        error_class = classify_exception(exc)
        raise error_class(
            message=f"HTTP request failed: {str(exc)}",
            original_error=exc,
        )
    except Exception as exc:
        raise TransientError(
            message=f"Unexpected error during request: {str(exc)}",
            original_error=exc,
        )
