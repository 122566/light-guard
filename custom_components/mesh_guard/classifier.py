"""设备自动识别与分类。

四级判据：型号段位 → 实体能力 → 命名习惯 → 置信度人工兜底。
支持人工增删改（override 持久化，重扫不覆盖）。
"""
from __future__ import annotations

import re
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers import (
    area_registry as ar, device_registry as dr, entity_registry as er,
)

from .const import (
    CLASS_ACTUATOR, CLASS_IGNORE, CLASS_LIGHT,
    CLASS_UNCERTAIN, CLASS_WALL_SWITCH,
)

XIAOMI_DOMAIN = "xiaomi_home"

# 品牌段位 → 细分类（非开关非灯的精细归类）
SEGMENT_CLASS_MAP = {
    "curtain": "curtain", "airer": "curtain",
    "airc": "ac", "airf": "ac", "airp": "ac", "airt": "ac",
    "tv": "tv", "box": "tv", "projector": "tv",
    "wifispeaker": "speaker", "sound": "speaker", "speaker": "speaker",
    "sensor": "sensor", "sensor_occupy": "sensor", "magnet": "sensor",
    "motion": "sensor", "illumination": "sensor", "gateway": "sensor",
    "vacuum": "appliance", "camera": "appliance", "washer": "appliance",
    "fridge": "appliance", "oven": "appliance", "microwave": "appliance",
    "dishwasher": "appliance", "toilet": "appliance", "tow": "appliance",
    "waterheater": "appliance", "water_heater": "appliance",
    "fan": "appliance", "dehumidifier": "appliance", "humidifier": "appliance",
    "heater": "appliance", "mosq": "appliance", "watch": "appliance",
    "band": "appliance",
}

# 灯具命名词库（辅助）
LAMP_KEYWORDS = [
    "射灯", "筒灯", "灯带", "氛围灯", "餐厅灯", "柜灯", "床头灯", "床尾灯",
    "镜前灯", "卫浴灯", "玄关灯", "灯箱", "景观灯", "泛光灯", "磁吸灯",
    "顶灯", "边灯", "电视灯", "吊灯", "吸顶灯", "壁灯", "台灯", "落地灯",
    "餐吊", "灯膜", "软膜", "星空", "水纹灯", "夕阳灯", "灯板", "灯牌",
]

