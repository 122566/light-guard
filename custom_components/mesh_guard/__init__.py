"""Mesh Guard 灯具守护 — Python 版本自适应装载入口（本文件无需混淆）。"""
import sys as _sys

if _sys.version_info[:2] >= (3, 14):
    from ._py314 import *  # noqa: F401,F403
    from ._py314 import async_setup_entry, async_unload_entry  # noqa: F401
elif _sys.version_info[:2] >= (3, 13):
    from ._py313 import *  # noqa: F401,F403
    from ._py313 import async_setup_entry, async_unload_entry  # noqa: F401
else:
    from ._py312 import *  # noqa: F401,F403
    from ._py312 import async_setup_entry, async_unload_entry  # noqa: F401
