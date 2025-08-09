"""Base API client with retry logic and circuit breaker support."""

import asyncio
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Union
from urllib.parse import urljoin

import httpx
import structlog

from tcgtracker.utils.circuit_breaker import CircuitBreaker, get_circuit_breaker
from tcgtracker.utils.errors import (
    APIError,
    AuthenticationError,
    RateLimitError,
    TransientError,
    retry_on_transient_error,
    safe_request,
)

logger = structlog.get_logger(__name__)


class RateLimiter:
    """Simple rate limiter for API requests."""
    
    def __init__(self, requests_per_minute: int, requests_per_hour: Optional[int] = None) -> None:
        self.requests_per_minute = requests_per_minute
        self.requests_per_hour = requests_per_hour
        self._minute_requests: list[datetime] = []
        self._hour_requests: list[datetime] = []
        self._lock = asyncio.Lock()
    
    async def acquire(self) -> None:
        """Acquire rate limit permission, blocking if necessary."""
        async with self._lock:
            now = datetime.utcnow()
            
            # Clean old requests
            minute_ago = now - timedelta(minutes=1)
            hour_ago = now - timedelta(hours=1)
            
            self._minute_requests = [req for req in self._minute_requests if req > minute_ago]
            if self.requests_per_hour:
                self._hour_requests = [req for req in self._hour_requests if req > hour_ago]
            
            # Check minute limit
            if len(self._minute_requests) >= self.requests_per_minute:
                sleep_time = 60 - (now - self._minute_requests[0]).total_seconds()
                if sleep_time > 0:
                    logger.info(
                        "Rate limit reached, sleeping",
                        sleep_time=sleep_time,
                        minute_requests=len(self._minute_requests),
                        minute_limit=self.requests_per_minute,
                    )
                    await asyncio.sleep(sleep_time)
                    return await self.acquire()
            
            # Check hour limit
            if self.requests_per_hour and len(self._hour_requests) >= self.requests_per_hour:
                sleep_time = 3600 - (now - self._hour_requests[0]).total_seconds()
                if sleep_time > 0:
                    logger.info(
                        "Hourly rate limit reached, sleeping",
                        sleep_time=sleep_time,
                        hour_requests=len(self._hour_requests),
                        hour_limit=self.requests_per_hour,
                    )
                    await asyncio.sleep(sleep_time)
                    return await self.acquire()
            
            # Record this request
            self._minute_requests.append(now)
            if self.requests_per_hour:
                self._hour_requests.append(now)


