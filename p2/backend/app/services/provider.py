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
