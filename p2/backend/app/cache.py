"""内存 TTL 缓存。akshare 底层是对免费行情站点的爬取,必须限频。"""
import functools
import threading
import time


def ttl_cache(seconds: float):
    """按位置参数缓存函数返回值 seconds 秒。线程安全,进程内共享。"""

    def decorator(fn):
        store: dict = {}
        lock = threading.Lock()

        @functools.wraps(fn)
        def wrapper(*args):
            now = time.monotonic()
            with lock:
                hit = store.get(args)
                if hit is not None and now - hit[0] < seconds:
                    return hit[1]
            value = fn(*args)
            with lock:
                store[args] = (now, value)
            return value

        wrapper.cache_clear = store.clear  # type: ignore[attr-defined]
        return wrapper

    return decorator
