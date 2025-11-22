"""Celery application configuration for TCG Price Tracker."""

from celery import Celery
from celery.schedules import crontab

from tcgtracker.config import get_celery_config, get_settings


def create_celery_app() -> Celery:
    """Create and configure Celery application."""
    _ = get_settings()
    celery_config = get_celery_config()

    # Create Celery instance
    app = Celery(
        "tcgtracker",
        broker=celery_config["broker_url"],
        backend=celery_config["result_backend"],
        include=[
            "tcgtracker.workers.tasks.price_tasks",
            "tcgtracker.workers.tasks.alert_tasks",
            "tcgtracker.workers.tasks.sync_tasks",
        ],
    )

    # Update configuration
    app.conf.update(celery_config)

    # Configure task routes
    app.conf.task_routes = {
        "tcgtracker.workers.tasks.price_tasks.*": {"queue": "prices"},
        "tcgtracker.workers.tasks.alert_tasks.*": {"queue": "alerts"},
        "tcgtracker.workers.tasks.sync_tasks.*": {"queue": "sync"},
    }

    # Configure periodic tasks (Celery Beat schedule)
    app.conf.beat_schedule = {
        # Update prices every 6 hours
        "update-all-prices": {
            "task": "tcgtracker.workers.tasks.price_tasks.update_all_card_prices",
            "schedule": crontab(minute=0, hour="*/6"),
            "args": (),
        },
        # Check price alerts every hour
        "check-price-alerts": {
            "task": "tcgtracker.workers.tasks.alert_tasks.check_all_price_alerts",
            "schedule": crontab(minute=0),
            "args": (),
        },
        # Sync TCG sets daily
        "sync-tcg-sets": {
            "task": "tcgtracker.workers.tasks.sync_tasks.sync_tcg_sets",
            "schedule": crontab(minute=0, hour=2),  # Run at 2 AM daily
            "args": (),
        },
        # Clean up old price history weekly
        "cleanup-old-prices": {
            "task": "tcgtracker.workers.tasks.price_tasks.cleanup_old_price_history",
            "schedule": crontab(minute=0, hour=3, day_of_week=1),  # Monday at 3 AM
            "args": (),
        },
    }

    # Configure task time limits
    app.conf.task_time_limit = 3600  # 1 hour hard limit
    app.conf.task_soft_time_limit = 3000  # 50 minutes soft limit

    # Configure result expiration
    app.conf.result_expires = 3600  # Results expire after 1 hour

    # Configure worker settings
    app.conf.worker_log_format = (
        "[%(asctime)s: %(levelname)s/%(processName)s] %(message)s"
    )
    app.conf.worker_task_log_format = "[%(asctime)s: %(levelname)s/%(processName)s][%(task_name)s(%(task_id)s)] %(message)s"

    return app


# Create the Celery app instance
celery_app = create_celery_app()


# Celery tasks discovery
@celery_app.task(bind=True)
def debug_task(self):
    """Debug task for testing Celery setup."""
    print(f"Request: {self.request!r}")
    return "Celery is working!"
