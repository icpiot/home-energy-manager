"""Tests for pricing history persistence helpers."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from custom_components.bytewatt.pricing import PriceRecord
from custom_components.bytewatt.pricing_store import PriceHistoryStore


class _FakeConfig:
    def __init__(self, base_dir: Path) -> None:
        self._base_dir = base_dir

    def path(self, *parts: str) -> str:
        return str(self._base_dir.joinpath(*parts))


class _FakeHass:
    def __init__(self, base_dir: Path) -> None:
        self.config = _FakeConfig(base_dir)

    async def async_add_executor_job(self, func, *args):
        return func(*args)


def test_pricing_store_persists_and_loads_records(tmp_path):
    store = PriceHistoryStore(_FakeHass(tmp_path), "entry-1")
    record = PriceRecord(
        flow="export",
        mode="dynamic",
        value=31.5,
        starts_at=datetime(2026, 7, 14, 14, 0, tzinfo=timezone.utc),
        ends_at=datetime(2026, 7, 14, 14, 30, tzinfo=timezone.utc),
        label="Spike export",
        source="AEMO",
        region="NSW",
        priority=100,
    )

    # Persist to JSON and load back through the same store.
    import asyncio

    asyncio.run(store.async_store_record(scope_key="nsw", label="NSW", record=record))
    history = asyncio.run(store.async_history("nsw"))

    assert len(history.entries) == 1
    assert history.entries[0] == record

    payload = (tmp_path / "www" / "home-energy-manager-pricing" / "entry-1" / "pricing.json").read_text(encoding="utf-8")
    assert '"scope_key"' not in payload
    assert '"NSW"' in payload


def test_pricing_store_uses_safe_scope_names(tmp_path):
    store = PriceHistoryStore(_FakeHass(tmp_path), "entry-1")
    record = PriceRecord(flow="import", mode="fixed", value=25.0)

    import asyncio

    asyncio.run(store.async_store_record(scope_key="../evil scope", label="All systems", record=record))

    assert (tmp_path / "www" / "home-energy-manager-pricing" / "entry-1" / "pricing.json").exists()
