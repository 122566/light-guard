"""配置流入口 — Python 版本自适应装载（本文件无需混淆）。"""
import sys as _sys

if _sys.version_info[:2] >= (3, 14):
    from ._py314.config_flow import *  # noqa: F401,F403
else:
    from ._py313.config_flow import *  # noqa: F401,F403
