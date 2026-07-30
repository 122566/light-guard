"""配置流：首次添加 + 选项配置。"""
from __future__ import annotations

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.helpers import instance_id

from .const import CONF_WEWORK_WEBHOOK, DOMAIN, TITLE
from .licensing import fingerprint_display, verify_code


class MeshGuardConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        # 前置依赖：必须已安装并配置 xiaomi_home 集成
        if not self.hass.config_entries.async_entries("xiaomi_home"):
            return self.async_abort(reason="missing_xiaomi_home")
        ha_uuid = await instance_id.async_get(self.hass)
        fingerprint = fingerprint_display(ha_uuid)
        errors = {}
        if user_input is not None:
            code = user_input.get("activation_code", "")
            if not verify_code(code, ha_uuid=ha_uuid):
                errors["activation_code"] = "invalid_code"
            else:
                return self.async_create_entry(
                    title=TITLE,
                    data={},
                    options={
                        "site_name": user_input.get("site_name", "未命名站点"),
                        CONF_WEWORK_WEBHOOK: user_input.get(CONF_WEWORK_WEBHOOK, ""),
                        "activation_code": code.strip(),
                    },
                )
        return self.async_show_form(
            step_id="user",
            errors=errors,
            description_placeholders={"fingerprint": fingerprint},
            data_schema=vol.Schema({
                vol.Required("activation_code",
                             default=(user_input or {}).get("activation_code", "")): str,
                vol.Optional("site_name",
                             default=(user_input or {}).get("site_name", "未命名站点")): str,
                vol.Optional(CONF_WEWORK_WEBHOOK,
                             default=(user_input or {}).get(CONF_WEWORK_WEBHOOK, "")): str,
            }),
        )

    @staticmethod
    def async_get_options_flow(config_entry):
        return MeshGuardOptionsFlow(config_entry)


class MeshGuardOptionsFlow(config_entries.OptionsFlow):
    def __init__(self, entry) -> None:
        self._entry = entry

    async def async_step_init(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(data=user_input)
        cur = self._entry.options
        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema({
                vol.Optional("site_name", default=cur.get("site_name", "未命名站点")): str,
                vol.Optional(CONF_WEWORK_WEBHOOK, default=cur.get(CONF_WEWORK_WEBHOOK, "")): str,
            }),
        )
