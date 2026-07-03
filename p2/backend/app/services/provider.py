"""数据提供层:按 P2_DATA_SOURCE 在 akshare / mock 之间选择,auto 模式失败自动降级。

每个函数返回 (data, source),source ∈ {"akshare", "mock"},由路由透传给前端展示。
缓存加在真实源上(akshare 是爬虫接口,必须限频);mock 本身确定性无需缓存。
"""
from __future__ import annotations

import logging

from .. import config
from ..cache import ttl_cache
from . import akshare_client as real
from . import mock_client as mock

log = logging.getLogger("p2.provider")


class UpstreamError(Exception):
    """akshare 模式下真实源失败。"""


def _call(real_fn, mock_fn, *args):
    if config.DATA_SOURCE == "mock":
        return mock_fn(*args), "mock"
    try:
        return real_fn(*args), "akshare"
    except Exception as e:
        if config.DATA_SOURCE == "akshare":
            raise UpstreamError(f"akshare 拉取失败: {type(e).__name__}: {e}") from e
        log.warning("akshare 失败,降级 mock: %s: %s", type(e).__name__, e)
        return mock_fn(*args), "mock"


# --- 真实源加 TTL 缓存(秒) ---
_spot = ttl_cache(30)(real.spot)
_kline = ttl_cache(300)(real.kline)
_fundflow = ttl_cache(300)(real.fundflow)
_ff_rank = ttl_cache(60)(real.fundflow_rank)
_heat = ttl_cache(600)(real.stock_heat)
_market = ttl_cache(60)(real.market_activity)


def spot():
    return _call(_spot, mock.spot)


def quotes(codes: list[str]):
    """按代码取快照。真实源:全市场快照过滤;mock 源:任意代码按需合成,
    保证降级模式下新添加的股票也能显示名称与价格。"""
    rows, source = spot()
    by_code = {r["code"]: r for r in rows}
    if source == "mock":
        return [by_code.get(c) or mock.quote_of(c) for c in codes], source
    return [by_code[c] for c in codes if c in by_code], source


def search(kw: str):
    """按代码/名称模糊搜索。mock 源下 6 位代码未命中时合成结果,
    避免降级模式搜索科创板等池外股票无响应。"""
    rows, source = spot()
    kw = kw.strip().lower()
    hits = [r for r in rows if kw in r["code"] or kw in r["name"].lower()]
    if not hits and source == "mock" and kw.isdigit() and len(kw) == 6:
        hits = [mock.quote_of(kw)]
    return hits, source


def kline(code: str, period: str, adjust: str):
    return _call(_kline, mock.kline, code, period, adjust)


def fundflow(code: str):
    return _call(_fundflow, mock.fundflow, code)


def fundflow_rank(limit: int = 50):
    return _call(_ff_rank, mock.fundflow_rank, limit)


def stock_heat(code: str):
    return _call(_heat, mock.stock_heat, code)


def market_activity():
    return _call(_market, mock.market_activity)
