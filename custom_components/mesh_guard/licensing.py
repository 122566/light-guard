"""授权码验证（离线激活，支持一机一码绑定）。

码结构：
  payload = version(1B) + flags(1B) + id_part(6B)   共 8 字节
    flags bit0 = 1 时，id_part = HA实例指纹(SHA256(uuid)[:6])，即绑定机器
    flags bit0 = 0 时，id_part = 随机数，为不绑机主码（仅限卖家自用）
  sig     = HMAC-SHA256(secret, payload)[:8]        共 8 字节
  code    = base32(payload + sig) → 26 字符，按 4 位分组加横线显示

说明：对称密钥方案，密钥随代码分发，须配合代码混淆提高提取难度。
"""
from __future__ import annotations

import base64
import hashlib
import hmac

_SECRET = bytes.fromhex(
    "211c5864aede81a8b1e9d4538755715a90b7ec1f954025ba57c097c2ba0e41a9")
CODE_VERSION = 1
FLAG_BOUND = 0x01


def machine_fingerprint(ha_uuid: str) -> bytes:
    """HA 实例指纹（6 字节）。"""
    return hashlib.sha256(ha_uuid.encode()).digest()[:6]


def fingerprint_display(ha_uuid: str) -> str:
    """展示用识别码，形如 A1B2-C3D4-E5F6。"""
    text = machine_fingerprint(ha_uuid).hex().upper()
    return "-".join(text[i:i + 4] for i in range(0, len(text), 4))


def _normalize(code: str) -> str:
    text = code.strip().upper().replace("-", "").replace(" ", "")
    return text + "=" * ((8 - len(text) % 8) % 8)


def verify_code(code: str, ha_uuid: str | None = None) -> bool:
    """校验授权码。绑机码必须提供 ha_uuid 且指纹匹配。"""
    try:
        raw = base64.b32decode(_normalize(code))
        if len(raw) != 16:
            return False
        payload, sig = raw[:8], raw[8:]
        expect = hmac.new(_SECRET, payload, hashlib.sha256).digest()[:8]
        if not hmac.compare_digest(sig, expect):
            return False
        if payload[0] != CODE_VERSION:
            return False
        if payload[1] & FLAG_BOUND:
            if not ha_uuid:
                return False
            return hmac.compare_digest(payload[2:8], machine_fingerprint(ha_uuid))
        return True
    except Exception:  # noqa: BLE001
        return False
