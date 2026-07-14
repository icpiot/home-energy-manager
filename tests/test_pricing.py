"""Tests for the vendor-neutral pricing history helpers."""
from __future__ import annotations

from datetime import datetime, timezone

import pytest

from custom_components.bytewatt.pricing import PriceHistory, PriceRecord


def test_price_record_round_trip_preserves_fields():
    record = PriceRecord(
        flow="export",
        mode="dynamic",
        value=18.75,
        starts_at=datetime(2026, 7, 14, 14, 0, tzinfo=timezone.utc),
        ends_at=datetime(2026, 7, 14, 14, 30, tzinfo=timezone.utc),
        label="Spike export",
        currency="AUD",
        unit="c/kWh",
        source="AEMO",
        region="NSW",
        tariff_name="Peak window",
        priority=100,
        metadata={"interval_minutes": 30},
    )

    restored = PriceRecord.from_dict(record.to_dict())

    assert restored == record


def test_price_history_prefers_high_priority_window():
    history = PriceHistory()
    history.add(
        PriceRecord(
            flow="export",
            mode="fixed",
            value=8.0,
            starts_at=datetime(2026, 7, 14, 0, 0, tzinfo=timezone.utc),
            ends_at=datetime(2026, 7, 15, 0, 0, tzinfo=timezone.utc),
            label="Base export",
            priority=0,
        )
    )
    history.add(
        PriceRecord(
            flow="export",
            mode="dynamic",
            value=34.0,
            starts_at=datetime(2026, 7, 14, 14, 0, tzinfo=timezone.utc),
            ends_at=datetime(2026, 7, 14, 14, 30, tzinfo=timezone.utc),
            label="Spike export",
            priority=100,
        )
    )

    spike = history.best_match(
        datetime(2026, 7, 14, 14, 15, tzinfo=timezone.utc),
        flow="export",
    )
    base = history.best_match(
        datetime(2026, 7, 14, 15, 0, tzinfo=timezone.utc),
        flow="export",
    )

    assert spike is not None
    assert spike.label == "Spike export"
    assert spike.value == 34.0
    assert base is not None
    assert base.label == "Base export"


def test_price_history_filters_by_flow():
    history = PriceHistory(
        entries=[
            PriceRecord(
                flow="import",
                mode="tou",
                value=22.0,
                starts_at=datetime(2026, 7, 14, 7, 0, tzinfo=timezone.utc),
                ends_at=datetime(2026, 7, 14, 9, 0, tzinfo=timezone.utc),
            ),
            PriceRecord(
                flow="export",
                mode="tou",
                value=7.5,
                starts_at=datetime(2026, 7, 14, 7, 0, tzinfo=timezone.utc),
                ends_at=datetime(2026, 7, 14, 9, 0, tzinfo=timezone.utc),
            ),
        ]
    )

    active_export = history.active_at(
        datetime(2026, 7, 14, 8, 0, tzinfo=timezone.utc),
        flow="export",
    )
    active_import = history.active_at(
        datetime(2026, 7, 14, 8, 0, tzinfo=timezone.utc),
        flow="import",
    )

    assert len(active_export) == 1
    assert active_export[0].flow == "export"
    assert len(active_import) == 1
    assert active_import[0].flow == "import"


def test_price_history_round_trip_preserves_entries():
    history = PriceHistory(
        entries=[
            PriceRecord(
                flow="export",
                mode="market",
                value=19.0,
                starts_at=datetime(2026, 7, 14, 14, 0, tzinfo=timezone.utc),
                ends_at=datetime(2026, 7, 14, 14, 30, tzinfo=timezone.utc),
                label="Dynamic export",
                priority=50,
            )
        ]
    )

    restored = PriceHistory.from_dict(history.to_dict())

    assert restored == history


def test_price_record_rejects_bad_time_window():
    with pytest.raises(ValueError):
        PriceRecord(
            flow="export",
            mode="fixed",
            value=10.0,
            starts_at=datetime(2026, 7, 14, 9, 0, tzinfo=timezone.utc),
            ends_at=datetime(2026, 7, 14, 8, 0, tzinfo=timezone.utc),
        )
