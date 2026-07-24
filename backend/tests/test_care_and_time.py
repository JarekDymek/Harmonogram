from __future__ import annotations

from datetime import date

import pytest

from app.services.care_calculator import calculate_care
from app.services.time_utils import (
    TimeDomainError,
    aware_local_datetime,
    elapsed_minutes,
    normalize_pairs,
    subtract_pairs,
)


def test_interval_normalization_merges_touching_and_overlapping_ranges():
    normalized = normalize_pairs(
        [(360, 480), (450, 540), (540, 600), (720, 780)]
    )
    assert normalized == [(360, 600), (720, 780)]


def test_set_difference_does_not_double_count_minutes():
    result = subtract_pairs(
        normalize_pairs([(360, 600), (540, 720)]),
        normalize_pairs([(420, 480), (450, 540)]),
    )
    assert result == [(360, 420), (540, 720)]
    assert sum(end - start for start, end in result) == 240


def test_demo_care_has_42_complete_dates(demo_config):
    result = calculate_care(demo_config)
    assert len(result) == 42
    assert sum(item.total_required_minutes for item in result[:7]) == 4920


@pytest.mark.parametrize(
    "target_date",
    [date(2026, 3, 29), date(2026, 10, 25)],
)
def test_nonexistent_or_ambiguous_dst_boundary_is_rejected(target_date):
    with pytest.raises(TimeDomainError):
        aware_local_datetime(target_date, 150, "Europe/Warsaw")


def test_elapsed_minutes_uses_real_timeline_across_dst():
    spring = elapsed_minutes(
        date(2026, 3, 28),
        22 * 60,
        date(2026, 3, 29),
        10 * 60,
        "Europe/Warsaw",
    )
    autumn = elapsed_minutes(
        date(2026, 10, 24),
        22 * 60,
        date(2026, 10, 25),
        10 * 60,
        "Europe/Warsaw",
    )
    assert spring == 660
    assert autumn == 780
