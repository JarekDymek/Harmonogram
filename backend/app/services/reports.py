from __future__ import annotations

from datetime import date
from typing import Any

from app.models.schemas import DomainMessage, MessageSeverity


def error(
    rule_id: str,
    message: str,
    *,
    date_value: date | None = None,
    educator_id: str | None = None,
    start_time: str | None = None,
    end_time: str | None = None,
    required: str | int | float | None = None,
    actual: str | int | float | None = None,
    context: dict[str, Any] | None = None,
) -> DomainMessage:
    return DomainMessage(
        rule_id=rule_id,
        severity=MessageSeverity.ERROR,
        message=message,
        date=date_value,
        educator_id=educator_id,
        start_time=start_time,
        end_time=end_time,
        required_value=required,
        actual_value=actual,
        context=context or {},
    )


def warning(
    rule_id: str,
    message: str,
    **kwargs: Any,
) -> DomainMessage:
    item = error(rule_id, message, **kwargs)
    item.severity = MessageSeverity.WARNING
    return item


def info(rule_id: str, message: str, **kwargs: Any) -> DomainMessage:
    item = error(rule_id, message, **kwargs)
    item.severity = MessageSeverity.INFO
    return item
