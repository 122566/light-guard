"""灯具上电状态批量设置（断电记忆/来电开灯/来电关灯）。"""
from __future__ import annotations

import logging
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er

_LOGGER = logging.getLogger(__name__)

MODE_LABELS = ["断电记忆", "来电开灯", "来电关灯"]

# 无画像时的通用关键词兜底
_FALLBACK_KEYWORDS = ["default_power_on_state", "power_on", "上电状态", "断电记忆", "上电"]


def find_power_on_entity(hass: HomeAssistant, device_id: str,
                         profile: dict | None) -> tuple[str | None, dict | None]:
    """在灯具设备下找"上电状态"实体。返回 (entity_id, modes_map|None)。"""
    ent_reg = er.async_get(hass)
    entries = er.async_entries_for_device(ent_reg, device_id)
    modes_map = (profile or {}).get("modes")
    keyword = (profile or {}).get("entity_keyword", "")

    def _match(e, kw: str) -> bool:
        if kw and kw in e.entity_id:
            return True
        st = hass.states.get(e.entity_id)
        fn = st.attributes.get("friendly_name", "") if st else ""
        return kw and kw in fn

    for e in entries:
        if not e.entity_id.startswith(("select.", "number.")):
            continue
        if keyword and _match(e, keyword):
            return e.entity_id, modes_map
    # 兜底：关键词模糊匹配
    for e in entries:
        if not e.entity_id.startswith(("select.", "number.")):
            continue
        st = hass.states.get(e.entity_id)
        fn = st.attributes.get("friendly_name", "") if st else ""
        if any(k in e.entity_id or k in fn for k in _FALLBACK_KEYWORDS):
            # 进一步确认选项里有模式词
            opts = st.attributes.get("options", []) if st else []
            if not opts or any("电" in str(o) for o in opts):
                return e.entity_id, None
    return None, None


class PowerOnManager:
    def __init__(self, hass: HomeAssistant, profiles) -> None:
        self.hass = hass
        self.profiles = profiles
        self.last_backup: dict[str, str] = {}  # entity_id -> 原值

    async def async_apply(self, lamps: list[dict[str, Any]],
                          target_label: str) -> list[dict[str, Any]]:
        """批量设置。lamps: [{device_id, light_entity, name, model}]"""
        results: list[dict[str, Any]] = []
        self.last_backup = {}
        for lamp in lamps:
            item: dict[str, Any] = {
                "name": lamp.get("name") or lamp.get("light_entity"),
                "light_entity": lamp.get("light_entity"),
                "status": "failed",
                "detail": "",
            }
            device_id = lamp.get("device_id")
            if not device_id:
                item["status"] = "unsupported"
                item["detail"] = "无此类选项（缺设备信息）"
                results.append(item)
                continue
            profile = self.profiles.get_lamp_profile(lamp.get("model"))
            entity_id, modes_map = find_power_on_entity(self.hass, device_id, profile)
            if not entity_id:
                item["status"] = "unsupported"
                item["detail"] = "无此类选项"
                results.append(item)
                continue

            option = (modes_map or {}).get(target_label, target_label)
            st = self.hass.states.get(entity_id)
            current = st.state if st else None
            self.last_backup[entity_id] = current or ""
            try:
                domain = entity_id.split(".")[0]
                if domain == "select":
                    await self.hass.services.async_call(
                        "select", "select_option",
                        {"entity_id": entity_id, "option": option}, blocking=True)
                else:
                    await self.hass.services.async_call(
                        "number", "set_value",
                        {"entity_id": entity_id, "value": float(option)}, blocking=True)
                await self.hass.async_block_till_done()
                new_st = self.hass.states.get(entity_id)
                item["current_before"] = current
                item["current_after"] = new_st.state if new_st else None
                if new_st and new_st.state == option:
                    item["status"] = "success"
                    item["detail"] = f"{current} → {option}"
                else:
                    item["status"] = "failed"
                    item["detail"] = f"写入后回读={new_st.state if new_st else '?'}"
            except Exception as err:  # noqa: BLE001
                item["status"] = "failed"
                item["detail"] = str(err)
            results.append(item)
        return results

    async def async_restore(self) -> int:
        """一键还原上次批量设置前的值。"""
        restored = 0
        for entity_id, value in self.last_backup.items():
            if not value:
                continue
            domain = entity_id.split(".")[0]
            try:
                if domain == "select":
                    await self.hass.services.async_call(
                        "select", "select_option",
                        {"entity_id": entity_id, "option": value}, blocking=True)
                else:
                    await self.hass.services.async_call(
                        "number", "set_value",
                        {"entity_id": entity_id, "value": float(value)}, blocking=True)
                restored += 1
            except Exception as err:  # noqa: BLE001
                _LOGGER.warning("还原 %s 失败: %s", entity_id, err)
        return restored
