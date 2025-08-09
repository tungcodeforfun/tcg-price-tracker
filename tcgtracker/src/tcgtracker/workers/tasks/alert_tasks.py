"""Price alert tasks for TCG Price Tracker."""

import asyncio
from datetime import datetime
from typing import List, Optional

import structlog
from celery import Task
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from tcgtracker.database.connection import get_db_manager
from tcgtracker.database.models import Card, UserAlert, PriceHistory, User
from tcgtracker.workers.celery_app import celery_app

logger = structlog.get_logger(__name__)


@celery_app.task(name="check_price_alert")
def check_price_alert(alert_id: int) -> dict:
    """Check a single price alert and trigger if conditions are met.
    
    Args:
        alert_id: ID of the price alert to check
        
    Returns:
        dict: Alert check results
    """
    logger.info(f"Checking price alert {alert_id}")
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(_check_price_alert_async(alert_id))
        return result
    finally:
        loop.close()


async def _check_price_alert_async(alert_id: int) -> dict:
    """Async implementation of price alert check."""
    db_manager = get_db_manager()
    
    async with db_manager.session() as session:
        # Get alert with related data
        result = await session.execute(
            select(UserAlert)
            .options(
                selectinload(UserAlert.card),
                selectinload(UserAlert.user)
            )
            .where(UserAlert.id == alert_id)
        )
        alert = result.scalar_one_or_none()
        
        if not alert:
            logger.error(f"Alert {alert_id} not found")
            return {"error": f"Alert {alert_id} not found"}
        
        if not alert.is_active:
            logger.info(f"Alert {alert_id} is not active")
            return {"status": "inactive", "alert_id": alert_id}
        
        # Get latest price for the card
        price_result = await session.execute(
            select(PriceHistory)
            .where(PriceHistory.card_id == alert.card_id)
            .order_by(PriceHistory.fetched_at.desc())
            .limit(1)
        )
        latest_price = price_result.scalar_one_or_none()
        
        if not latest_price:
            logger.warning(f"No price history for card {alert.card_id}")
            return {
                "status": "no_price_data",
                "alert_id": alert_id,
                "card_id": alert.card_id,
            }
        
        current_price = latest_price.market_price
        triggered = False
        trigger_reason = None
        
        # Check alert conditions
        if alert.alert_type == "price_drop":
            if alert.target_price and current_price <= alert.target_price:
                triggered = True
                trigger_reason = f"Price dropped to ${current_price:.2f} (target: ${alert.target_price:.2f})"
        
        elif alert.alert_type == "price_increase":
            if alert.target_price and current_price >= alert.target_price:
                triggered = True
                trigger_reason = f"Price increased to ${current_price:.2f} (target: ${alert.target_price:.2f})"
        
        elif alert.alert_type == "percentage_change":
            if alert.percentage_change and alert.reference_price:
                change_percent = (
                    (current_price - alert.reference_price) / alert.reference_price * 100
                )
                if abs(change_percent) >= abs(alert.percentage_change):
                    triggered = True
                    trigger_reason = (
                        f"Price changed by {change_percent:.1f}% "
                        f"(${alert.reference_price:.2f} -> ${current_price:.2f})"
                    )
        
        if triggered:
            # Update alert status
            alert.last_triggered = datetime.utcnow()
            alert.trigger_count = (alert.trigger_count or 0) + 1
            
            # Deactivate if one-time alert
            if alert.alert_frequency == "once":
                alert.is_active = False
            
            await session.commit()
            
            # Send notification (implement actual notification logic)
            await _send_alert_notification(
                alert.user,
                alert.card,
                trigger_reason
            )
            
            logger.info(
                f"Alert {alert_id} triggered",
                reason=trigger_reason,
                user_id=alert.user_id,
            )
            
            return {
                "status": "triggered",
                "alert_id": alert_id,
                "reason": trigger_reason,
                "current_price": current_price,
                "timestamp": datetime.utcnow().isoformat(),
            }
        
        return {
            "status": "not_triggered",
            "alert_id": alert_id,
            "current_price": current_price,
            "target_price": alert.target_price,
        }


@celery_app.task(name="check_all_price_alerts")
def check_all_price_alerts() -> dict:
    """Check all active price alerts.
    
    Returns:
        dict: Summary of alert checks
    """
    logger.info("Starting check for all active price alerts")
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(_check_all_price_alerts_async())
        return result
    finally:
        loop.close()


async def _check_all_price_alerts_async() -> dict:
    """Async implementation of checking all alerts."""
    db_manager = get_db_manager()
    
    async with db_manager.session() as session:
        # Get all active alerts
        result = await session.execute(
            select(UserAlert).where(UserAlert.is_active == True)
        )
        alerts = result.scalars().all()
        
        if not alerts:
            logger.info("No active alerts to check")
            return {"status": "no_active_alerts", "count": 0}
        
        logger.info(f"Found {len(alerts)} active alerts to check")
        
        # Queue individual alert check tasks
        check_tasks = []
        for alert in alerts:
            task = check_price_alert.delay(alert.id)
            check_tasks.append(task.id)
        
        return {
            "status": "queued",
            "count": len(alerts),
            "task_ids": check_tasks,
            "timestamp": datetime.utcnow().isoformat(),
        }


async def _send_alert_notification(
    user: User,
    card: Card,
    reason: str
) -> None:
    """Send alert notification to user.
    
    Args:
        user: User to notify
        card: Card that triggered the alert
        reason: Reason for the alert trigger
    """
    # TODO: Implement actual notification logic
    # This could include:
    # - Email notifications
    # - Push notifications
    # - In-app notifications
    # - SMS notifications
    
    logger.info(
        f"Notification sent to user {user.id}",
        card_name=card.name,
        reason=reason,
    )
    
    # Placeholder for notification implementation
    # Example: await send_email(user.email, subject, body)
    pass