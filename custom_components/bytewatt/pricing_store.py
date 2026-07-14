"""Local persistence helpers for vendor-neutral pricing history."""
from __future__ import annotations

import json
import logging
from copy import deepcopy
from pathlib import Path
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from .pricing import PriceHistory, PriceRecord

_LOGGER = logging.getLogger(__name__)

PRICING_DIR_NAME = "home-energy-manager-pricing"
PRICING_FILE_NAME = "pricing.json"


def _safe_filename(value: str) -> str:
    value = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in str(value or ""))
    value = value.strip("._-")
    return value or "all"


class PriceHistoryStore:
    """Persist pricing records per scope.

    The store is intentionally lightweight:

    - JSON only
    - one file per Home Assistant entry
    - grouped by scope so future cards can render system-specific or
      region-specific pricing views
    """

    def __init__(self, hass: HomeAssistant, entry_id: str) -> None:
        self.hass = hass
        self.entry_id = entry_id
        self.base_dir = Path(hass.config.path("www", PRICING_DIR_NAME, entry_id))
        self.history_file = self.base_dir / PRICING_FILE_NAME

    async def async_store_record(
        self,
        *,
        scope_key: str,
        label: str,
        record: PriceRecord,
    ) -> None:
        """Append a pricing record and persist the JSON file."""
        scope_key = _safe_filename(scope_key)
        try:
            await self.hass.async_add_executor_job(
                self._store_record_sync,
                scope_key,
                label or scope_key,
                record,
            )
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning(
                "Failed to persist pricing record for %s: %s",
                scope_key,
                err,
            )

    async def async_history(self, scope_key: str) -> PriceHistory:
        """Return the stored history for a scope."""
        scope_key = _safe_filename(scope_key)
        try:
            return await self.hass.async_add_executor_job(self._history_sync, scope_key)
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Failed to read pricing history for %s: %s", scope_key, err)
            return PriceHistory()

    def _store_record_sync(self, scope_key: str, label: str, record: PriceRecord) -> None:
        self.base_dir.mkdir(parents=True, exist_ok=True)
        history = self._load_sync()
        scopes = history.setdefault("scopes", {})
        scope = scopes.setdefault(
            scope_key,
            {
                "label": label,
                "records": [],
            },
        )
        scope["label"] = label
        scope["updated"] = dt_util.utcnow().isoformat()
        records = scope.setdefault("records", [])
        if not isinstance(records, list):
            records = []
            scope["records"] = records
        records.append(record.to_dict())
        history["version"] = 1
        history["updated"] = dt_util.utcnow().isoformat()
        self.history_file.write_text(
            json.dumps(history, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    def _load_sync(self) -> dict[str, Any]:
        if not self.history_file.exists():
            return {}
        try:
            return json.loads(self.history_file.read_text(encoding="utf-8"))
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Unable to read existing pricing history file: %s", err)
            return {}

    def _history_sync(self, scope_key: str) -> PriceHistory:
        history = self._load_sync()
        scopes = history.get("scopes") or {}
        scope = scopes.get(scope_key) or {}
        records = scope.get("records") or []
        if not isinstance(records, list):
            return PriceHistory()
        return PriceHistory.from_dict(
            {
                "entries": [
                    deepcopy(record)
                    for record in records
                    if isinstance(record, dict)
                ],
            }
        )
