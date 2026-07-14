"""Vendor-neutral pricing history helpers.

This module is intentionally separate from the live reporting/card flow.
It provides a simple data model that can represent:

- fixed import or export tariffs
- time-of-use windows
- dynamic market intervals
- spike or peak export pricing

The current integration does not calculate tariff totals yet. These models
exist so future pricing storage and card views can reuse the same shape.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

_FLOW_VALUES = {"import", "export", "net"}
_MODE_VALUES = {"fixed", "tou", "dynamic", "market"}


def _clean_text(value: Any, default: str = "") -> str:
    text = str(value or "").strip()
    return text or default


def _parse_datetime(value: Any) -> datetime | None:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value
    text = _clean_text(value)
    if not text:
        return None
    if text.endswith("Z"):
        text = f"{text[:-1]}+00:00"
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def _jsonable_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat()


@dataclass(frozen=True, slots=True)
class PriceRecord:
    """One time-bounded tariff record.

    ``flow`` identifies the energy direction being priced. ``mode`` describes
    how the value was sourced. ``priority`` allows narrow spike entries to win
    over broader base rates when windows overlap.
    """

    flow: str
    mode: str
    value: float
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    label: str = ""
    currency: str = "AUD"
    unit: str = "c/kWh"
    source: str = ""
    region: str = ""
    tariff_name: str = ""
    priority: int = 0
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        flow = _clean_text(self.flow).lower()
        mode = _clean_text(self.mode).lower()
        if flow not in _FLOW_VALUES:
            raise ValueError(f"Unsupported flow: {self.flow!r}")
        if mode not in _MODE_VALUES:
            raise ValueError(f"Unsupported mode: {self.mode!r}")
        if self.ends_at is not None and self.starts_at is not None and self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at")
        object.__setattr__(self, "flow", flow)
        object.__setattr__(self, "mode", mode)
        object.__setattr__(self, "label", _clean_text(self.label))
        object.__setattr__(self, "currency", _clean_text(self.currency, "AUD"))
        object.__setattr__(self, "unit", _clean_text(self.unit, "c/kWh"))
        object.__setattr__(self, "source", _clean_text(self.source))
        object.__setattr__(self, "region", _clean_text(self.region))
        object.__setattr__(self, "tariff_name", _clean_text(self.tariff_name))
        object.__setattr__(self, "priority", int(self.priority or 0))
        object.__setattr__(self, "metadata", dict(self.metadata or {}))

    def contains(self, at: datetime) -> bool:
        """Return True when ``at`` falls inside the record window."""
        if self.starts_at is not None and at < self.starts_at:
            return False
        if self.ends_at is not None and at >= self.ends_at:
            return False
        return True

    def to_dict(self) -> dict[str, Any]:
        """Serialize the record to plain JSON-safe data."""
        return {
            "flow": self.flow,
            "mode": self.mode,
            "value": self.value,
            "starts_at": _jsonable_datetime(self.starts_at),
            "ends_at": _jsonable_datetime(self.ends_at),
            "label": self.label,
            "currency": self.currency,
            "unit": self.unit,
            "source": self.source,
            "region": self.region,
            "tariff_name": self.tariff_name,
            "priority": self.priority,
            "metadata": dict(self.metadata),
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "PriceRecord":
        """Build a record from a serialized dictionary."""
        return cls(
            flow=_clean_text(payload.get("flow"), "export"),
            mode=_clean_text(payload.get("mode"), "fixed"),
            value=float(payload.get("value") or 0),
            starts_at=_parse_datetime(payload.get("starts_at")),
            ends_at=_parse_datetime(payload.get("ends_at")),
            label=_clean_text(payload.get("label")),
            currency=_clean_text(payload.get("currency"), "AUD"),
            unit=_clean_text(payload.get("unit"), "c/kWh"),
            source=_clean_text(payload.get("source")),
            region=_clean_text(payload.get("region")),
            tariff_name=_clean_text(payload.get("tariff_name")),
            priority=int(payload.get("priority") or 0),
            metadata=dict(payload.get("metadata") or {}),
        )


@dataclass(slots=True)
class PriceHistory:
    """Ordered collection of pricing records."""

    entries: list[PriceRecord] = field(default_factory=list)

    def add(self, record: PriceRecord) -> None:
        self.entries.append(record)

    def for_flow(self, flow: str) -> list[PriceRecord]:
        flow = _clean_text(flow).lower()
        return [record for record in self.entries if record.flow == flow]

    def active_at(self, at: datetime, *, flow: str | None = None) -> list[PriceRecord]:
        """Return all records active at a point in time."""
        min_start = datetime.min.replace(tzinfo=at.tzinfo) if at.tzinfo is not None else datetime.min
        matches = [
            record
            for record in self.entries
            if record.contains(at) and (flow is None or record.flow == _clean_text(flow).lower())
        ]
        return sorted(
            matches,
            key=lambda record: (record.priority, record.starts_at or min_start),
        )

    def best_match(self, at: datetime, *, flow: str | None = None) -> PriceRecord | None:
        """Return the single best record for a timestamp."""
        matches = self.active_at(at, flow=flow)
        return matches[-1] if matches else None

    def to_dict(self) -> dict[str, Any]:
        return {"entries": [record.to_dict() for record in self.entries]}

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "PriceHistory":
        entries = payload.get("entries") or []
        records = [
            PriceRecord.from_dict(entry)
            for entry in entries
            if isinstance(entry, dict)
        ]
        return cls(entries=records)
