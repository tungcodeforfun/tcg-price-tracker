"""Tests for error handling and retry mechanisms."""

import pytest
import asyncio
from unittest.mock import AsyncMock, patch
import httpx

from tcgtracker.utils.errors import (
    APIError,
    TransientError,
    PermanentError,
    RateLimitError,
    AuthenticationError,
    NetworkError,
    TimeoutError,
    classify_http_error,
    classify_exception,
    retry_on_transient_error,
    handle_http_error,
    safe_request,
)
from tcgtracker.utils.circuit_breaker import CircuitBreaker, CircuitBreakerError


class TestErrorClassification:
    """Test error classification functions."""

    def test_classify_http_error_permanent(self):
        """Test classification of permanent HTTP errors."""
        # Create mock responses for different status codes
        response_400 = httpx.Response(400, request=httpx.Request("GET", "http://test.com"))
        response_404 = httpx.Response(404, request=httpx.Request("GET", "http://test.com"))
        
        assert classify_http_error(response_400) == PermanentError
        assert classify_http_error(response_404) == PermanentError

    def test_classify_http_error_authentication(self):
        """Test classification of authentication errors."""
        response_401 = httpx.Response(401, request=httpx.Request("GET", "http://test.com"))
        response_403 = httpx.Response(403, request=httpx.Request("GET", "http://test.com"))
        
        assert classify_http_error(response_401) == AuthenticationError
        assert classify_http_error(response_403) == AuthenticationError

    def test_classify_http_error_rate_limit(self):
        """Test classification of rate limit errors."""
        response_429 = httpx.Response(429, request=httpx.Request("GET", "http://test.com"))
        
        assert classify_http_error(response_429) == RateLimitError

    def test_classify_http_error_server_errors(self):
        """Test classification of server errors as transient."""
        response_500 = httpx.Response(500, request=httpx.Request("GET", "http://test.com"))
        response_503 = httpx.Response(503, request=httpx.Request("GET", "http://test.com"))
        
        assert classify_http_error(response_500) == TransientError
        assert classify_http_error(response_503) == TransientError

    def test_classify_exception_timeout(self):
        """Test classification of timeout exceptions."""
        timeout_exc = httpx.TimeoutException("Request timed out")
        
        assert classify_exception(timeout_exc) == TimeoutError

    def test_classify_exception_network(self):
        """Test classification of network exceptions."""
        network_exc = httpx.NetworkError("Network unreachable")
        connect_exc = httpx.ConnectError("Connection failed")
        
        assert classify_exception(network_exc) == NetworkError
        assert classify_exception(connect_exc) == NetworkError

    def test_classify_exception_http_status(self):
        """Test classification of HTTP status exceptions."""
        response = httpx.Response(429, request=httpx.Request("GET", "http://test.com"))
        http_exc = httpx.HTTPStatusError("Rate limited", request=response.request, response=response)
        
        assert classify_exception(http_exc) == RateLimitError

    def test_classify_exception_unknown(self):
        """Test classification of unknown exceptions as transient."""
        unknown_exc = ValueError("Unknown error")
        
        assert classify_exception(unknown_exc) == TransientError


class TestHandleHttpError:
    """Test HTTP error handler."""

    def test_handle_http_error_success(self):
        """Test handling successful responses."""
        response = httpx.Response(200, request=httpx.Request("GET", "http://test.com"))
        
        # Should not raise any exception
        handle_http_error(response)

    def test_handle_http_error_rate_limit_with_retry_after(self):
        """Test handling rate limit with retry-after header."""
        response = httpx.Response(
            429,
            headers={"retry-after": "30"},
            request=httpx.Request("GET", "http://test.com")
        )
        
        with pytest.raises(RateLimitError) as exc_info:
            handle_http_error(response)
        
        assert exc_info.value.retry_after == 30
        assert exc_info.value.status_code == 429

    def test_handle_http_error_authentication(self):
        """Test handling authentication errors."""
        response = httpx.Response(401, request=httpx.Request("GET", "http://test.com"))
        
        with pytest.raises(AuthenticationError) as exc_info:
            handle_http_error(response)
        
        assert exc_info.value.status_code == 401

    def test_handle_http_error_with_json_error_message(self):
        """Test handling errors with JSON error messages."""
        response = httpx.Response(
            400,
            json={"error": "Invalid request", "message": "Missing required field"},
            request=httpx.Request("GET", "http://test.com")
        )
        
        with pytest.raises(PermanentError) as exc_info:
            handle_http_error(response)
        
        assert "Missing required field" in str(exc_info.value)


