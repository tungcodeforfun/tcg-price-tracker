"""Circuit breaker implementation for external API integrations."""

import asyncio
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, Optional, TypeVar

import structlog

logger = structlog.get_logger(__name__)

F = TypeVar("F", bound=Callable[..., Any])


class CircuitState(Enum):
    """Circuit breaker states."""
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Circuit is open, requests are blocked
    HALF_OPEN = "half_open"  # Testing if service is recovered


class CircuitBreakerError(Exception):
    """Exception raised when circuit breaker is open."""
    
    def __init__(self, message: str = "Circuit breaker is open") -> None:
        super().__init__(message)
        self.message = message


class CircuitBreaker:
    """
    Circuit breaker implementation for protecting against cascading failures.
    
    The circuit breaker monitors failures and prevents calls to external services
    when they are likely to fail, allowing them time to recover.
    """
    
    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        expected_exception: type = Exception,
        success_threshold: int = 1,
    ) -> None:
        """
        Initialize circuit breaker.
        
        Args:
            name: Circuit breaker identifier
            failure_threshold: Number of failures before opening circuit
            recovery_timeout: Seconds to wait before trying half-open state
            expected_exception: Exception type that counts as failure
            success_threshold: Number of successes needed to close from half-open
        """
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception
        self.success_threshold = success_threshold
        
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time: Optional[datetime] = None
        self._lock = asyncio.Lock()
        
        logger.info(
            "Circuit breaker initialized",
            name=self.name,
            failure_threshold=self.failure_threshold,
            recovery_timeout=self.recovery_timeout,
        )
    
    @property
    def state(self) -> CircuitState:
        """Get current circuit state."""
        return self._state
    
    @property
    def failure_count(self) -> int:
        """Get current failure count."""
        return self._failure_count
    
    @property
    def is_closed(self) -> bool:
        """Check if circuit is closed (normal operation)."""
        return self._state == CircuitState.CLOSED
    
    @property
    def is_open(self) -> bool:
        """Check if circuit is open (blocked)."""
        return self._state == CircuitState.OPEN
    
    @property
    def is_half_open(self) -> bool:
        """Check if circuit is half-open (testing recovery)."""
        return self._state == CircuitState.HALF_OPEN
    
    async def _should_attempt_reset(self) -> bool:
        """Check if we should attempt to reset from open to half-open."""
        if self._state != CircuitState.OPEN:
            return False
            
        if self._last_failure_time is None:
            return False
            
        time_since_failure = datetime.utcnow() - self._last_failure_time
        return time_since_failure.total_seconds() >= self.recovery_timeout
    
    async def _record_success(self) -> None:
        """Record a successful operation."""
        async with self._lock:
            self._failure_count = 0
            
            if self._state == CircuitState.HALF_OPEN:
                self._success_count += 1
                if self._success_count >= self.success_threshold:
                    self._state = CircuitState.CLOSED
                    self._success_count = 0
                    logger.info(
                        "Circuit breaker closed after recovery",
                        name=self.name,
                        previous_failures=self._failure_count,
                    )
    
    async def _record_failure(self) -> None:
        """Record a failed operation."""
        async with self._lock:
            self._failure_count += 1
            self._last_failure_time = datetime.utcnow()
            self._success_count = 0
            
            if self._state == CircuitState.HALF_OPEN:
                # Failure during half-open immediately opens circuit
                self._state = CircuitState.OPEN
                logger.warning(
                    "Circuit breaker opened from half-open after failure",
                    name=self.name,
                    failure_count=self._failure_count,
                )
            elif self._state == CircuitState.CLOSED and self._failure_count >= self.failure_threshold:
                # Too many failures, open the circuit
                self._state = CircuitState.OPEN
                logger.warning(
                    "Circuit breaker opened due to failure threshold",
                    name=self.name,
                    failure_count=self._failure_count,
                    threshold=self.failure_threshold,
                )
    
    async def call(self, func: Callable, *args, **kwargs) -> Any:
        """
        Execute a function through the circuit breaker.
        
        Args:
            func: Function to execute
            *args: Function arguments
            **kwargs: Function keyword arguments
            
        Returns:
            Function result
            
        Raises:
            CircuitBreakerError: If circuit is open
            Exception: Original exception from function
        """
        # Check if we should attempt reset from open to half-open
        if await self._should_attempt_reset():
            async with self._lock:
                if self._state == CircuitState.OPEN:
                    self._state = CircuitState.HALF_OPEN
                    self._success_count = 0
                    logger.info(
                        "Circuit breaker moved to half-open for testing",
                        name=self.name,
                    )
        
        # Block calls if circuit is open
        if self._state == CircuitState.OPEN:
            logger.warning(
                "Circuit breaker blocked call",
                name=self.name,
                state=self._state.value,
            )
            raise CircuitBreakerError(f"Circuit breaker '{self.name}' is open")
        
        # Attempt the call
        try:
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)
            
            await self._record_success()
            return result
            
        except self.expected_exception as exc:
            await self._record_failure()
            raise
        except Exception as exc:
            # Don't count unexpected exceptions as failures
            logger.warning(
                "Unexpected exception in circuit breaker call",
                name=self.name,
                error=str(exc),
                exc_info=exc,
            )
            raise
    
    def __call__(self, func: F) -> F:
        """
        Use circuit breaker as a decorator.
        
        Args:
            func: Function to protect
            
        Returns:
            Wrapped function
        """
        async def wrapper(*args, **kwargs):
            return await self.call(func, *args, **kwargs)
        
        return wrapper
    
    async def reset(self) -> None:
        """Manually reset the circuit breaker to closed state."""
        async with self._lock:
            self._state = CircuitState.CLOSED
            self._failure_count = 0
            self._success_count = 0
            self._last_failure_time = None
            
        logger.info("Circuit breaker manually reset", name=self.name)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get circuit breaker statistics."""
        return {
            "name": self.name,
            "state": self._state.value,
            "failure_count": self._failure_count,
            "success_count": self._success_count,
            "failure_threshold": self.failure_threshold,
            "last_failure_time": self._last_failure_time.isoformat() if self._last_failure_time else None,
            "recovery_timeout": self.recovery_timeout,
        }


class CircuitBreakerRegistry:
    """Registry for managing multiple circuit breakers."""
    
    def __init__(self) -> None:
        self._breakers: Dict[str, CircuitBreaker] = {}
        self._lock = asyncio.Lock()
    
    async def get_or_create(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        expected_exception: type = Exception,
        success_threshold: int = 1,
    ) -> CircuitBreaker:
        """Get existing circuit breaker or create a new one."""
        async with self._lock:
            if name not in self._breakers:
                self._breakers[name] = CircuitBreaker(
                    name=name,
                    failure_threshold=failure_threshold,
                    recovery_timeout=recovery_timeout,
                    expected_exception=expected_exception,
                    success_threshold=success_threshold,
                )
            return self._breakers[name]
    
    async def get(self, name: str) -> Optional[CircuitBreaker]:
        """Get circuit breaker by name."""
        return self._breakers.get(name)
    
    async def remove(self, name: str) -> bool:
        """Remove circuit breaker by name."""
        async with self._lock:
            return self._breakers.pop(name, None) is not None
    
    async def reset_all(self) -> None:
        """Reset all circuit breakers."""
        async with self._lock:
            for breaker in self._breakers.values():
                await breaker.reset()
    
    def get_all_stats(self) -> Dict[str, Dict[str, Any]]:
        """Get statistics for all circuit breakers."""
        return {name: breaker.get_stats() for name, breaker in self._breakers.items()}


# Global circuit breaker registry
_registry = CircuitBreakerRegistry()


async def get_circuit_breaker(
    name: str,
    failure_threshold: int = 5,
    recovery_timeout: int = 60,
    expected_exception: type = Exception,
    success_threshold: int = 1,
) -> CircuitBreaker:
    """Get or create a circuit breaker from the global registry."""
    return await _registry.get_or_create(
        name=name,
        failure_threshold=failure_threshold,
        recovery_timeout=recovery_timeout,
        expected_exception=expected_exception,
        success_threshold=success_threshold,
    )


async def reset_circuit_breaker(name: str) -> bool:
    """Reset a specific circuit breaker."""
    breaker = await _registry.get(name)
    if breaker:
        await breaker.reset()
        return True
    return False


async def get_circuit_breaker_stats(name: Optional[str] = None) -> Dict[str, Any]:
    """Get circuit breaker statistics."""
    if name:
        breaker = await _registry.get(name)
        return breaker.get_stats() if breaker else {}
    return _registry.get_all_stats()