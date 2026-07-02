"""akshare 真实数据源。所有 akshare 调用与中文列名 → 标准字段的映射都收口在本文件。

列名以 akshare 1.18.x 为准;升级 akshare 后先跑 scripts/smoke_akshare.py 核对。
返回结构与 mock_client 完全一致(见各函数 docstring)。
"""
from __future__ import annotations

import math
from datetime import datetime, timezone, timedelta

import akshare as ak
import pandas as pd

CN_TZ = timezone(timedelta(hours=8))

# klinecharts 用毫秒时间戳;日线取当日 00:00(东八区)
def _date_ts(s: str) -> int:
    return int(datetime.strptime(str(s)[:10], "%Y-%m-%d").replace(tzinfo=CN_TZ).timestamp() * 1000)


def _minute_ts(s: str) -> int:
    return int(datetime.strptime(str(s)[:19], "%Y-%m-%d %H:%M:%S").replace(tzinfo=CN_TZ).timestamp() * 1000)


def _f(v, default: float = 0.0) -> float:
    try:
        x = float(v)
        return default if math.isnan(x) else x
    except (TypeError, ValueError):
        return default


def market_of(code: str) -> str:
    """由代码推断交易所:6/9 开头沪市,4/8 开头北交所,其余深市。"""
    if code.startswith(("6", "9")):
        return "sh"
    if code.startswith(("4", "8")):
        return "bj"
    return "sz"


def spot() -> list[dict]:
    """全市场实时快照。[{code,name,price,change_pct,change,volume,amount,turnover}]"""
    df = ak.stock_zh_a_spot_em()
    out = []
    for r in df.itertuples(index=False):
        d = r._asdict() if hasattr(r, "_asdict") else dict(zip(df.columns, r))
        out.append({
            "code": str(d.get("代码", "")),
            "name": str(d.get("名称", "")),
            "price": _f(d.get("最新价")),
            "change_pct": _f(d.get("涨跌幅")),
            "change": _f(d.get("涨跌额")),
            "volume": _f(d.get("成交量")),
            "amount": _f(d.get("成交额")),
            "turnover": _f(d.get("换手率")),
        })
    return out


_MIN_PERIODS = {"1", "5", "15", "30", "60"}


def kline(code: str, period: str, adjust: str) -> list[dict]:
    """K线。period: daily/weekly/monthly/1/5/15/30/60;adjust: qfq/hfq/''。
    [{timestamp,open,high,low,close,volume,amount}] 按时间升序。"""
    if period in _MIN_PERIODS:
        df = ak.stock_zh_a_hist_min_em(symbol=code, period=period,
                                       adjust=adjust if adjust != "none" else "")
        ts_col, ts_fn = "时间", _minute_ts
    else:
        df = ak.stock_zh_a_hist(symbol=code, period=period,
                                adjust=adjust if adjust != "none" else "")
        ts_col, ts_fn = "日期", _date_ts
    out = []
    for _, d in df.iterrows():
        out.append({
            "timestamp": ts_fn(d[ts_col]),
            "open": _f(d.get("开盘")),
            "high": _f(d.get("最高")),
            "low": _f(d.get("最低")),
            "close": _f(d.get("收盘")),
            "volume": _f(d.get("成交量")),
            "amount": _f(d.get("成交额")),
        })
    out.sort(key=lambda x: x["timestamp"])
    return out


def fundflow(code: str) -> list[dict]:
    """个股每日资金流(东财口径,单位:元 / %)。按日期升序。
    [{date,close,change_pct,main_net,main_pct,xl_net,xl_pct,lg_net,lg_pct,
      md_net,md_pct,sm_net,sm_pct}]"""
    df = ak.stock_individual_fund_flow(stock=code, market=market_of(code))
    out = []
    for _, d in df.iterrows():
        out.append({
            "date": str(d.get("日期"))[:10],
            "close": _f(d.get("收盘价")),
            "change_pct": _f(d.get("涨跌幅")),
            "main_net": _f(d.get("主力净流入-净额")),
            "main_pct": _f(d.get("主力净流入-净占比")),
            "xl_net": _f(d.get("超大单净流入-净额")),
            "xl_pct": _f(d.get("超大单净流入-净占比")),
            "lg_net": _f(d.get("大单净流入-净额")),
            "lg_pct": _f(d.get("大单净流入-净占比")),
            "md_net": _f(d.get("中单净流入-净额")),
            "md_pct": _f(d.get("中单净流入-净占比")),
            "sm_net": _f(d.get("小单净流入-净额")),
            "sm_pct": _f(d.get("小单净流入-净占比")),
        })
    out.sort(key=lambda x: x["date"])
    return out


def fundflow_rank(limit: int = 50) -> list[dict]:
    """今日全市场主力净流入排名。[{code,name,price,change_pct,main_net,main_pct}]"""
    df = ak.stock_individual_fund_flow_rank(indicator="今日").head(limit)
    out = []
    for _, d in df.iterrows():
        out.append({
            "code": str(d.get("代码", "")),
            "name": str(d.get("名称", "")),
            "price": _f(d.get("最新价")),
            "change_pct": _f(d.get("今日涨跌幅")),
            "main_net": _f(d.get("今日主力净流入-净额")),
            "main_pct": _f(d.get("今日主力净流入-净占比")),
        })
    return out


def stock_heat(code: str) -> dict:
    """个股热度原始值:{institution_pct(机构参与度%), focus_index(用户关注指数0-100),
    hot_rank(股吧人气排名,越小越热)}。子接口各自失败则置 None。"""
    institution = focus = rank = None
    try:
        df = ak.stock_comment_detail_zlkp_jgcyd_em(symbol=code)
        if len(df):
            institution = _f(df.iloc[-1]["机构参与度"])
    except Exception:
        pass
    try:
        df = ak.stock_comment_detail_scrd_focus_em(symbol=code)
        if len(df):
            focus = _f(df.iloc[-1]["用户关注指数"])
    except Exception:
        pass
    try:
        df = ak.stock_hot_rank_latest_em(symbol=f"{market_of(code).upper()}{code}")
        kv = dict(zip(df["item"], df["value"]))
        for k, v in kv.items():
            if "排名" in str(k) and "变化" not in str(k):
                rank = int(_f(v)) or None
                break
    except Exception:
        pass
    if institution is None and focus is None and rank is None:
        # 三个子接口全部失败按整体失败处理,让 auto 模式降级 mock
        raise RuntimeError(f"stock_heat({code}) 全部子接口失败")
    return {"institution_pct": institution, "focus_index": focus, "hot_rank": rank}


def market_activity() -> dict:
    """大盘赚钱效应(乐咕):{up,down,flat,limit_up,limit_down,real_limit_up,
    real_limit_down,suspended,activity,date}。"""
    df = ak.stock_market_activity_legu()
    kv = dict(zip(df["item"], df["value"]))

    def g(key: str) -> float:
        return _f(kv.get(key))

    activity = kv.get("活跃度", 0)
    if isinstance(activity, str):
        activity = _f(activity.strip("%"))
    return {
        "up": int(g("上涨")),
        "down": int(g("下跌")),
        "flat": int(g("平盘")),
        "limit_up": int(g("涨停")),
        "limit_down": int(g("跌停")),
        "real_limit_up": int(g("真实涨停")),
        "real_limit_down": int(g("真实跌停")),
        "suspended": int(g("停牌")),
        "activity": float(activity),
        "date": str(kv.get("统计日期", ""))[:19],
    }
