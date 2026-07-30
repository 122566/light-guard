"""修复调度器：时间窗、队列、执行编排、告警。"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime
from typing import Any

from homeassistant.core import HomeAssistant

from .const import (
    CIRCUIT_FAILED, CIRCUIT_OFFLINE, CIRCUIT_OK,
    CIRCUIT_QUEUED, CIRCUIT_REPAIRING,
    REPAIR_MODE_RESTORE_FAILED, REPAIR_SUCCESS, SCHEDULER_TICK,
)
from .notify import fmt_repair_report
from .recovery import RecoveryExecutor

_LOGGER = logging.getLogger(__name__)


def _parse_windows(windows: list[str]) -> list[tuple[int, int]]:
    """['13:00-14:00'] -> [(46800, 50400)]（秒）"""
    result = []
    for w in windows:
        try:
            start_s, end_s = w.split("-")
            sh, sm = (int(x) for x in start_s.split(":"))
            eh, em = (int(x) for x in end_s.split(":"))
            result.append((sh * 3600 + sm * 60, eh * 3600 + em * 60))
        except (ValueError, AttributeError):
            _LOGGER.warning("无效时间窗配置: %s", w)
    return result


def _in_window(windows: list[tuple[int, int]], now: datetime) -> bool:
    sec = now.hour * 3600 + now.minute * 60 + now.second
    return any(start <= sec < end for start, end in windows)


def _next_window_text(windows: list[tuple[int, int]], now: datetime) -> str:
    sec = now.hour * 3600 + now.minute * 60
    upcoming = [s for s, _ in sorted(windows) if s > sec]
    if upcoming:
        h, m = divmod(upcoming[0], 3600)
        return f"今天 {h:02d}:{m:02d}"
    if windows:
        h, m = divmod(sorted(windows)[0][0], 3600)
        return f"明天 {h:02d}:{m:02d}"
    return "未设置"


class RepairScheduler:
    def __init__(self, hass: HomeAssistant, executor: RecoveryExecutor,
                 notifier, store, site_name: str = "未命名站点") -> None:
        self.hass = hass
        self.executor = executor
        self.notifier = notifier
        self.store = store
        self.site_name = site_name

        self.windows: list[str] = ["13:00-14:00"]
        self.states: dict[str, str] = {}      # circuit_id -> 状态
        self.queue: list[str] = []            # 待修复 circuit_id
        self.last_repair: dict[str, float] = {}  # circuit_id -> 上次修复时间
        self.is_suppressed = None             # 维护任务抑制回调（manager 注入）
        self._task: asyncio.Task | None = None
        self._running = False
        self._listeners: list = []

    # ---------------- 对外 ----------------
    def add_listener(self, cb) -> None:
        self._listeners.append(cb)

    def _emit(self) -> None:
        for cb in self._listeners:
            try:
                cb()
            except Exception:  # noqa: BLE001
                pass

    def set_windows(self, windows: list[str]) -> None:
        self.windows = windows

    async def async_start(self) -> None:
        self._running = True
        self._task = self.hass.async_create_background_task(
            self._tick_loop(), "mesh_guard_scheduler")

    async def async_stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            self._task = None

    def circuit_state(self, circuit_id: str) -> str:
        return self.states.get(circuit_id, CIRCUIT_OK)

    async def on_circuit_offline(self, circuit_id: str) -> None:
        """监测器回调：确认掉线。"""
        if self.is_suppressed and self.is_suppressed(circuit_id):
            _LOGGER.info("回路 %s 掉线上报被抑制（维护任务运行中）", circuit_id)
            return
        circuit = self.store.get_circuit(circuit_id)
        if not circuit:
            return
        if self.states.get(circuit_id) in (CIRCUIT_QUEUED, CIRCUIT_REPAIRING):
            return
        self.states[circuit_id] = CIRCUIT_OFFLINE
        self._emit()

        names = [self._fname(le) for le in circuit["lights"]]
        global_urgent = self.store.settings.get("global_urgent", "follow")
        urgent = (global_urgent == "on"
                  or (global_urgent == "follow" and circuit.get("urgent")))
        if urgent or _in_window(_parse_windows(self.windows), datetime.now()):
            await self.notifier.async_send(
                "发现灯具掉线，立即修复",
                f"> 站点：{self.site_name}\n> 回路：{circuit['name']}\n> 灯具：{'、'.join(names)}",
                "warning")
            await self._enqueue_or_run(circuit_id, immediate=True)
        else:
            nxt = _next_window_text(_parse_windows(self.windows), datetime.now())
            self.states[circuit_id] = CIRCUIT_QUEUED
            if circuit_id not in self.queue:
                self.queue.append(circuit_id)
            await self.notifier.async_send(
                "发现灯具掉线，已排队",
                f"> 站点：{self.site_name}\n> 回路：{circuit['name']}\n> 灯具：{'、'.join(names)}\n> 预计修复：{nxt}",
                "warning")
            self._emit()

    async def repair_now(self, circuit_id: str) -> dict | None:
        """手动立即修复（面板/服务调用）。"""
        return await self._run_repair(circuit_id, manual=True)

    # ---------------- 内部 ----------------
    async def _enqueue_or_run(self, circuit_id: str, immediate: bool = False) -> None:
        if immediate:
            self.hass.async_create_task(self._run_repair(circuit_id))
        elif circuit_id not in self.queue:
            self.queue.append(circuit_id)
        self._emit()

    async def _tick_loop(self) -> None:
        while self._running:
            await asyncio.sleep(SCHEDULER_TICK)
            try:
                await self._tick()
            except Exception as err:  # noqa: BLE001
                _LOGGER.exception("调度器异常: %s", err)

    async def _tick(self) -> None:
        # 队列清理：已恢复的回路出队
        for cid in list(self.queue):
            circuit = self.store.get_circuit(cid)
            if not circuit:
                self.queue.remove(cid)
                continue
            if all(self.hass.states.get(le) and self.hass.states.get(le).state != "unavailable"
                   for le in circuit["lights"]):
                self.queue.remove(cid)
                self.states[cid] = CIRCUIT_OK
                names = [self._fname(le) for le in circuit["lights"]]
                await self.notifier.async_send(
                    "灯具已自行恢复，修复计划已取消 ✅",
                    f"> 站点：{self.site_name}\n> 回路：{circuit['name']}\n"
                    f"> 灯具：{'、'.join(names)}\n> 说明：灯具在排队期间自行恢复在线，无需再执行断电修复",
                    "success")
                self._emit()
        if not self.queue:
            return
        if not _in_window(_parse_windows(self.windows), datetime.now()):
            return
        # 窗口内逐个执行
        cid = self.queue.pop(0)
        await self._run_repair(cid)

    async def _run_repair(self, circuit_id: str, manual: bool = False) -> dict | None:
        circuit = self.store.get_circuit(circuit_id)
        if not circuit or self.states.get(circuit_id) == CIRCUIT_REPAIRING:
            return None
        # 冷却（手动修复豁免）
        if not manual:
            last = self.last_repair.get(circuit_id, 0)
            if time.monotonic() - last < int(self.store.settings.get("cooldown", 1800)):
                _LOGGER.info("回路 %s 冷却中，跳过", circuit_id)
                return None

        self.states[circuit_id] = CIRCUIT_REPAIRING
        if circuit_id in self.queue:
            self.queue.remove(circuit_id)
        self._emit()

        result = await self.executor.async_recover(circuit)
        self.last_repair[circuit_id] = time.monotonic()

        names = [self._fname(le) for le in circuit["lights"]]
        report = fmt_repair_report(
            self.site_name, circuit["name"], names, result.steps, result.duration)
        entry = {
            "ts": datetime.now().isoformat(timespec="seconds"),
            "circuit": circuit["name"],
            "status": result.status,
            "duration": round(result.duration, 1),
            "manual": manual,
        }
        await self.store.add_history(entry)

        if result.status == REPAIR_SUCCESS:
            self.states[circuit_id] = CIRCUIT_OK
            await self.notifier.async_send("掉线灯具已恢复 ✅", report, "success")
        elif result.status == REPAIR_MODE_RESTORE_FAILED:
            self.states[circuit_id] = CIRCUIT_OK
            await self.notifier.async_send("灯具已恢复，但模式还原失败，请现场检查 ⚠️", report, "error")
        else:
            self.states[circuit_id] = CIRCUIT_FAILED
            await self.notifier.async_send("自动恢复失败，需人工处理 🚨", report, "error")
        self._emit()
        return {"status": result.status, "steps": result.steps, "duration": result.duration}

    def _fname(self, entity_id: str) -> str:
        st = self.hass.states.get(entity_id)
        return st.attributes.get("friendly_name", entity_id) if st else entity_id

    def snapshot(self) -> dict:
        now = datetime.now()
        in_win = _in_window(_parse_windows(self.windows), now)
        return {
            "windows": self.windows,
            "in_window": in_win,
            "next_window": _next_window_text(_parse_windows(self.windows), now),
            "queue": list(self.queue),
            "states": dict(self.states),
            "global_urgent": self.store.settings.get("global_urgent", "follow"),
        }