class BaseAPIClient:
    """Base class for external API clients with comprehensive error handling."""
    
    def __init__(
        self,
        base_url: str,
        service_name: str,
        requests_per_minute: int = 60,
        requests_per_hour: Optional[int] = None,
        timeout: int = 30,
        max_retries: int = 3,
        circuit_breaker_enabled: bool = True,
        circuit_breaker_failure_threshold: int = 5,
        circuit_breaker_recovery_timeout: int = 60,
    ) -> None:
        """
        Initialize base API client.
        
        Args:
            base_url: Base URL for the API
            service_name: Name of the service (for logging and circuit breaker)
            requests_per_minute: Rate limit per minute
            requests_per_hour: Rate limit per hour (optional)
            timeout: Request timeout in seconds
            max_retries: Maximum retry attempts
            circuit_breaker_enabled: Enable circuit breaker protection
            circuit_breaker_failure_threshold: Circuit breaker failure threshold
            circuit_breaker_recovery_timeout: Circuit breaker recovery timeout
        """
        self.base_url = base_url.rstrip("/")
        self.service_name = service_name
        self.timeout = timeout
        self.max_retries = max_retries
        
        # Initialize HTTP client
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout),
            follow_redirects=True,
        )
        
        # Initialize rate limiter
        self._rate_limiter = RateLimiter(requests_per_minute, requests_per_hour)
        
        # Initialize circuit breaker
        self._circuit_breaker: Optional[CircuitBreaker] = None
        self._circuit_breaker_enabled = circuit_breaker_enabled
        self._circuit_breaker_failure_threshold = circuit_breaker_failure_threshold
        self._circuit_breaker_recovery_timeout = circuit_breaker_recovery_timeout
        self._circuit_breaker_initialized = False
        
        logger.info(
            "API client initialized",
            service=self.service_name,
            base_url=self.base_url,
            timeout=self.timeout,
            max_retries=self.max_retries,
            circuit_breaker_enabled=circuit_breaker_enabled,
        )
    
    async def _ensure_circuit_breaker(self) -> None:
        """Ensure circuit breaker is initialized."""
        if self._circuit_breaker_enabled and not self._circuit_breaker_initialized:
            self._circuit_breaker = await get_circuit_breaker(
                name=f"{self.service_name}_api",
                failure_threshold=self._circuit_breaker_failure_threshold,
                recovery_timeout=self._circuit_breaker_recovery_timeout,
                expected_exception=TransientError,
            )
            self._circuit_breaker_initialized = True
    
    async def __aenter__(self):
        """Async context manager entry."""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()
    
    async def close(self) -> None:
        """Close the HTTP client."""
        await self._client.aclose()
    
    def _build_url(self, endpoint: str) -> str:
        """Build full URL from endpoint."""
        if endpoint.startswith("http"):
            return endpoint
        return urljoin(f"{self.base_url}/", endpoint.lstrip("/"))
    
    def _prepare_headers(self, headers: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        """Prepare request headers with defaults."""
        default_headers = {
            "User-Agent": f"TCGTracker/{self.service_name}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        
        if headers:
            default_headers.update(headers)
        
        return default_headers
    
    @retry_on_transient_error(max_attempts=3, base_delay=1.0, max_delay=30.0)
    async def _make_request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        **kwargs,
    ) -> httpx.Response:
        """
        Make HTTP request with rate limiting and circuit breaker protection.
        
        Args:
            method: HTTP method
            endpoint: API endpoint
            params: Query parameters
            json: JSON payload
            headers: Request headers
            **kwargs: Additional request parameters
            
        Returns:
            HTTP response
            
        Raises:
            APIError: On request failures
        """
        url = self._build_url(endpoint)
        prepared_headers = self._prepare_headers(headers)
        
        # Apply rate limiting
        await self._rate_limiter.acquire()
        
        # Log request
        logger.debug(
            "Making API request",
            service=self.service_name,
            method=method,
            url=url,
            params=params,
        )
        
        # Function to make the actual request
        async def make_request():
            return await safe_request(
                self._client,
                method,
                url,
                params=params,
                json=json,
                headers=prepared_headers,
                **kwargs,
            )
        
        # Ensure circuit breaker is initialized if enabled
        await self._ensure_circuit_breaker()
        
        # Use circuit breaker if enabled
        if self._circuit_breaker:
            try:
                response = await self._circuit_breaker.call(make_request)
            except Exception as exc:
                logger.error(
                    "Request failed through circuit breaker",
                    service=self.service_name,
                    method=method,
                    url=url,
                    error=str(exc),
                    exc_info=exc,
                )
                raise
        else:
            response = await make_request()
        
        # Log successful response
        logger.debug(
            "API request successful",
            service=self.service_name,
            method=method,
            url=url,
            status_code=response.status_code,
        )
        
        return response
    
    async def get(
        self,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        """Make GET request and return JSON response."""
        response = await self._make_request("GET", endpoint, params=params, headers=headers, **kwargs)
        return response.json()
    
    async def post(
        self,
        endpoint: str,
        json: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        """Make POST request and return JSON response."""
        response = await self._make_request("POST", endpoint, params=params, json=json, headers=headers, **kwargs)
        return response.json()
    
    async def put(
        self,
        endpoint: str,
        json: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        """Make PUT request and return JSON response."""
        response = await self._make_request("PUT", endpoint, params=params, json=json, headers=headers, **kwargs)
        return response.json()
    
    async def delete(
        self,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        """Make DELETE request and return JSON response."""
        response = await self._make_request("DELETE", endpoint, params=params, headers=headers, **kwargs)
        return response.json()
    
    async def get_raw(
        self,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        **kwargs,
    ) -> httpx.Response:
        """Make GET request and return raw response."""
        return await self._make_request("GET", endpoint, params=params, headers=headers, **kwargs)
    
    async def health_check(self) -> Dict[str, Any]:
        """
        Perform health check for the API service.
        
        Returns:
            Health check results
        """
        circuit_stats = {}
        if self._circuit_breaker:
            circuit_stats = self._circuit_breaker.get_stats()
        
        return {
            "service": self.service_name,
            "base_url": self.base_url,
            "circuit_breaker": circuit_stats,
            "status": "healthy" if not circuit_stats or circuit_stats["state"] != "open" else "degraded",
        }