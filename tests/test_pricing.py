"""Tests for the vendor-neutral pricing history helpers."""
from __future__ import annotations

from datetime import date, datetime, timezone

import pytest

from custom_components.home_energy_manager.pricing import (
    PriceHistory,
    PriceRecord,
    PricingRule,
    PricingSchedule,
)


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


def test_pricing_rule_round_trip_preserves_schedule_fields():
    rule = PricingRule(
        rule_id="rule-1",
        effective_date=date(2026, 7, 1),
        effective_end_date=date(2026, 12, 31),
        pricing_type="fixed",
        start_time="13:00",
        end_time="15:00",
        provider="Amber",
        label="Peak afternoon",
        import_rate=28.5,
        export_rate=6.25,
        supply_charge=1.2,
        controlled_load_1=17.0,
        controlled_load_2=11.0,
        additional_charge=0.5,
        holiday_only=True,
        notes="Public holiday override",
        days_of_week=("mon", "tue"),
        metadata={"region": "NSW"},
    )

    restored = PricingRule.from_dict(rule.to_dict())

    assert restored == rule


def test_pricing_schedule_prefers_holiday_override():
    schedule = PricingSchedule(
        rules=[
            PricingRule(
                rule_id="base",
                effective_date=date(2026, 7, 1),
                pricing_type="fixed",
                start_time="00:00",
                end_time="23:59",
                provider="Retailer",
                label="Base tariff",
                import_rate=30.0,
            ),
            PricingRule(
                rule_id="holiday",
                effective_date=date(2026, 7, 16),
                pricing_type="fixed",
                start_time="00:00",
                end_time="23:59",
                provider="Retailer",
                label="Holiday tariff",
                import_rate=18.0,
                holiday_only=True,
            ),
        ],
        holiday_dates=[date(2026, 7, 16)],
    )

    active = schedule.active_rule(datetime(2026, 7, 16, 12, 0, tzinfo=timezone.utc))

    assert active is not None
    assert active.rule_id == "holiday"