class TestRetryDecorator:
    """Test retry decorator functionality."""

    @pytest.mark.asyncio
    async def test_retry_success_on_first_attempt(self):
        """Test successful execution on first attempt."""
        @retry_on_transient_error(max_attempts=3)
        async def successful_function():
            return "success"
        
        result = await successful_function()
        assert result == "success"

    @pytest.mark.asyncio
    async def test_retry_success_after_failures(self):
        """Test successful execution after initial failures."""
        call_count = 0
        
        @retry_on_transient_error(max_attempts=3, base_delay=0.01)
        async def flaky_function():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise TransientError("Temporary failure")
            return "success"
        
        result = await flaky_function()
        assert result == "success"
        assert call_count == 3

    @pytest.mark.asyncio
    async def test_retry_permanent_error_no_retry(self):
        """Test that permanent errors are not retried."""
        call_count = 0
        
        @retry_on_transient_error(max_attempts=3)
        async def failing_function():
            nonlocal call_count
            call_count += 1
            raise PermanentError("Permanent failure")
        
        with pytest.raises(PermanentError):
            await failing_function()
        
        assert call_count == 1  # Should not retry

    @pytest.mark.asyncio
    async def test_retry_max_attempts_exceeded(self):
        """Test that function fails after max attempts."""
        call_count = 0
        
        @retry_on_transient_error(max_attempts=2, base_delay=0.01)
        async def always_failing_function():
            nonlocal call_count
            call_count += 1
            raise TransientError("Always fails")
        
        with pytest.raises(TransientError):
            await always_failing_function()
        
        assert call_count == 2  # Should try exactly max_attempts times

    @pytest.mark.asyncio
    async def test_retry_rate_limit_special_handling(self):
        """Test special handling of rate limit errors."""
        call_count = 0
        
        @retry_on_transient_error(max_attempts=3, base_delay=0.01)
        async def rate_limited_function():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise RateLimitError("Rate limited", retry_after=0.01)
            return "success"
        
        result = await rate_limited_function()
        assert result == "success"
        assert call_count == 2

    @pytest.mark.asyncio
    async def test_retry_custom_exceptions(self):
        """Test retry with custom exception list."""
        call_count = 0
        
        @retry_on_transient_error(
            max_attempts=3, 
            base_delay=0.01,
            exceptions=[ValueError]
        )
        async def custom_exception_function():
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise ValueError("Custom exception")
            return "success"
        
        result = await custom_exception_function()
        assert result == "success"
        assert call_count == 2


class TestSafeRequest:
    """Test safe request function."""

    @pytest.mark.asyncio
    async def test_safe_request_success(self):
        """Test successful safe request."""
        mock_client = AsyncMock()
        mock_response = httpx.Response(200, request=httpx.Request("GET", "http://test.com"))
        mock_client.request.return_value = mock_response
        
        response = await safe_request(mock_client, "GET", "http://test.com")
        
        assert response == mock_response
        mock_client.request.assert_called_once_with("GET", "http://test.com")

    @pytest.mark.asyncio
    async def test_safe_request_http_error(self):
        """Test safe request with HTTP error."""
        mock_client = AsyncMock()
        mock_client.request.side_effect = httpx.NetworkError("Network error")
        
        with pytest.raises(NetworkError) as exc_info:
            await safe_request(mock_client, "GET", "http://test.com")
        
        assert "HTTP request failed" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_safe_request_unexpected_error(self):
        """Test safe request with unexpected error."""
        mock_client = AsyncMock()
        mock_client.request.side_effect = ValueError("Unexpected error")
        
        with pytest.raises(TransientError) as exc_info:
            await safe_request(mock_client, "GET", "http://test.com")
        
        assert "Unexpected error during request" in str(exc_info.value)


