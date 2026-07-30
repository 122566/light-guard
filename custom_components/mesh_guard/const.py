"""Mesh Guard 常量定义。"""
from __future__ import annotations

DOMAIN = "mesh_guard"
TITLE = "Mesh Guard 灯具守护"

# 存储
STORAGE_KEY = f"{DOMAIN}.store"
STORAGE_VERSION = 1

# 画像库（内置实测数据，可被本地/中央库覆盖）
PROFILES_STORAGE_KEY = f"{DOMAIN}.profiles"
PROFILES_STORAGE_VERSION = 1

# 默认时序参数（秒）
DEFAULT_OFFLINE_CONFIRM = 120
DEFAULT_POWER_OFF_WAIT = 5
DEFAULT_REJOIN_WINDOW = 300
DEFAULT_CUT_OBSERVE_WINDOW = 540  # 实测米家离线标记延迟约 440s，须留足余量
DEFAULT_SETTLE_AFTER_FAIL = 60
DEFAULT_MAX_RETRY = 2
DEFAULT_COOLDOWN = 30 * 60
DEFAULT_REPAIR_WINDOWS = ["13:00-14:00"]

# 轮询间隔
REJOIN_POLL_INTERVAL = 10
OBSERVE_POLL_INTERVAL = 15
SCHEDULER_TICK = 15

# 设备分类
CLASS_LIGHT = "light"          # 灯具
CLASS_WALL_SWITCH = "wall_switch"  # 墙开（按键级）
CLASS_ACTUATOR = "actuator"    # 通断器/插座（整机级）
CLASS_CURTAIN = "curtain"      # 窗帘
CLASS_SENSOR = "sensor"        # 传感器
CLASS_TV = "tv"                # 电视/盒子/投影
CLASS_SPEAKER = "speaker"      # 音箱
CLASS_AC = "ac"                # 空调
CLASS_APPLIANCE = "appliance"  # 家用电器/其他
CLASS_IGNORE = "ignore"        # 忽略
CLASS_UNCERTAIN = "uncertain"  # 待确认

CLASS_LABELS = {
    CLASS_LIGHT: "灯具",
    CLASS_WALL_SWITCH: "墙开",
    CLASS_ACTUATOR: "执行器",
    CLASS_CURTAIN: "窗帘",
    CLASS_SENSOR: "传感器",
    CLASS_TV: "电视",
    CLASS_SPEAKER: "音箱",
    CLASS_AC: "空调",
    CLASS_APPLIANCE: "家用电器",
    CLASS_IGNORE: "忽略",
    CLASS_UNCERTAIN: "待确认",
}

# 参与接线映射的分类
MAPPING_LIGHT_CLASSES = {CLASS_LIGHT}
MAPPING_SWITCH_CLASSES = {CLASS_WALL_SWITCH, CLASS_ACTUATOR}

# 恢复方法
METHOD_DIRECT = "direct"
METHOD_SELECT = "select"
METHOD_NUMBER = "number"

METHOD_LABELS = {
    METHOD_DIRECT: "直断法",
    METHOD_SELECT: "模式切换法",
    METHOD_NUMBER: "参数法",
}

# 回路状态
CIRCUIT_OK = "ok"
CIRCUIT_OFFLINE = "offline"
CIRCUIT_QUEUED = "queued"
CIRCUIT_REPAIRING = "repairing"
CIRCUIT_FAILED = "failed"

# 修复结果
REPAIR_SUCCESS = "success"
REPAIR_FAILED = "failed"
REPAIR_MODE_RESTORE_FAILED = "mode_restore_failed"

# 配置项
CONF_WEWORK_WEBHOOK = "wework_webhook"
CONF_OFFLINE_CONFIRM = "offline_confirm"
CONF_POWER_OFF_WAIT = "power_off_wait"
CONF_REJOIN_WINDOW = "rejoin_window"
CONF_CUT_OBSERVE_WINDOW = "cut_observe_window"
CONF_MAX_RETRY = "max_retry"
CONF_COOLDOWN = "cooldown"
CONF_REPAIR_WINDOWS = "repair_windows"

# 服务
SERVICE_REPAIR_NOW = "repair_now"
SERVICE_APPLY_POWER_ON = "apply_power_on"
SERVICE_RESCAN = "rescan_devices"

# WS 命令
WS_PREFIX = f"{DOMAIN}"

# 面板
PANEL_URL_PATH = "mesh-guard"
PANEL_TITLE = "灯具守护"
PANEL_ICON = "mdi:lightbulb-auto-outline"
