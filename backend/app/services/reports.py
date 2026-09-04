from __future__ import annotations

from datetime import date
from typing import Any
import json

from app.models.schemas import DomainMessage, MessageSeverity


def error(
    rule_id: str,
    message: str,
    *,
    date_value: date | None = None,
    educator_id: str | None = None,
    group_id: str | None = None,
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
        group_id=group_id,
        start_time=start_time,
        end_time=end_time,
        # A validation message must not itself crash when a rule compares a
        # collection (e.g. two weekend teams). The public contract is scalar.
        required_value=required if required is None or isinstance(required, (str, int, float)) else json.dumps(required, ensure_ascii=False, default=str),
        actual_value=actual if actual is None or isinstance(actual, (str, int, float)) else json.dumps(actual, ensure_ascii=False, default=str),
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
