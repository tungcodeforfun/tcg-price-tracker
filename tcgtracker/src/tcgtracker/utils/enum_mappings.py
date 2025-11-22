"""Centralized enum mapping utilities."""

from tcgtracker.api.schemas import PriceSource
from tcgtracker.database.models import AlertTypeEnum, DataSourceEnum

# Price source mappings
PRICE_SOURCE_TO_DB_SOURCE = {
    PriceSource.TCGPLAYER: DataSourceEnum.TCGPLAYER,
    PriceSource.EBAY: DataSourceEnum.EBAY,
    PriceSource.PRICECHARTING: DataSourceEnum.PRICECHARTING,
    PriceSource.JUSTTCG: DataSourceEnum.JUSTTCG,
    PriceSource.CARDMARKET: DataSourceEnum.CARDMARKET,
    PriceSource.MANUAL: DataSourceEnum.MANUAL,
}

# Alert type mappings
ALERT_TYPE_TO_DB_ENUM = {
    "above": AlertTypeEnum.PRICE_INCREASE,
    "below": AlertTypeEnum.PRICE_DROP,
}

ALERT_TYPE_TO_OPERATOR = {
    "above": ">=",
    "below": "<=",
}


def map_price_source_to_db(api_source: PriceSource) -> DataSourceEnum:
    """Convert API PriceSource to database DataSourceEnum."""
    return PRICE_SOURCE_TO_DB_SOURCE.get(api_source, DataSourceEnum.MANUAL)


def map_alert_type_to_db(alert_type: str) -> tuple[AlertTypeEnum, str]:
    """
    Convert alert type string to database enum and operator.

    Args:
        alert_type: "above" or "below"

    Returns:
        Tuple of (AlertTypeEnum, comparison_operator)
    """
    db_enum = ALERT_TYPE_TO_DB_ENUM[alert_type]
    operator = ALERT_TYPE_TO_OPERATOR[alert_type]
    return db_enum, operator