# 开关名中的按键数词
_BUTTON_COUNT_WORDS = {"一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8}

_RELAY_RE = re.compile(r"_on_p_(\d+)_1$")
_MODE_RE = re.compile(r"_mode_p_(\d+)_\d+$")
_TOGGLE_RE = re.compile(r"_toggle_a_(\d+)_1$")


def _model_segment(model: str | None) -> str:
    if not model:
        return ""
    parts = model.split(".")
    return parts[1] if len(parts) >= 3 else (parts[0] if parts else "")


def _switch_name_button_count(name: str) -> int | None:
    """从开关命名习惯中解析按键数，如 '玄关左一四(开)' -> 4。"""
    m = re.search(r"([一二两三四五六七八])开?$", name.strip())
    if m:
        return _BUTTON_COUNT_WORDS.get(m.group(1))
    return None


def _lamp_name_match(name: str) -> bool:
    return any(k in name for k in LAMP_KEYWORDS)


class DeviceClassifier:
    """对 xiaomi_home 接入的设备做分类。"""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.overrides: dict[str, str] = {}  # device_id -> classification（人工裁定）

    def set_override(self, device_id: str, classification: str) -> None:
        self.overrides[device_id] = classification

    def remove_override(self, device_id: str) -> None:
        self.overrides.pop(device_id, None)

    # ------------------------------------------------------------------
    def scan(self) -> list[dict[str, Any]]:
        """全量扫描，返回分类结果列表。"""
        dev_reg = dr.async_get(self.hass)
        ent_reg = er.async_get(self.hass)
        area_reg = ar.async_get(self.hass)

        # xiaomi_home 的 config entry ids
        xiaomi_entries = {
            entry.entry_id
            for entry in self.hass.config_entries.async_entries(XIAOMI_DOMAIN)
        }
        if not xiaomi_entries:
            return []

        results: list[dict[str, Any]] = []
        for device in dev_reg.devices.values():
            if not (set(device.config_entries) & xiaomi_entries):
                continue
            entities = er.async_entries_for_device(ent_reg, device.id)
            info = self._classify_device(device, entities)
            area = area_reg.async_get_area(device.area_id) if device.area_id else None
            info["area_name"] = area.name if area else "未分配房间"
            if device.id in self.overrides:
                info["classification"] = self.overrides[device.id]
                info["manual"] = True
                info["confidence"] = "high"
            results.append(info)
        results.sort(key=lambda x: (x["classification"] != CLASS_LIGHT,
                                    x.get("area_name", ""), x["name"]))
        return results

    # ------------------------------------------------------------------
    def _classify_device(self, device, entities) -> dict[str, Any]:
        model = device.model or ""
        name = device.name or model or device.id
        segment = _model_segment(model)

        states = {e.entity_id: self.hass.states.get(e.entity_id) for e in entities}
        domains = {e.entity_id.split(".")[0] for e in entities}

        light_ents = [e for e in entities if e.entity_id.startswith("light.")]
        switch_ents = [e for e in entities if e.entity_id.startswith("switch.")]
        select_ents = [e for e in entities if e.entity_id.startswith("select.")]
        button_ents = [e for e in entities if e.entity_id.startswith("button.")]

        # 继电器实体（on_p_{siid}_1 形态）
        relays: dict[int, str] = {}
        for e in switch_ents:
            m = _RELAY_RE.search(e.entity_id)
            if m:
                relays[int(m.group(1))] = e.entity_id
        # 模式实体 siid -> entity_id
        modes: dict[int, str] = {}
        for e in select_ents:
            m = _MODE_RE.search(e.entity_id)
            if m:
                modes[int(m.group(1))] = e.entity_id
        # toggle 动作
        toggles: dict[int, str] = {}
        for e in button_ents:
            m = _TOGGLE_RE.search(e.entity_id)
            if m:
                toggles[int(m.group(1))] = e.entity_id

        # 主灯实体（排除指示灯，优先带调光）
        def _light_score(e) -> int:
            st = states.get(e.entity_id)
            if "indicator" in e.entity_id:
                return -1
            if st is None:
                return 0
            modes_ = st.attributes.get("supported_color_modes") or []
            score = 1
            if "brightness" in modes_:
                score += 2
            if "color_temp" in modes_:
                score += 3
            if any(c in modes_ for c in ("hs", "rgb", "rgbw", "rgbww", "xy")):
                score += 1
            return score

        main_light = None
        if light_ents:
            best = max(light_ents, key=_light_score)
            if _light_score(best) > 0:
                main_light = best.entity_id

        classification = CLASS_IGNORE
        confidence = "high"
        reasons: list[str] = []

        if segment == "light":
            if main_light:
                classification, confidence = CLASS_LIGHT, "high"
                reasons.append(f"型号段位 light（{model}），含灯实体")
            else:
                classification, confidence = CLASS_UNCERTAIN, "low"
                reasons.append("型号段位 light 但未找到有效灯实体")
        elif segment in ("switch", "controller"):
            if relays:
                if len(relays) >= 2 or modes:
                    classification, confidence = CLASS_WALL_SWITCH, "high"
                    reasons.append(f"型号段位 {segment}，{len(relays)} 路继电器，含按键结构")
                else:
                    classification, confidence = CLASS_ACTUATOR, "medium"
                    reasons.append("单路继电器且无模式实体，疑似通断器/干接点")
            else:
                classification, confidence = CLASS_IGNORE, "medium"
                reasons.append(f"型号段位 {segment}，无继电器实体")
        elif segment == "plug":
            classification, confidence = CLASS_ACTUATOR, "high"
            reasons.append("型号段位 plug（插座/通断器）")
        elif segment in SEGMENT_CLASS_MAP:
            classification = SEGMENT_CLASS_MAP[segment]
            confidence = "high"
            reasons.append(f"型号段位 {segment} → {classification}")
        elif not segment:
            classification, confidence = CLASS_IGNORE, "medium"
            reasons.append("无型号信息，默认忽略")
        else:
            # 未知段位，用实体结构猜
            if main_light and not relays:
                classification, confidence = CLASS_UNCERTAIN, "low"
                reasons.append("型号未知但有灯实体")
            elif relays:
                classification, confidence = CLASS_UNCERTAIN, "low"
                reasons.append("型号未知但有继电器实体")
            else:
                classification, confidence = CLASS_IGNORE, "medium"
                reasons.append(f"型号段位 {segment}，无相关实体")

        # 命名习惯交叉校验（仅辅助调整置信度与备注）
        if classification == CLASS_WALL_SWITCH:
            claimed = _switch_name_button_count(name)
            if claimed is not None:
                if claimed == len(relays):
                    reasons.append(f"命名按键数({claimed})与实体数一致")
                else:
                    confidence = "medium"
                    reasons.append(f"命名按键数({claimed})与实体数({len(relays)})不符，请确认")
        elif classification not in (CLASS_LIGHT, CLASS_WALL_SWITCH, CLASS_ACTUATOR) \
                and _lamp_name_match(name) and main_light:
            classification, confidence = CLASS_UNCERTAIN, "low"
            reasons.append("命名命中灯具词库但型号不匹配，请人工裁定")

        # 按键清单（墙开）
        buttons: list[dict[str, Any]] = []
        if classification in (CLASS_WALL_SWITCH, CLASS_ACTUATOR) and relays:
            for idx, siid in enumerate(sorted(relays), start=1):
                st = states.get(relays[siid])
                label = (st.attributes.get("friendly_name") if st else None) or f"按键{idx}"
                buttons.append({
                    "index": idx,
                    "siid": siid,
                    "label": label,
                    "relay": relays[siid],
                    "mode_entity": modes.get(siid),
                    "toggle_entity": toggles.get(siid),
                })

        return {
            "device_id": device.id,
            "name": name,
            "model": model,
            "manufacturer": device.manufacturer or "",
            "area_id": device.area_id,
            "classification": classification,
            "confidence": confidence,
            "reasons": reasons,
            "manual": device.id in self.overrides,
            "light_entity": main_light,
            "buttons": buttons,
            "online": self._is_online(entities, states),
        }

    @staticmethod
    def _is_online(entities, states) -> bool:
        """任一关键实体非 unavailable 即视为在线。"""
        for e in entities:
            st = states.get(e.entity_id)
            if st is not None and st.state not in ("unavailable", "unknown"):
                return True
        return False
