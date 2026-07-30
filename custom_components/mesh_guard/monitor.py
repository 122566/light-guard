"""监测器：监听映射灯具的离线事件，防抖后交给调度器。"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Callable

from homeassistant.core import Event, HomeAssistant
from homeassistant.helpers.event import async_track_state_change_event

_LOGGER = logging.getLogger(__name__)


class LightMonitor:
    """监听所有回路灯具实体的 unavailable 状态。"""

    def __init__(self, hass: HomeAssistant, offline_confirm: int,
                 on_circuit_offline: Callable[[str], Any]) -> None:
        self.hass = hass
        self.offline_confirm = offline_confirm
        self._on_circuit_offline = on_circuit_offline
        self._unsub = None
        self._circuits: list[dict] = []
        self._pending: dict[str, float] = {}   # light_entity -> unavailable 起始时间
        self._reported: set[str] = set()        # 已上报的 circuit_id（防重复）
        self._watch_task: asyncio.Task | None = None

    def update_circuits(self, circuits: list[dict]) -> None:
        self._circuits = circuits
        self._reported = {
            cid for cid in self._reported
            if any(c["id"] == cid for c in circuits)
        }

    def _light_to_circuit(self) -> dict[str, str]:
        mapping = {}
        for c in self._circuits:
            for le in c.get("lights", []):
                mapping[le] = c["id"]
        return mapping

    async def async_start(self) -> None:
        lights = list(self._light_to_circuit())
        if not lights:
            return
        self._unsub = async_track_state_change_event(
            self.hass, lights, self._handle_state_change)
        self._watch_task = self.hass.async_create_background_task(
            self._watch_loop(), "mesh_guard_monitor")
        _LOGGER.info("监测器已启动，监听 %d 个灯具实体", len(lights))

    async def async_stop(self) -> None:
        if self._unsub:
            self._unsub()
            self._unsub = None
        if self._watch_task:
            self._watch_task.cancel()
            self._watch_task = None

    def _handle_state_change(self, event: Event) -> None:
        entity_id = event.data["entity_id"]
        new = event.data.get("new_state")
        old = event.data.get("old_state")
        new_state = new.state if new else None
        old_state = old.state if old else None
        if new_state == "unavailable" and old_state != "unavailable":
            self._pending.setdefault(entity_id, time.monotonic())
            _LOGGER.info("灯具疑似掉线: %s（进入防抖观察）", entity_id)
        elif new_state != "unavailable":
            if entity_id in self._pending:
                self._pending.pop(entity_id, None)
                _LOGGER.info("灯具自行恢复: %s（取消掉线判定）", entity_id)
            # 任何恢复（自动/手动）都解除回路的"已上报"标记，允许下次再报
            circuit_id = self._light_to_circuit().get(entity_id)
            if circuit_id:
                self._reported.discard(circuit_id)

    async def _watch_loop(self) -> None:
        while True:
            await asyncio.sleep(5)
            now = time.monotonic()
            mapping = self._light_to_circuit()
            for entity_id, since in list(self._pending.items()):
                if now - since < self.offline_confirm:
                    continue
                circuit_id = mapping.get(entity_id)
                if not circuit_id or circuit_id in self._reported:
                    continue
                self._reported.add(circuit_id)
                self._pending.pop(entity_id, None)
                _LOGGER.warning("确认掉线: %s → 回路 %s", entity_id, circuit_id)
                await self._on_circuit_offline(circuit_id)

    def mark_recovered(self, circuit_id: str) -> None:
        self._reported.discard(circuit_id)
