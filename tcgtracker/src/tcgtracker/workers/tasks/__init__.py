"""Background tasks for TCG Price Tracker."""

from tcgtracker.workers.tasks.alert_tasks import (
    check_all_price_alerts,
    check_price_alert,
)
from tcgtracker.workers.tasks.price_tasks import (
    cleanup_old_price_history,
    update_all_card_prices,
    update_card_price,
)
from tcgtracker.workers.tasks.sync_tasks import (
    sync_card_data,
    sync_pricecharting_data,
    sync_tcg_sets,
)

__all__ = [
    # Price tasks
    "update_card_price",
    "update_all_card_prices",
    "cleanup_old_price_history",
    # Alert tasks
    "check_price_alert",
    "check_all_price_alerts",
    # Sync tasks
    "sync_card_data",
    "sync_pricecharting_data",
    "sync_tcg_sets",
]