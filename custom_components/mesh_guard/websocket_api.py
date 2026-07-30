"""面板 WebSocket API。"""
from __future__ import annotations

import logging
import uuid
from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)


def async_register_ws(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_scan)
    websocket_api.async_register_command(hass, ws_set_class)
    websocket_api.async_register_command(hass, ws_get_circuits)
    websocket_api.async_register_command(hass, ws_save_circuit)
    websocket_api.async_register_command(hass, ws_delete_circuit)
    websocket_api.async_register_command(hass, ws_repair_now)
    websocket_api.async_register_command(hass, ws_verify_circuit)
    websocket_api.async_register_command(hass, ws_probe_circuit)
    websocket_api.async_register_command(hass, ws_task_stop)
    websocket_api.async_register_command(hass, ws_tasks)
    websocket_api.async_register_command(hass, ws_profiles_list)
    websocket_api.async_register_command(hass, ws_profile_set)
    websocket_api.async_register_command(hass, ws_profile_delete)
    websocket_api.async_register_command(hass, ws_poweron_list)
    websocket_api.async_register_command(hass, ws_clear_history)
    websocket_api.async_register_command(hass, ws_power_on_apply)
    websocket_api.async_register_command(hass, ws_power_on_restore)
    websocket_api.async_register_command(hass, ws_get_settings)
    websocket_api.async_register_command(hass, ws_set_settings)
    websocket_api.async_register_command(hass, ws_status)
    websocket_api.async_register_command(hass, ws_subscribe)


def _mgr(hass: HomeAssistant):
    return hass.data[DOMAIN]["manager"]


@websocket_api.websocket_command({"type": f"{DOMAIN}/scan"})
@websocket_api.async_response
async def ws_scan(hass, connection, msg):
    mgr = _mgr(hass)
    devices = await hass.async_add_executor_job(mgr.classifier.scan)
    connection.send_result(msg["id"], {"devices": devices})


@websocket_api.websocket_command({
    "type": f"{DOMAIN}/set_class",
    "device_id": str,
    "classification": str,  # light/wall_switch/actuator/ignore/auto
})
@websocket_api.async_response
async def ws_set_class(hass, connection, msg):
    mgr = _mgr(hass)
    await mgr.async_set_classification(msg["device_id"], msg["classification"])
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command({"type": f"{DOMAIN}/get_circuits"})
@websocket_api.async_response
async def ws_get_circuits(hass, connection, msg):
    mgr = _mgr(hass)
    connection.send_result(msg["id"], {
        "circuits": mgr.store.circuits,
        "scheduler": mgr.scheduler.snapshot(),
    })


@websocket_api.websocket_command({"type": f"{DOMAIN}/save_circuit", "circuit": dict})
@websocket_api.async_response
async def ws_save_circuit(hass, connection, msg):
    mgr = _mgr(hass)
    circuit = dict(msg["circuit"])
    circuit.setdefault("id", uuid.uuid4().hex[:12])
    await mgr.store.upsert_circuit(circuit)
    await mgr.async_reload_monitor()
    connection.send_result(msg["id"], {"circuit": circuit})


@websocket_api.websocket_command({"type": f"{DOMAIN}/delete_circuit", "circuit_id": str})
@websocket_api.async_response
async def ws_delete_circuit(hass, connection, msg):
    mgr = _mgr(hass)
    await mgr.store.remove_circuit(msg["circuit_id"])
    await mgr.async_reload_monitor()
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command({"type": f"{DOMAIN}/repair_now", "circuit_id": str})
@websocket_api.async_response
async def ws_repair_now(hass, connection, msg):
    mgr = _mgr(hass)
    if mgr.circuit_task(msg["circuit_id"]):
        connection.send_error(msg["id"], "task_conflict", "该回路有验证/探型任务在运行，请先停止")
        return
    result = await mgr.scheduler.repair_now(msg["circuit_id"])
    connection.send_result(msg["id"], {"result": result})


@websocket_api.websocket_command({"type": f"{DOMAIN}/verify_circuit", "circuit_id": str})
@websocket_api.async_response
async def ws_verify_circuit(hass, connection, msg):
    """启动映射验证任务（后台运行）。"""
    mgr = _mgr(hass)
    r = await mgr.async_start_task("verify", msg["circuit_id"])
    if not r["ok"]:
        connection.send_error(msg["id"], "task_error", r["error"])
        return
    connection.send_result(msg["id"], {"task": r["task"]})


@websocket_api.websocket_command({"type": f"{DOMAIN}/probe_circuit", "circuit_id": str})
@websocket_api.async_response
async def ws_probe_circuit(hass, connection, msg):
    """启动自动探型任务（后台运行）。"""
    mgr = _mgr(hass)
    r = await mgr.async_start_task("probe", msg["circuit_id"])
    if not r["ok"]:
        connection.send_error(msg["id"], "task_error", r["error"])
        return
    connection.send_result(msg["id"], {"task": r["task"]})


