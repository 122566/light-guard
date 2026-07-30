"""Mesh Guard 灯具守护 — 米家 BLE Mesh 灯具掉线自愈集成。"""
from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any

from homeassistant.components import frontend
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall

from . import websocket_api
from .circuits import CircuitStore
from .classifier import DeviceClassifier
from .licensing import verify_code
from .const import (
    CONF_COOLDOWN, CONF_CUT_OBSERVE_WINDOW, CONF_MAX_RETRY,
    CONF_OFFLINE_CONFIRM, CONF_POWER_OFF_WAIT, CONF_REJOIN_WINDOW,
    CONF_REPAIR_WINDOWS, CONF_WEWORK_WEBHOOK,
    DEFAULT_COOLDOWN, DEFAULT_CUT_OBSERVE_WINDOW, DEFAULT_MAX_RETRY,
    DEFAULT_OFFLINE_CONFIRM, DEFAULT_POWER_OFF_WAIT, DEFAULT_REJOIN_WINDOW,
    DEFAULT_REPAIR_WINDOWS, DOMAIN,
    PANEL_ICON, PANEL_TITLE, PANEL_URL_PATH,
    SERVICE_APPLY_POWER_ON, SERVICE_REPAIR_NOW, SERVICE_RESCAN,
)
from .monitor import LightMonitor
from .notify import WeWorkNotifier
from .power_on import PowerOnManager
from .profiles import ProfileLibrary
from .recovery import RecoveryExecutor
from .scheduler import RepairScheduler

_LOGGER = logging.getLogger(__name__)

PANEL_JS_URL = f"/api/{DOMAIN}/panel.js"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    # 授权校验（配置流已验证，此处双保险）
    from homeassistant.helpers import instance_id

    ha_uuid = await instance_id.async_get(hass)
    if not verify_code(entry.options.get("activation_code", ""), ha_uuid=ha_uuid):
        from homeassistant.exceptions import ConfigEntryError
        raise ConfigEntryError(
            "授权码无效、已失效或不属于本机，请删除本集成后重新添加并输入有效授权码")
    mgr = MeshGuardManager(hass, entry)
    await mgr.async_setup()
    hass.data.setdefault(DOMAIN, {})["manager"] = mgr

    websocket_api.async_register_ws(hass)
    await _async_register_panel(hass)
    _async_register_services(hass, mgr)
    _LOGGER.info("Mesh Guard 已启动")
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    mgr: MeshGuardManager = hass.data[DOMAIN]["manager"]
    await mgr.async_shutdown()
    frontend.async_remove_panel(hass, PANEL_URL_PATH)
    hass.data[DOMAIN].pop("manager", None)
    return True


async def _async_register_panel(hass: HomeAssistant) -> None:
    from homeassistant.components.http import StaticPathConfig

    www = Path(__file__).parent / "www"
    await hass.http.async_register_static_paths([
        StaticPathConfig(PANEL_JS_URL, str(www / "panel.js"), False)
    ])
    frontend.async_register_built_in_panel(
        hass,
        component_name="custom",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        frontend_url_path=PANEL_URL_PATH,
        config={
            "_panel_custom": {
                "name": "mesh-guard-panel",
                "js_url": PANEL_JS_URL,
                "embed_iframe": True,
                "trust_external": False,
            }
        },
        require_admin=False,
    )


def _async_register_services(hass: HomeAssistant, mgr: "MeshGuardManager") -> None:
    async def _repair_now(call: ServiceCall) -> None:
        await mgr.scheduler.repair_now(call.data["circuit_id"])

    async def _apply_power_on(call: ServiceCall) -> None:
        await mgr.async_apply_power_on(call.data.get("target_label", "断电记忆"))

    async def _rescan(call: ServiceCall) -> None:
        await hass.async_add_executor_job(mgr.classifier.scan)

    for service, handler in (
        (SERVICE_REPAIR_NOW, _repair_now),
        (SERVICE_APPLY_POWER_ON, _apply_power_on),
        (SERVICE_RESCAN, _rescan),
    ):
        if not hass.services.has_service(DOMAIN, service):
            hass.services.async_register(DOMAIN, service, handler)