class TestCircuitBreaker:
    """Test circuit breaker functionality."""

    @pytest.mark.asyncio
    async def test_circuit_breaker_closed_state(self):
        """Test circuit breaker in closed state."""
        cb = CircuitBreaker("test", failure_threshold=3)
        
        # Should allow calls in closed state
        result = await cb.call(lambda: "success")
        assert result == "success"
        assert cb.is_closed

    @pytest.mark.asyncio
    async def test_circuit_breaker_opens_after_failures(self):
        """Test circuit breaker opens after failure threshold."""
        cb = CircuitBreaker("test", failure_threshold=2)
        
        # Cause failures to open circuit
        for _ in range(2):
            with pytest.raises(Exception):
                await cb.call(lambda: exec('raise Exception("test error")'))
        
        # Circuit should be open now
        assert cb.is_open
        
        # Next call should be blocked
        with pytest.raises(CircuitBreakerError):
            await cb.call(lambda: "success")

    @pytest.mark.asyncio
    async def test_circuit_breaker_half_open_recovery(self):
        """Test circuit breaker half-open state and recovery."""
        cb = CircuitBreaker("test", failure_threshold=1, recovery_timeout=0.01)
        
        # Cause failure to open circuit
        with pytest.raises(Exception):
            await cb.call(lambda: exec('raise Exception("test error")'))
        
        assert cb.is_open
        
        # Wait for recovery timeout
        await asyncio.sleep(0.02)
        
        # Next successful call should close the circuit
        result = await cb.call(lambda: "success")
        assert result == "success"
        assert cb.is_closed

    @pytest.mark.asyncio
    async def test_circuit_breaker_half_open_failure(self):
        """Test circuit breaker failure in half-open state."""
        cb = CircuitBreaker("test", failure_threshold=1, recovery_timeout=0.01)
        
        # Cause failure to open circuit
        with pytest.raises(Exception):
            await cb.call(lambda: exec('raise Exception("test error")'))
        
        # Wait for recovery timeout
        await asyncio.sleep(0.02)
        
        # Failure in half-open should immediately open circuit
        with pytest.raises(Exception):
            await cb.call(lambda: exec('raise Exception("test error")'))
        
        assert cb.is_open

    @pytest.mark.asyncio
    async def test_circuit_breaker_reset(self):
        """Test manual circuit breaker reset."""
        cb = CircuitBreaker("test", failure_threshold=1)
        
        # Cause failure to open circuit
        with pytest.raises(Exception):
            await cb.call(lambda: exec('raise Exception("test error")'))
        
        assert cb.is_open
        
        # Reset circuit
        await cb.reset()
        
        assert cb.is_closed
        assert cb.failure_count == 0

    @pytest.mark.asyncio
    async def test_circuit_breaker_unexpected_exception(self):
        """Test circuit breaker with unexpected exceptions."""
        cb = CircuitBreaker("test", failure_threshold=2, expected_exception=ValueError)
        
        # Unexpected exception should not count as failure
        with pytest.raises(TypeError):
            await cb.call(lambda: exec('raise TypeError("unexpected")'))
        
        # Circuit should still be closed
        assert cb.is_closed
        assert cb.failure_count == 0

    def test_circuit_breaker_stats(self):
        """Test circuit breaker statistics."""
        cb = CircuitBreaker("test", failure_threshold=5, recovery_timeout=60)
        
        stats = cb.get_stats()
        
        assert stats["name"] == "test"
        assert stats["state"] == "closed"
        assert stats["failure_count"] == 0
        assert stats["failure_threshold"] == 5
        assert stats["recovery_timeout"] == 60