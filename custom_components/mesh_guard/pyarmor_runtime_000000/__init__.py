import sys as _sys

if _sys.version_info[:2] >= (3, 14):
    from .py314 import __pyarmor__  # noqa: F401
elif _sys.version_info[:2] >= (3, 13):
    from .py313 import __pyarmor__  # noqa: F401
else:
    from .py312 import __pyarmor__  # noqa: F401
