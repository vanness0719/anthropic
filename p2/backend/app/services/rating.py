"""技术面综合评级:趋势 / MACD / KDJ / 量能 / 主力资金 五维打分,
合成 0-100「赚钱指数」与操作建议。纯计算、无 IO,便于单测。

评分口径(每维 0-100,50 为中性):
  趋势 30% + MACD 20% + KDJ 15% + 量能 10% + 主力资金 25%
仅供研究参考,不构成投资建议。
"""
from __future__ import annotations

import pandas as pd

from . import indicators

WEIGHTS = {"trend": 0.30, "macd": 0.20, "kdj": 0.15, "volume": 0.10, "fund": 0.25}

MIN_BARS = 60


def _clip(x: float) -> float:
    return max(0.0, min(100.0, x))


def _signal(score: float) -> str:
    return "bullish" if score >= 60 else "bearish" if score <= 40 else "neutral"


def _crossed_up(a: pd.Series, b: pd.Series, within: int = 3) -> bool:
    """a 在最近 within 根内上穿 b,且当前仍在上方。"""
    above = a > b
    if not bool(above.iloc[-1]):
        return False
    recent = above.iloc[-(within + 1):]
    return not bool(recent.iloc[0]) or not recent.all()


def _crossed_down(a: pd.Series, b: pd.Series, within: int = 3) -> bool:
    return _crossed_up(b, a, within)


def trend_score(df: pd.DataFrame) -> dict:
    c = df["close"]
    ma5, ma20, ma60 = (indicators.ma(c, n) for n in (5, 20, 60))
    conds = {
        "价>MA5": c.iloc[-1] > ma5.iloc[-1],
        "价>MA20": c.iloc[-1] > ma20.iloc[-1],
        "价>MA60": c.iloc[-1] > ma60.iloc[-1],
        "MA5>MA20": ma5.iloc[-1] > ma20.iloc[-1],
        "MA20>MA60": ma20.iloc[-1] > ma60.iloc[-1],
        "MA20走升": ma20.iloc[-1] > ma20.iloc[-6],
    }
    n_true = sum(conds.values())
    score = _clip(15 + n_true / len(conds) * 75)
    if n_true == len(conds):
        detail = "均线多头排列,趋势向上"
    elif n_true == 0:
        detail = "均线空头排列,趋势向下"
    else:
        detail = "满足 " + "、".join(k for k, v in conds.items() if v) if n_true else ""
        detail = f"{n_true}/{len(conds)} 项多头条件:{detail}"
    return {"name": "均线趋势", "key": "trend", "score": round(score, 1),
            "signal": _signal(score), "detail": detail,
            "ma20": round(float(ma20.iloc[-1]), 2)}


def macd_score(df: pd.DataFrame) -> dict:
    m = indicators.macd(df["close"])
    dif, dea, hist = m["dif"], m["dea"], m["macd"]
    above_zero = dif.iloc[-1] > 0
    hist_rising = bool((hist.diff().iloc[-3:] > 0).all())
    if _crossed_up(dif, dea):
        score, detail = (90, "零轴上方金叉,动能强") if above_zero else (80, "金叉初现,关注延续性")
    elif _crossed_down(dif, dea):
        score, detail = 18, "死叉初现,动能转弱"
    elif dif.iloc[-1] > dea.iloc[-1]:
        score, detail = (68, "多头持续(DIF>DEA)") if above_zero else (58, "零轴下方多头,反弹性质")
    else:
        score, detail = (35, "空头排列但仍在零轴上") if above_zero else (25, "零轴下方空头,弱势")
    if hist_rising and score < 85:
        score += 7
        detail += ";红柱/绿柱连续改善"
    return {"name": "MACD", "key": "macd", "score": round(_clip(score), 1),
            "signal": _signal(_clip(score)), "detail": detail}


def kdj_score(df: pd.DataFrame) -> dict:
    k = indicators.kdj(df["high"], df["low"], df["close"])
    kv, dv, jv = (float(k[x].iloc[-1]) for x in ("k", "d", "j"))
    if _crossed_up(k["k"], k["d"]) and dv < 35:
        score, detail = 88, f"低位金叉(D={dv:.0f}),短线买点"
    elif _crossed_up(k["k"], k["d"]):
        score, detail = 70, "KDJ 金叉"
    elif _crossed_down(k["k"], k["d"]) and dv > 70:
        score, detail = 15, f"高位死叉(D={dv:.0f}),短线回调风险"
    elif jv > 100:
        score, detail = 30, f"J={jv:.0f} 超买,追高风险大"
    elif jv < 0:
        score, detail = 60, f"J={jv:.0f} 超卖,关注反弹"
    elif kv > dv:
        score, detail = 62, "K>D 多头延续"
    else:
        score, detail = 38, "K<D 空头延续"
    return {"name": "KDJ", "key": "kdj", "score": round(score, 1),
            "signal": _signal(score), "detail": detail}


