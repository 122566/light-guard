"""设备画像库：型号 → 恢复配方 / 灯具上电属性。

内置展厅实测数据；支持本地自定义覆盖与中央库（远程 JSON）更新。
"""
from __future__ import annotations

import json
import logging
from typing import Any

import aiohttp

from .const import METHOD_DIRECT, METHOD_NUMBER, METHOD_SELECT

_LOGGER = logging.getLogger(__name__)

# ---- 内置画像（展厅实测 2026-07-29）----
BUILTIN_SWITCH_PROFILES: dict[str, dict[str, Any]] = {
    "tofan.switch.ymd1": {
        "method": METHOD_DIRECT,
        "note": "悠觅Z1：无线开关模式下继电器可直接通断（实测）",
    },
    "090615.switch.aikw3": {
        "method": METHOD_SELECT,
        "note": "PTX AE三开：无线模式直断无效，须切模式（实测）",
        "buttons": {"1": "mode_p_2_2", "2": "mode_p_3_2", "3": "mode_p_4_2"},
        "normal_option": "有线和无线开关",
        "wireless_option": "无线开关",
    },
    "090615.switch.aikw1": {
        "method": METHOD_SELECT,
        "note": "PTX AE一开：同系列推断，未经实测",
        "buttons": {"1": "mode_p_2_2"},
        "normal_option": "有线和无线开关",
        "wireless_option": "无线开关",
    },
    "090615.switch.sk4k": {
        "method": METHOD_SELECT,
        "note": "PTX 四开继电器：同系列推断，未经实测",
        "buttons": {"1": "mode_p_2_2", "2": "mode_p_3_2", "3": "mode_p_4_2", "4": "mode_p_5_2"},
        "normal_option": "有线和无线开关",
        "wireless_option": "无线开关",
    },
    "090615.switch.akstft": {
        "method": METHOD_SELECT,
        "note": "PTX 智能屏幕：同系列推断，未经实测",
        "buttons": {"1": "mode_p_2_2", "2": "mode_p_3_2"},
        "normal_option": "有线和无线开关",
        "wireless_option": "无线开关",
    },
    "yoohoo.switch.bln34": {
        "method": METHOD_SELECT,
        "note": "FRFOX 门厅四开：选项形态同 PTX，未经实测",
        "buttons": {"1": "mode_p_2_2", "2": "mode_p_3_2", "3": "mode_p_4_2", "4": "mode_p_5_2"},
        "normal_option": "有线和无线开关",
        "wireless_option": "无线开关",
    },
    "merten.switch.mdkg4": {
        "method": METHOD_NUMBER,
        "note": "ZM四键：select 仅为显示，写参数物理生效（实测）",
        "buttons": {
            "1": "data_d_p_18_5",
            "2": "data_e_p_18_6",
            "3": "data_f_p_18_7",
            "4": "data_g_p_18_8",
        },
        "normal_value": 83918848,
        "wireless_value": 1426096128,
        "verify_via": "mode_select",
    },
}

# 灯具上电状态画像（按型号逐步补齐；entity_suffix 用 {device} 占位）
BUILTIN_LAMP_PROFILES: dict[str, dict[str, Any]] = {
    "lemesh.light.wy0c15": {
        "note": "乐式泛光/射灯：默认上电状态（实测实体形态）",
        "entity_keyword": "default_power_on_state",
        "modes": {"断电记忆": "断电记忆", "来电开灯": "上电打开", "来电关灯": "上电关闭"},
    },
}


class ProfileLibrary:
    """画像库：内置 + 本地覆盖 + 远程中央库。"""

    def __init__(self, hass) -> None:
        self._hass = hass
        self.switch_profiles: dict[str, dict[str, Any]] = dict(BUILTIN_SWITCH_PROFILES)
        self.lamp_profiles: dict[str, dict[str, Any]] = dict(BUILTIN_LAMP_PROFILES)
        self.remote_url: str = ""
        self.remote_version: int = 0

    async def async_load(self, data: dict | None) -> None:
        """从存储恢复本地自定义画像。"""
        if not data:
            return
        self.switch_profiles.update(data.get("switch_profiles", {}))
        self.lamp_profiles.update(data.get("lamp_profiles", {}))
        self.remote_url = data.get("remote_url", "")

    def dump(self) -> dict:
        return {
            "switch_profiles": self.switch_profiles,
            "lamp_profiles": self.lamp_profiles,
            "remote_url": self.remote_url,
        }

    def get_switch_profile(self, model: str | None) -> dict | None:
        if not model:
            return None
        return self.switch_profiles.get(model)

    def get_lamp_profile(self, model: str | None) -> dict | None:
        if not model:
            return None
        return self.lamp_profiles.get(model)

    def set_switch_profile(self, model: str, profile: dict) -> None:
        self.switch_profiles[model] = profile

    async def async_fetch_remote(self) -> bool:
        """从中央库拉取画像（Gitee/GitHub raw JSON）。"""
        if not self.remote_url:
            return False
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.remote_url, timeout=aiohttp.ClientTimeout(total=20)) as resp:
                    if resp.status != 200:
                        _LOGGER.warning("画像库中央库拉取失败: HTTP %s", resp.status)
                        return False
                    data = json.loads(await resp.text())
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("画像库中央库拉取异常: %s", err)
            return False
        if data.get("version", 0) <= self.remote_version:
            return False
        self.remote_version = data["version"]
        self.switch_profiles.update(data.get("switch_profiles", {}))
        self.lamp_profiles.update(data.get("lamp_profiles", {}))
        _LOGGER.info("画像库已更新到中央库版本 %s", self.remote_version)
        return True
