"""回路映射与集成数据的持久化存储。"""
from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import STORAGE_KEY, STORAGE_VERSION


class CircuitStore:
    """存储：回路映射、设备人工裁定、设置项。"""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self.circuits: list[dict[str, Any]] = []
        self.overrides: dict[str, str] = {}
        self.settings: dict[str, Any] = {}
        self.history: list[dict[str, Any]] = []

    async def async_load(self) -> None:
        data = await self._store.async_load() or {}
        self.circuits = data.get("circuits", [])
        self.overrides = data.get("overrides", {})
        self.settings = data.get("settings", {})
        self.history = data.get("history", [])[-200:]

    async def async_save(self) -> None:
        await self._store.async_save({
            "circuits": self.circuits,
            "overrides": self.overrides,
            "settings": self.settings,
            "history": self.history[-200:],
        })

    # ---------------- 回路 ----------------
    def get_circuit(self, circuit_id: str) -> dict | None:
        return next((c for c in self.circuits if c["id"] == circuit_id), None)

    async def upsert_circuit(self, circuit: dict[str, Any]) -> None:
        idx = next((i for i, c in enumerate(self.circuits) if c["id"] == circuit["id"]), None)
        if idx is None:
            self.circuits.append(circuit)
        else:
            self.circuits[idx] = circuit
        await self.async_save()

    async def remove_circuit(self, circuit_id: str) -> None:
        self.circuits = [c for c in self.circuits if c["id"] != circuit_id]
        await self.async_save()

    # ---------------- 历史 ----------------
    async def add_history(self, entry: dict[str, Any]) -> None:
        self.history.append(entry)
        self.history = self.history[-200:]
        await self.async_save()

    async def clear_history(self) -> None:
        self.history = []
        await self.async_save()
