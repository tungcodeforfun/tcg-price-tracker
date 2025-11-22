"""Background workers and task management for TCG Price Tracker."""

from tcgtracker.workers.celery_app import celery_app

__all__ = ["celery_app"]
