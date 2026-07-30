"""企业微信告警通知。"""
from __future__ import annotations

import logging
from typing import Any

import aiohttp

_LOGGER = logging.getLogger(__name__)


class WeWorkNotifier:
    """企业微信群机器人 webhook 推送。"""

    def __init__(self, webhook_url: str = "") -> None:
        self.webhook_url = webhook_url

    def set_url(self, url: str) -> None:
        self.webhook_url = url

    @property
    def enabled(self) -> bool:
        return bool(self.webhook_url)

    async def async_send(self, title: str, content: str, level: str = "info") -> bool:
        if not self.webhook_url:
            _LOGGER.debug("企业微信 webhook 未配置，跳过推送: %s", title)
            return False
        color = {"info": "info", "warning": "warning", "error": "error"}.get(level, "info")
        # 企业微信 markdown 不支持 font color 标签外的颜色，使用 emoji 区分
        icon = {"info": "ℹ️", "success": "✅", "warning": "⚠️", "error": "🚨"}.get(level, "ℹ️")
        payload = {
            "msgtype": "markdown",
            "markdown": {"content": f"## {icon} {title}\n{content}"},
        }
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.webhook_url, json=payload,
                    timeout=aiohttp.ClientTimeout(total=15),
                ) as resp:
                    if resp.status != 200:
                        _LOGGER.warning("企业微信推送失败: HTTP %s", resp.status)
                        return False
                    data = await resp.json()
                    if data.get("errcode") != 0:
                        _LOGGER.warning("企业微信推送被拒: %s", data)
                        return False
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("企业微信推送异常: %s", err)
            return False
        return True


def fmt_repair_report(site: str, circuit: str, lights: list[str],
                      steps: list[str], duration: float, extra: str = "") -> str:
    """格式化恢复报告。"""
    lines = [
        f"> 站点：{site}",
        f"> 回路：{circuit}",
        f"> 灯具：{'、'.join(lights)}",
        f"> 耗时：{duration:.0f}s",
        "",
        "**动作流水**",
    ]
    lines += [f"{i+1}. {s}" for i, s in enumerate(steps)]
    if extra:
        lines += ["", extra]
    return "\n".join(lines)
