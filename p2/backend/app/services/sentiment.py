"""个股情绪分合成:资金面 / 热度面 / 机构面 / 大盘面 四维,各 0~100,加权得综合分。

输入均为 provider 层的原始数据,本模块纯计算、无 IO,便于单测。
"""
from __future__ import annotations

import math


def _clip(x: float) -> float:
    return max(0.0, min(100.0, x))


def fund_score(fundflow_hist: list[dict], days: int = 5) -> dict:
    """资金面:近 N 日主力净流入占比均值。占比 ±10% 即视为极强/极弱。"""
    recent = fundflow_hist[-days:]
    if not recent:
        return {"score": 50.0, "main_pct_avg": 0.0, "main_net_sum": 0.0, "days": 0}
    avg = sum(r["main_pct"] for r in recent) / len(recent)
    return {
        "score": round(_clip(50 + avg * 5), 1),
        "main_pct_avg": round(avg, 2),
        "main_net_sum": round(sum(r["main_net"] for r in recent)),
        "days": len(recent),
    }


def heat_score(heat: dict) -> dict:
    """热度面:股吧人气排名(对数刻度,第 1 名≈100 分)与用户关注指数取均值。"""
    parts = []
    rank = heat.get("hot_rank")
    if rank:
        parts.append(_clip(100 * (1 - math.log10(rank) / math.log10(6000))))
    focus = heat.get("focus_index")
    if focus is not None:
        parts.append(_clip(focus))
    score = sum(parts) / len(parts) if parts else 50.0
    return {"score": round(score, 1), "hot_rank": rank, "focus_index": focus}


def institution_score(heat: dict) -> dict:
    """机构面:千股千评机构参与度(常见区间 15%~55%),35% 对应 50 分。"""
    pct = heat.get("institution_pct")
    score = 50.0 if pct is None else _clip(50 + (pct - 35) * 2.5)
    return {"score": round(score, 1), "institution_pct": pct}


def market_score(activity: dict) -> dict:
    """大盘面:涨跌家数比为主,涨停/跌停差为辅。"""
    up, down = activity.get("up", 0), activity.get("down", 0)
    ratio = up / (up + down) if up + down else 0.5
    limit_bias = activity.get("limit_up", 0) - activity.get("limit_down", 0)
    score = _clip(ratio * 100 * 0.8 + _clip(50 + limit_bias) * 0.2)
    return {
        "score": round(score, 1),
        "up": up, "down": down,
        "limit_up": activity.get("limit_up", 0),
        "limit_down": activity.get("limit_down", 0),
    }


WEIGHTS = {"fund": 0.35, "heat": 0.25, "institution": 0.2, "market": 0.2}


def compose(fundflow_hist: list[dict], heat: dict, activity: dict) -> dict:
    dims = {
        "fund": fund_score(fundflow_hist),
        "heat": heat_score(heat),
        "institution": institution_score(heat),
        "market": market_score(activity),
    }
    total = sum(dims[k]["score"] * w for k, w in WEIGHTS.items())
    label = ("极度悲观" if total < 20 else "悲观" if total < 40 else
             "中性" if total < 60 else "乐观" if total < 80 else "极度乐观")
    return {"score": round(total, 1), "label": label, "dimensions": dims}