@websocket_api.websocket_command({"type": f"{DOMAIN}/task_stop", "task_id": str})
@websocket_api.async_response
async def ws_task_stop(hass, connection, msg):
    """停止运行中的维护任务（继电器与模式自动恢复）。"""
    mgr = _mgr(hass)
    ok = await mgr.async_stop_task(msg["task_id"])
    connection.send_result(msg["id"], {"ok": ok})


@websocket_api.websocket_command({"type": f"{DOMAIN}/tasks"})
@websocket_api.async_response
async def ws_tasks(hass, connection, msg):
    """维护任务清单（含运行中任务的耗时）。"""
    mgr = _mgr(hass)
    connection.send_result(msg["id"], {"tasks": mgr.task_snapshot()})


@websocket_api.websocket_command({"type": f"{DOMAIN}/profiles_list"})
@websocket_api.async_response
async def ws_profiles_list(hass, connection, msg):
    """配方库：开关恢复配方 + 灯具上电属性。"""
    mgr = _mgr(hass)
    connection.send_result(msg["id"], {
        "switch_profiles": mgr.profiles.switch_profiles,
        "lamp_profiles": mgr.profiles.lamp_profiles,
    })


@websocket_api.websocket_command({
    "type": f"{DOMAIN}/profile_set",
    "scope": str, "model": str, "profile": dict,
})
@websocket_api.async_response
async def ws_profile_set(hass, connection, msg):
    """新增/修改配方（scope: switch | lamp）。"""
    mgr = _mgr(hass)
    if msg["scope"] == "lamp":
        mgr.profiles.lamp_profiles[msg["model"]] = msg["profile"]
    else:
        mgr.profiles.set_switch_profile(msg["model"], msg["profile"])
    await mgr._save_profiles()
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command({
    "type": f"{DOMAIN}/profile_delete",
    "scope": str, "model": str,
})
@websocket_api.async_response
async def ws_profile_delete(hass, connection, msg):
    mgr = _mgr(hass)
    if msg["scope"] == "lamp":
        mgr.profiles.lamp_profiles.pop(msg["model"], None)
    else:
        mgr.profiles.switch_profiles.pop(msg["model"], None)
    await mgr._save_profiles()
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command({"type": f"{DOMAIN}/poweron_list"})
@websocket_api.async_response
async def ws_poweron_list(hass, connection, msg):
    """全部灯具的上电状态支持度清单。"""
    mgr = _mgr(hass)
    connection.send_result(msg["id"], {"lamps": await mgr.async_poweron_list()})


@websocket_api.websocket_command({"type": f"{DOMAIN}/clear_history"})
@websocket_api.async_response
async def ws_clear_history(hass, connection, msg):
    """清空修复记录。"""
    mgr = _mgr(hass)
    await mgr.store.clear_history()
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command({
    "type": f"{DOMAIN}/power_on_apply",
    "target_label": str,
    vol.Optional("device_ids"): [str],
})
@websocket_api.async_response
async def ws_power_on_apply(hass, connection, msg):
    mgr = _mgr(hass)
    results = await mgr.async_apply_power_on(
        msg["target_label"], msg.get("device_ids"))
    connection.send_result(msg["id"], {"results": results})


@websocket_api.websocket_command({"type": f"{DOMAIN}/power_on_restore"})
@websocket_api.async_response
async def ws_power_on_restore(hass, connection, msg):
    mgr = _mgr(hass)
    count = await mgr.power_on.async_restore()
    connection.send_result(msg["id"], {"restored": count})


@websocket_api.websocket_command({"type": f"{DOMAIN}/get_settings"})
@websocket_api.async_response
async def ws_get_settings(hass, connection, msg):
    mgr = _mgr(hass)
    connection.send_result(msg["id"], mgr.get_settings())


@websocket_api.websocket_command({"type": f"{DOMAIN}/set_settings", "settings": dict})
@websocket_api.async_response
async def ws_set_settings(hass, connection, msg):
    mgr = _mgr(hass)
    await mgr.async_update_settings(msg["settings"])
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command({"type": f"{DOMAIN}/status"})
@websocket_api.async_response
async def ws_status(hass, connection, msg):
    mgr = _mgr(hass)
    connection.send_result(msg["id"], {
        "scheduler": mgr.scheduler.snapshot(),
        "tasks": mgr.task_snapshot(),
        "history": mgr.store.history[-50:],
        "circuits": mgr.store.circuits,
    })


@websocket_api.websocket_command({"type": f"{DOMAIN}/subscribe"})
@websocket_api.async_response
async def ws_subscribe(hass, connection, msg):
    mgr = _mgr(hass)

    @callback
    def _push():
        connection.send_message(websocket_api.messages.event_message(
            msg["id"], {"scheduler": mgr.scheduler.snapshot(),
                        "tasks": mgr.task_snapshot()}))

    cancel = mgr.scheduler.add_listener(_push)
    connection.subscriptions[msg["id"]] = cancel
    connection.send_result(msg["id"], None)