class MeshGuardManager:
    """集成中枢：装配各模块，向 WS/服务暴露操作。"""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self.entry = entry
        self.store = CircuitStore(hass)
        self.profiles = ProfileLibrary(hass)
        self.classifier = DeviceClassifier(hass)
        self.notifier = WeWorkNotifier()
        self.power_on = PowerOnManager(hass, self.profiles)
        self.executor: RecoveryExecutor | None = None
        self.scheduler: RepairScheduler | None = None
        self.monitor: LightMonitor | None = None
        self._init_tasks()

    # ---------------- 装配 ----------------
    async def async_setup(self) -> None:
        await self.store.async_load()
        await self.profiles.async_load(self.store.settings.get("profiles_data"))

        opt = self.entry.options
        s = {**{
            "offline_confirm": DEFAULT_OFFLINE_CONFIRM,
            "power_off_wait": DEFAULT_POWER_OFF_WAIT,
            "rejoin_window": DEFAULT_REJOIN_WINDOW,
            "cut_observe_window": DEFAULT_CUT_OBSERVE_WINDOW,
            "max_retry": DEFAULT_MAX_RETRY,
            "cooldown": DEFAULT_COOLDOWN,
            "repair_windows": DEFAULT_REPAIR_WINDOWS,
            "settle_after_fail": 60,
            "site_name": "未命名站点",
        }, **self.store.settings, **{
            k: v for k, v in {
                CONF_WEWORK_WEBHOOK: opt.get(CONF_WEWORK_WEBHOOK),
                "site_name": opt.get("site_name"),
            }.items() if v
        }}
        self.store.settings = s
        for dev_id, cls in self.store.overrides.items():
            self.classifier.set_override(dev_id, cls)

        self.notifier.set_url(s.get(CONF_WEWORK_WEBHOOK, ""))
        self.executor = RecoveryExecutor(self.hass, self.profiles, s)
        self.scheduler = RepairScheduler(
            self.hass, self.executor, self.notifier, self.store,
            site_name=s.get("site_name", "未命名站点"))
        self.scheduler.set_windows(s.get("repair_windows", DEFAULT_REPAIR_WINDOWS))
        self.scheduler.is_suppressed = self.is_suppressed

        self.monitor = LightMonitor(
            self.hass, int(s["offline_confirm"]),
            on_circuit_offline=self.scheduler.on_circuit_offline)
        self.monitor.update_circuits(self.store.circuits)
        await self.monitor.async_start()
        await self.scheduler.async_start()

    async def async_shutdown(self) -> None:
        for task in list(self._task_objs.values()):
            task.cancel()
        if self.monitor:
            await self.monitor.async_stop()
        if self.scheduler:
            await self.scheduler.async_stop()
        await self.store.async_save()

    # ---------------- 维护任务系统：后台运行/可停止/监测抑制/同回路互斥 ----------------
    def _init_tasks(self) -> None:
        self.tasks: dict[str, dict] = {}          # task_id -> 任务信息
        self._task_objs: dict[str, asyncio.Task] = {}
        self._suppress: set[str] = set()          # 被抑制掉线上报的 circuit_id

    def is_suppressed(self, circuit_id: str) -> bool:
        return circuit_id in self._suppress

    def circuit_task(self, circuit_id: str) -> dict | None:
        for t in self.tasks.values():
            if t["circuit_id"] == circuit_id and t["status"] == "running":
                return t
        return None

    def task_snapshot(self) -> list[dict]:
        import time as _t
        out = []
        for t in self.tasks.values():
            item = dict(t)
            if item["status"] == "running":
                item["elapsed"] = round(_t.monotonic() - item["started"])
            out.append(item)
        return sorted(out, key=lambda x: -x["started"])

    async def async_start_task(self, kind: str, circuit_id: str) -> dict:
        """启动维护任务（verify/probe），后台运行。"""
        import time
        import uuid

        circuit = self.store.get_circuit(circuit_id)
        if not circuit:
            return {"ok": False, "error": "回路不存在"}
        if self.circuit_task(circuit_id):
            return {"ok": False, "error": "该回路已有任务在运行"}
        if self.scheduler and self.scheduler.states.get(circuit_id) == "repairing":
            return {"ok": False, "error": "该回路正在自动修复中，请稍后再试"}
        # 队列中的回路先出队（人工接管）
        if self.scheduler and circuit_id in self.scheduler.queue:
            self.scheduler.queue.remove(circuit_id)
            self.scheduler.states[circuit_id] = "ok"

        task_id = uuid.uuid4().hex[:10]
        info = {
            "id": task_id, "kind": kind, "circuit_id": circuit_id,
            "circuit_name": circuit["name"], "started": time.monotonic(),
            "started_iso": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "status": "running", "result": None,
        }
        self.tasks[task_id] = info
        self._suppress.add(circuit_id)

        async def _run() -> None:
            try:
                if kind == "verify":
                    info["result"] = await self.async_verify_circuit(circuit)
                else:
                    info["result"] = await self.async_probe_circuit(circuit)
                info["status"] = "done"
            except asyncio.CancelledError:
                info["status"] = "stopped"
                info["result"] = {"ok": False, "msg": "已手动停止（继电器与模式已自动恢复）"}
            except Exception as err:  # noqa: BLE001
                info["status"] = "error"
                info["result"] = {"ok": False, "msg": str(err)}
            finally:
                self._suppress.discard(circuit_id)
                self._task_objs.pop(task_id, None)
                if self.scheduler:
                    self.scheduler._emit()

        self._task_objs[task_id] = self.hass.async_create_background_task(
            _run(), f"mesh_guard_task_{kind}")
        if self.scheduler:
            self.scheduler._emit()
        return {"ok": True, "task": info}

    async def async_stop_task(self, task_id: str) -> bool:
        task = self._task_objs.get(task_id)
        if not task:
            return False
        task.cancel()
        return True

    # ---------------- 对外操作 ----------------
    async def async_reload_monitor(self) -> None:
        if self.monitor:
            await self.monitor.async_stop()
            self.monitor.update_circuits(self.store.circuits)
            await self.monitor.async_start()
        if self.scheduler:
            self.scheduler._emit()

    async def async_set_classification(self, device_id: str, classification: str) -> None:
        if classification == "auto":
            self.classifier.remove_override(device_id)
            self.store.overrides.pop(device_id, None)
        else:
            self.classifier.set_override(device_id, classification)
            self.store.overrides[device_id] = classification
        await self.store.async_save()

    async def _cut_and_observe(self, circuit: dict, window: int) -> tuple[bool, float]:
        """断继电器并观察灯具是否失联（物理裁判）。

        返回 (是否检测到失联, 耗时秒)。无论结果如何都会恢复继电器通电。
        """
        import time

        relay = circuit["relay_entity"]
        lights = circuit["lights"]
        start = time.monotonic()
        await self.hass.services.async_call(
            "switch", "turn_off", {"entity_id": relay}, blocking=True)
        detected = False
        try:
            while time.monotonic() - start < window:
                await asyncio.sleep(15)
                if any((st := self.hass.states.get(le)) is not None
                       and st.state == "unavailable" for le in lights):
                    detected = True
                    break
        finally:
            await self.hass.services.async_call(
                "switch", "turn_on", {"entity_id": relay}, blocking=True)
        return detected, time.monotonic() - start

    async def async_verify_circuit(self, circuit: dict) -> dict:
        """映射验证（检测版）：受控断电并检测灯具是否真的失电。"""
        window = int(self.store.settings.get("cut_observe_window", 540))
        detected, elapsed = await self._cut_and_observe(circuit, window)
        if detected:
            return {"ok": True, "verdict": "success", "elapsed": round(elapsed),
                    "msg": f"断电后灯具如期失联（{elapsed:.0f}s），映射与直断均有效"}
        return {"ok": False, "verdict": "ineffective", "elapsed": round(elapsed),
                "msg": "断电后灯具未失联：可能映射错误，或该开关无线模式下继电器不响应（建议自动探型）"}

    async def async_probe_circuit(self, circuit: dict) -> dict:
        """自动探型：直断 → 模式切换，用灯具失联做裁判，成功则配方入库。"""
        window = int(self.store.settings.get("cut_observe_window", 540))
        model = circuit.get("switch_model") or ""
        steps: list[str] = []

        # Step1 直断
        steps.append("Step1 直断测试：断继电器，观察灯具是否失联")
        detected, el = await self._cut_and_observe(circuit, window)
        if detected:
            steps.append(f"灯具失联（{el:.0f}s）→ 该开关适用【直断法】")
            if model and not self.profiles.get_switch_profile(model):
                self.profiles.set_switch_profile(model, {
                    "method": "direct", "note": "现场自动探型习得"})
                await self._save_profiles()
                steps.append(f"配方已入库：{model} → direct")
            return {"ok": True, "method": "direct", "steps": steps}
        steps.append("直断无效（继电器在无线模式下未物理动作）")

        # Step2 模式切换（需要 select 模式实体）
        mode_entity = circuit.get("mode_entity")
        if not mode_entity:
            steps.append("该按键无模式下拉框 → 疑似打包参数型，请用「学习模式」或联系支持")
            return {"ok": False, "method": None, "steps": steps}
        st = self.hass.states.get(mode_entity)
        options = (st.attributes.get("options") if st else []) or []
        normal = next((o for o in options if "有线" in str(o)), None)
        wireless = next((o for o in options if "无线" in str(o) and "有线" not in str(o)), None)
        if not normal or not wireless:
            steps.append(f"模式下拉框选项无法识别（{options}），转人工")
            return {"ok": False, "method": None, "steps": steps}
        steps.append(f"Step2 模式测试：{mode_entity} → {normal}")
        await self.hass.services.async_call(
            "select", "select_option",
            {"entity_id": mode_entity, "option": normal}, blocking=True)
        await asyncio.sleep(3)
        try:
            detected, el = await self._cut_and_observe(circuit, window)
        finally:
            await self.hass.services.async_call(
                "select", "select_option",
                {"entity_id": mode_entity, "option": wireless}, blocking=True)
        if detected:
            steps.append(f"切模式后灯具失联（{el:.0f}s）→ 适用【模式切换法】，模式已还原")
            if model:
                self.profiles.set_switch_profile(model, {
                    "method": "select", "normal_option": normal,
                    "wireless_option": wireless, "note": "现场自动探型习得"})
                await self._save_profiles()
                steps.append(f"配方已入库：{model} → select（{normal}/{wireless}）")
            return {"ok": True, "method": "select", "steps": steps}
        steps.append("切模式后仍无效 → 疑似打包参数型，请用「学习模式」或联系支持")
        return {"ok": False, "method": None, "steps": steps}

    async def _save_profiles(self) -> None:
        self.store.settings["profiles_data"] = self.profiles.dump()
        await self.store.async_save()

    async def async_poweron_list(self) -> list[dict]:
        """全部灯具的上电状态支持度清单（含不支持的，标注展示）。"""
        from .power_on import find_power_on_entity

        devices = await self.hass.async_add_executor_job(self.classifier.scan)
        lamps = [d for d in devices if d["classification"] == "light" and d["light_entity"]]
        out: list[dict] = []
        for lamp in lamps:
            profile = self.profiles.get_lamp_profile(lamp.get("model"))
            entity_id, modes_map = find_power_on_entity(
                self.hass, lamp["device_id"], profile)
            st = self.hass.states.get(entity_id) if entity_id else None
            out.append({
                "device_id": lamp["device_id"],
                "name": lamp["name"],
                "model": lamp["model"],
                "area_name": lamp.get("area_name", ""),
                "light_entity": lamp["light_entity"],
                "online": lamp.get("online", True),
                "supported": bool(entity_id),
                "entity": entity_id,
                "current": st.state if st else None,
                "options": (st.attributes.get("options") if st else None),
                "modes_map": modes_map,
            })
        return out

    async def async_apply_power_on(self, target_label: str,
                                   device_ids: list[str] | None = None) -> list[dict]:
        devices = await self.hass.async_add_executor_job(self.classifier.scan)
        lamps = [d for d in devices if d["classification"] == "light" and d["light_entity"]]
        if device_ids:
            lamps = [d for d in lamps if d["device_id"] in device_ids]
        return await self.power_on.async_apply(lamps, target_label)

    # ---------------- 设置 ----------------
    def get_settings(self) -> dict:
        s = dict(self.store.settings)
        s["scheduler"] = self.scheduler.snapshot() if self.scheduler else {}
        s["wework_enabled"] = self.notifier.enabled
        return s

    async def async_update_settings(self, new: dict[str, Any]) -> None:
        s = self.store.settings
        s.update(new)
        await self.store.async_save()
        if CONF_WEWORK_WEBHOOK in new:
            self.notifier.set_url(new[CONF_WEWORK_WEBHOOK])
        if "repair_windows" in new and self.scheduler:
            self.scheduler.set_windows(new["repair_windows"])
        if self.executor:
            self.executor.s = s
        if self.scheduler:
            self.scheduler._emit()
