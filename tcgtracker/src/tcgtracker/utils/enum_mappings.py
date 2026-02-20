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

# Reverse mapping: DB enum → API string
DB_ENUM_TO_ALERT_TYPE = {
    AlertTypeEnum.PRICE_INCREASE: "above",
    AlertTypeEnum.PRICE_DROP: "below",
}

# Also map by enum string value for when Pydantic has already resolved to string
_DB_ALERT_VALUE_TO_API = {e.value: v for e, v in DB_ENUM_TO_ALERT_TYPE.items()}


def map_price_source_to_db(api_source: PriceSource) -> DataSourceEnum:
    """Convert API PriceSource to database DataSourceEnum."""
    return PRICE_SOURCE_TO_DB_SOURCE.get(api_source, DataSourceEnum.MANUAL)


def map_db_alert_type_to_api(db_alert_type: object) -> str:
    """Convert database AlertTypeEnum back to API format ("above"/"below").

    Handles both AlertTypeEnum members and their string values,
    since Pydantic may resolve the enum at different stages.
    """
    if isinstance(db_alert_type, AlertTypeEnum):
        return DB_ENUM_TO_ALERT_TYPE.get(db_alert_type, str(db_alert_type.value))
    if isinstance(db_alert_type, str):
        return _DB_ALERT_VALUE_TO_API.get(db_alert_type, db_alert_type)
    return str(db_alert_type)


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
