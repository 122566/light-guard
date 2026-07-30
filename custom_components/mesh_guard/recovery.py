"""恢复执行器：对单个回路执行断电重启（三种配方）。

状态机：
  前置检查(继电器OFF?) → 取配方 → 断电→延时→复电 → 还原模式(finally) → 复电等待 → 验证
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from homeassistant.core import HomeAssistant

from .const import (
    METHOD_DIRECT, METHOD_NUMBER, METHOD_SELECT,
    REJOIN_POLL_INTERVAL, REPAIR_FAILED,
    REPAIR_MODE_RESTORE_FAILED, REPAIR_SUCCESS,
)

_LOGGER = logging.getLogger(__name__)


class RecoveryResult:
    def __init__(self) -> None:
        self.status: str = REPAIR_FAILED
        self.steps: list[str] = []
        self.duration: float = 0.0
        self.mode_restore_ok: bool = True

    def log(self, msg: str) -> None:
        self.steps.append(msg)
        _LOGGER.info("[恢复] %s", msg)


class RecoveryExecutor:
    def __init__(self, hass: HomeAssistant, profiles, settings: dict[str, Any]) -> None:
        self.hass = hass
        self.profiles = profiles
        self.s = settings  # offline_confirm/power_off_wait/rejoin_window/max_retry...

    async def _call(self, domain: str, service: str, data: dict) -> None:
        await self.hass.services.async_call(domain, service, data, blocking=True)

    def _state(self, entity_id: str) -> str | None:
        st = self.hass.states.get(entity_id)
        return st.state if st else None

    def _lights_online(self, lights: list[str]) -> bool:
        return all(self._state(e) not in (None, "unavailable") for e in lights)

    async def _wait_lights_online(self, lights: list[str], timeout: float) -> bool:
        """复电等待：窗口内轮询，提前在线提前返回。"""
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if self._lights_online(lights):
                return True
            await asyncio.sleep(REJOIN_POLL_INTERVAL)
        return self._lights_online(lights)

    # ------------------------------------------------------------------
    async def async_recover(self, circuit: dict[str, Any]) -> RecoveryResult:
        """执行一次完整恢复（含重试）。"""
        start = time.monotonic()
        result = RecoveryResult()
        relay = circuit["relay_entity"]
        lights = circuit["lights"]
        model = circuit.get("switch_model")
        profile = self.profiles.get_switch_profile(model)

        # 0. 前置检查：继电器本来就 OFF → 直接闭合
        if self._state(relay) == "off":
            result.log(f"继电器 {relay} 原本为 OFF，直接闭合")
            await self._call("switch", "turn_on", {"entity_id": relay})
            if await self._wait_lights_online(lights, self.s["rejoin_window"]):
                result.status = REPAIR_SUCCESS
                result.log("灯具已恢复在线")
            else:
                result.log("闭合继电器后灯具仍未在线")
            result.duration = time.monotonic() - start
            return result

        if not profile:
            result.log(f"型号 {model} 无恢复配方，无法自动恢复")
            result.duration = time.monotonic() - start
            return result

        method = profile["method"]
        max_retry = int(self.s.get("max_retry", 2))
        for attempt in range(1, max_retry + 1):
            result.log(f"—— 第 {attempt}/{max_retry} 次尝试（{method}）——")
            ok, restore_ok = await self._attempt(circuit, profile, result)
            result.mode_restore_ok &= restore_ok
            if ok:
                result.status = REPAIR_SUCCESS
                break
            if attempt < max_retry:
                await asyncio.sleep(int(self.s.get("settle_after_fail", 60)))
        else:
            result.status = REPAIR_FAILED

        if not result.mode_restore_ok and result.status == REPAIR_SUCCESS:
            result.status = REPAIR_MODE_RESTORE_FAILED
        result.duration = time.monotonic() - start
        return result

    # ------------------------------------------------------------------
    async def _attempt(self, circuit, profile, result: RecoveryResult) -> tuple[bool, bool]:
        """单次断电重启尝试。返回 (灯具恢复?, 模式还原正常?)。"""
        relay = circuit["relay_entity"]
        lights = circuit["lights"]
        method = profile["method"]
        mode_restore_ok = True

        # 参数法：由继电器实体前缀 + 画像 buttons 推导 number/verify 实体
        if method == METHOD_NUMBER:
            prefix = relay.split(".", 1)[1].rsplit("_on_p_", 1)[0]
            btn_key = str(circuit.get("button", ""))
            suffix = (profile.get("buttons") or {}).get(btn_key)
            if suffix:
                mode_entity = f"number.{prefix}_{suffix}"
            else:
                mode_entity = circuit.get("mode_entity")
            siid = relay.rsplit("_on_p_", 1)[-1].split("_")[0]
            circuit = {**circuit,
                       "mode_entity": mode_entity,
                       "verify_entity": f"select.{prefix}_mode_p_{siid}_2",
                       "verify_expect": profile.get("wireless_option") or "无线开关"}
        else:
            mode_entity = circuit.get("mode_entity")
        saved_mode: str | None = None

        try:
            # 1. 进入普通模式（如需）
            if method == METHOD_SELECT and mode_entity:
                saved_mode = self._state(mode_entity)
                normal = profile["normal_option"]
                if saved_mode != normal:
                    result.log(f"模式切换：{saved_mode} → {normal}（{mode_entity}）")
                    await self._call("select", "select_option",
                                     {"entity_id": mode_entity, "option": normal})
                    await asyncio.sleep(3)
            elif method == METHOD_NUMBER and mode_entity:
                normal_val = profile["normal_value"]
                result.log(f"写参数：{mode_entity} = {normal_val}（普通模式）")
                await self._call("number", "set_value",
                                 {"entity_id": mode_entity, "value": normal_val})
                await asyncio.sleep(3)

            # 2. 断电
            result.log(f"继电器断电（{relay}）")
            await self._call("switch", "turn_off", {"entity_id": relay})
            await asyncio.sleep(int(self.s["power_off_wait"]))

            # 3. 复电
            result.log("继电器复电")
            await self._call("switch", "turn_on", {"entity_id": relay})

        finally:
            # 4. 还原模式（硬保证）
            try:
                if method == METHOD_SELECT and mode_entity and saved_mode:
                    wireless = profile["wireless_option"]
                    if self._state(mode_entity) != wireless:
                        await self._call("select", "select_option",
                                         {"entity_id": mode_entity, "option": wireless})
                        await asyncio.sleep(3)
                    if self._state(mode_entity) != wireless:
                        mode_restore_ok = False
                        result.log(f"⚠️ 模式还原失败：期望 {wireless}，实际 {self._state(mode_entity)}")
                    else:
                        result.log(f"模式已还原为 {wireless}")
                elif method == METHOD_NUMBER and mode_entity:
                    wireless_val = profile["wireless_value"]
                    await self._call("number", "set_value",
                                     {"entity_id": mode_entity, "value": wireless_val})
                    await asyncio.sleep(3)
                    # ZM 类设备数值会被归一化，以 verify_via 的下拉框回读为准
                    verify_entity = circuit.get("verify_entity")
                    if verify_entity:
                        expect = circuit.get("verify_expect")
                        if expect and self._state(verify_entity) != expect:
                            mode_restore_ok = False
                            result.log(f"⚠️ 模式还原校验失败：{verify_entity}={self._state(verify_entity)}")
                        else:
                            result.log("模式已还原（回读校验通过）")
            except Exception as err:  # noqa: BLE001
                mode_restore_ok = False
                result.log(f"⚠️ 模式还原异常: {err}")

        # 5. 复电等待与验证
        result.log(f"等待灯具回在线（最长 {self.s['rejoin_window']}s）…")
        online = await self._wait_lights_online(lights, self.s["rejoin_window"])
        result.log("灯具已恢复在线 ✅" if online else "灯具仍离线 ❌")
        return online, mode_restore_ok