def volume_score(df: pd.DataFrame) -> dict:
    vol = df["volume"]
    if len(vol) < 25:
        return {"name": "量能", "key": "volume", "score": 50.0, "signal": "neutral", "detail": "数据不足"}
    ratio = float(vol.iloc[-5:].mean() / max(vol.iloc[-25:-5].mean(), 1))
    chg5 = float(df["close"].iloc[-1] / df["close"].iloc[-6] - 1)
    if ratio > 1.2 and chg5 > 0:
        score, detail = 82, f"放量上涨(量比 {ratio:.1f}),量价配合"
    elif ratio > 1.2 and chg5 < 0:
        score, detail = 25, f"放量下跌(量比 {ratio:.1f}),抛压沉重"
    elif ratio < 0.8 and chg5 < 0:
        score, detail = 55, f"缩量回调(量比 {ratio:.1f}),抛压减轻"
    elif ratio < 0.8 and chg5 > 0:
        score, detail = 45, f"缩量上涨(量比 {ratio:.1f}),动能不足"
    else:
        score, detail = 50, f"量能平稳(量比 {ratio:.1f})"
    return {"name": "量能", "key": "volume", "score": round(score, 1),
            "signal": _signal(score), "detail": detail}


def fund_score(fundflow_hist: list[dict], days: int = 5) -> dict:
    recent = fundflow_hist[-days:]
    if not recent:
        return {"name": "主力资金", "key": "fund", "score": 50.0, "signal": "neutral", "detail": "无资金流数据"}
    avg = sum(r["main_pct"] for r in recent) / len(recent)
    total = sum(r["main_net"] for r in recent)
    pos_days = sum(1 for r in recent if r["main_net"] > 0)
    score = _clip(50 + avg * 5)
    direction = "净流入" if total >= 0 else "净流出"
    detail = f"近{len(recent)}日主力{direction} {abs(total) / 1e4:.0f} 万(占比均值 {avg:+.1f}%,{pos_days} 天为正)"
    return {"name": "主力资金", "key": "fund", "score": round(score, 1),
            "signal": _signal(score), "detail": detail}


ACTIONS = [
    (75, "积极买入"), (60, "逢低买入"), (45, "观望"), (30, "减持"), (0, "回避"),
]


def _action(score: float) -> str:
    return next(label for lo, label in ACTIONS if score >= lo)


def _strategy(action: str, signals: list[dict], df: pd.DataFrame, ma20: float) -> str:
    support = round(float(df["low"].iloc[-20:].min()), 2)
    resistance = round(float(df["high"].iloc[-20:].max()), 2)
    bulls = [s["name"] for s in signals if s["signal"] == "bullish"]
    bears = [s["name"] for s in signals if s["signal"] == "bearish"]
    if action == "积极买入":
        return (f"{('、'.join(bulls))} 共振看多。可分批建仓,参考支撑 {support}、"
                f"压力 {resistance};跌破 20 日均线 {ma20} 止损。")
    if action == "逢低买入":
        return (f"技术面偏多({'、'.join(bulls) or '多维改善'}),但未全面共振。"
                f"建议回踩 20 日均线 {ma20} 附近分批介入,跌破支撑 {support} 止损。")
    if action == "观望":
        need = "、".join(bears[:2]) if bears else "关键指标"
        return (f"多空信号交织({need} 偏弱),不宜追价。等待放量站稳 {resistance} "
                f"或回踩 {support} 企稳信号后再决策。")
    if action == "减持":
        return (f"{('、'.join(bears))} 走弱,反弹至 20 日均线 {ma20} 附近建议减仓,"
                f"跌破支撑 {support} 离场。")
    return (f"技术面偏空({'、'.join(bears) or '多维走弱'}),建议回避;"
            f"待收复 20 日均线 {ma20} 并连续放量后再重新评估。")


def compute(bars: list[dict], fundflow_hist: list[dict]) -> dict:
    """入参:日线 bars(至少 MIN_BARS 根)+ 每日资金流历史。"""
    if len(bars) < MIN_BARS:
        raise ValueError(f"K线数据不足(至少 {MIN_BARS} 根)")
    df = pd.DataFrame(bars)
    t = trend_score(df)
    ma20 = t.pop("ma20")
    signals = [t, macd_score(df), kdj_score(df), volume_score(df), fund_score(fundflow_hist)]
    total = sum(s["score"] * WEIGHTS[s["key"]] for s in signals)
    total = round(total, 1)
    action = _action(total)
    return {
        "score": total,
        "action": action,
        "strategy": _strategy(action, signals, df, ma20),
        "signals": signals,
        "disclaimer": "评分基于历史行情的技术规则,仅供研究参考,不构成投资建议",
    }
