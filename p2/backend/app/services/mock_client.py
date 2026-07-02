"""内置模拟数据源:与 akshare_client 同构的确定性合成数据。

用于离线开发/演示,以及 auto 模式下 akshare 拉取失败时的降级。
同一代码永远生成同一序列(以代码为随机种子),保证联调可复现。
"""
from __future__ import annotations

import hashlib
import math
import random
from datetime import datetime, timedelta, timezone

CN_TZ = timezone(timedelta(hours=8))

# 模拟股票池(search / spot / rank 的全集;kline 等对任意代码都能生成)
STOCKS = [
    ("600519", "贵州茅台"), ("000001", "平安银行"), ("300750", "宁德时代"),
    ("601318", "中国平安"), ("000858", "五粮液"), ("688981", "中芯国际"),
    ("600036", "招商银行"), ("002594", "比亚迪"), ("601899", "紫金矿业"),
    ("600900", "长江电力"), ("000333", "美的集团"), ("601127", "赛力斯"),
    ("002230", "科大讯飞"), ("600030", "中信证券"), ("601988", "中国银行"),
    ("300059", "东方财富"), ("688111", "金山办公"), ("603259", "药明康德"),
    ("000651", "格力电器"), ("601888", "中国中免"),
]
_NAME = dict(STOCKS)


def _rng(*keys) -> random.Random:
    seed = int(hashlib.md5("|".join(str(k) for k in keys).encode()).hexdigest()[:8], 16)
    return random.Random(seed)


def name_of(code: str) -> str:
    return _NAME.get(code, f"模拟股{code[-4:]}")


def _base_price(code: str) -> float:
    return 5 + (int(hashlib.md5(code.encode()).hexdigest()[:6], 16) % 2000) / 10  # 5 ~ 205 元


def _last_trade_day() -> datetime:
    d = datetime.now(CN_TZ).replace(hour=15, minute=0, second=0, microsecond=0)
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    return d


def _trade_days(n: int) -> list[datetime]:
    """截止最近交易日的最后 n 个工作日(升序)。"""
    days: list[datetime] = []
    d = _last_trade_day()
    while len(days) < n:
        if d.weekday() < 5:
            days.append(d)
        d -= timedelta(days=1)
    return days[::-1]


_CANONICAL_N = 1300  # 所有接口共用同一条规范日线,保证现价/K线/资金流互相一致
_canonical_cache: dict[tuple[str, str], list[dict]] = {}


def _daily_walk(code: str, n: int) -> list[dict]:
    """规范日线的尾部 n 根切片。"""
    return _canonical(code)[-n:]


def _canonical(code: str) -> list[dict]:
    """随机游走日线,带轻微趋势与均值回归,末根落在最近交易日。按 (code, 末交易日) 缓存。"""
    key = (code, _last_trade_day().strftime("%Y%m%d"))
    hit = _canonical_cache.get(key)
    if hit is not None:
        return hit
    rng = _rng(code, "daily")
    base = _base_price(code)
    price = base * rng.uniform(0.7, 1.3)
    drift = rng.uniform(-0.0008, 0.0012)
    out = []
    for day in _trade_days(_CANONICAL_N):
        chg = rng.gauss(drift, 0.02) + 0.05 * (base - price) / base / 100
        o = price * (1 + rng.gauss(0, 0.006))
        c = max(0.5, price * (1 + chg))
        h = max(o, c) * (1 + abs(rng.gauss(0, 0.008)))
        low = min(o, c) * (1 - abs(rng.gauss(0, 0.008)))
        vol = rng.uniform(0.5, 3.0) * 1e7 * (1 + 5 * abs(chg))
        out.append({
            "timestamp": int(day.replace(hour=0).timestamp() * 1000),
            "open": round(o, 2), "high": round(h, 2), "low": round(low, 2),
            "close": round(c, 2), "volume": round(vol), "amount": round(vol * c),
        })
        price = c
    _canonical_cache.clear()  # 只保留当日一份,跨日自动失效
    _canonical_cache[key] = out
    return out


def spot() -> list[dict]:
    out = []
    for code, name in STOCKS:
        bars = _daily_walk(code, 2)
        prev, last = bars[-2]["close"], bars[-1]["close"]
        out.append({
            "code": code, "name": name, "price": last,
            "change_pct": round((last - prev) / prev * 100, 2),
            "change": round(last - prev, 2),
            "volume": bars[-1]["volume"], "amount": bars[-1]["amount"],
            "turnover": round(_rng(code, "to").uniform(0.3, 8), 2),
        })
    return out


_MIN_PERIODS = {"1", "5", "15", "30", "60"}


def kline(code: str, period: str, adjust: str) -> list[dict]:
    if period not in _MIN_PERIODS:
        if period == "daily":
            return _daily_walk(code, 500)
        group = 5 if period == "weekly" else 21
        return _resample(_canonical(code), group)

    # 分钟线:由最近若干个交易日的日线切分出盘中随机路径
    step = int(period)
    days = _daily_walk(code, 20 if step < 30 else 60)
    out = []
    session = [(9 * 60 + 30, 11 * 60 + 30), (13 * 60, 15 * 60)]
    for bar in days:
        day = datetime.fromtimestamp(bar["timestamp"] / 1000, CN_TZ)
        rng = _rng(code, "min", bar["timestamp"], step)
        marks = [m for s, e in session for m in range(s + step, e + 1, step)]
        price = bar["open"]
        for i, m in enumerate(marks):
            target = bar["close"] if i == len(marks) - 1 else price * (1 + rng.gauss(0, 0.003))
            o, c = price, target
            out.append({
                "timestamp": int(day.replace(hour=m // 60, minute=m % 60).timestamp() * 1000),
                "open": round(o, 2),
                "high": round(max(o, c) * (1 + abs(rng.gauss(0, 0.001))), 2),
                "low": round(min(o, c) * (1 - abs(rng.gauss(0, 0.001))), 2),
                "close": round(c, 2),
                "volume": round(bar["volume"] / len(marks) * rng.uniform(0.5, 1.5)),
                "amount": round(bar["amount"] / len(marks) * rng.uniform(0.5, 1.5)),
            })
            price = c
    return out


def _resample(bars: list[dict], group: int) -> list[dict]:
    out = []
    for i in range(0, len(bars), group):
        chunk = bars[i:i + group]
        out.append({
            "timestamp": chunk[-1]["timestamp"],
            "open": chunk[0]["open"],
            "high": max(b["high"] for b in chunk),
            "low": min(b["low"] for b in chunk),
            "close": chunk[-1]["close"],
            "volume": sum(b["volume"] for b in chunk),
            "amount": sum(b["amount"] for b in chunk),
        })
    return out


def fundflow(code: str) -> list[dict]:
    """近 100 日资金流:主力净流入与当日涨跌幅正相关,五档单型净额守恒
    (超大+大+中+小 = 0 附近的市场自然状态不成立,东财口径四类净额之和≈0 减去主力对手盘,
    这里保证 主力 = 超大 + 大,且 中+小 ≈ -主力,与真实口径一致)。"""
    bars = _daily_walk(code, 101)
    out = []
    for prev, cur in zip(bars, bars[1:]):
        rng = _rng(code, "ff", cur["timestamp"])
        chg = (cur["close"] - prev["close"]) / prev["close"] * 100
        amount = cur["amount"]
        main_pct = max(-30, min(30, chg * rng.uniform(1.5, 3.5) + rng.gauss(0, 4)))
        main_net = amount * main_pct / 100
        xl = main_net * rng.uniform(0.45, 0.75)
        lg = main_net - xl
        md = -main_net * rng.uniform(0.4, 0.7)
        sm = -main_net - md
        day = datetime.fromtimestamp(cur["timestamp"] / 1000, CN_TZ)
        out.append({
            "date": day.strftime("%Y-%m-%d"),
            "close": cur["close"], "change_pct": round(chg, 2),
            "main_net": round(main_net), "main_pct": round(main_pct, 2),
            "xl_net": round(xl), "xl_pct": round(xl / amount * 100, 2),
            "lg_net": round(lg), "lg_pct": round(lg / amount * 100, 2),
            "md_net": round(md), "md_pct": round(md / amount * 100, 2),
            "sm_net": round(sm), "sm_pct": round(sm / amount * 100, 2),
        })
    return out


def fundflow_rank(limit: int = 50) -> list[dict]:
    rows = []
    for s, q in zip(STOCKS, spot()):
        ff = fundflow(s[0])[-1]
        rows.append({
            "code": s[0], "name": s[1], "price": q["price"],
            "change_pct": q["change_pct"],
            "main_net": ff["main_net"], "main_pct": ff["main_pct"],
        })
    rows.sort(key=lambda r: -r["main_net"])
    return rows[:limit]


def stock_heat(code: str) -> dict:
    rng = _rng(code, "heat", _last_trade_day().date())
    return {
        "institution_pct": round(rng.uniform(15, 55), 2),
        "focus_index": round(rng.uniform(30, 95), 1),
        "hot_rank": rng.randint(1, 2000),
    }


def market_activity() -> dict:
    rng = _rng("market", _last_trade_day().date())
    up = rng.randint(1200, 3800)
    down = 5200 - up + rng.randint(-200, 200)
    limit_up = rng.randint(15, 90)
    limit_down = rng.randint(0, 30)
    return {
        "up": up, "down": down, "flat": rng.randint(100, 300),
        "limit_up": limit_up, "limit_down": limit_down,
        "real_limit_up": max(0, limit_up - rng.randint(0, 10)),
        "real_limit_down": max(0, limit_down - rng.randint(0, 5)),
        "suspended": rng.randint(5, 20),
        "activity": round(up / (up + down) * 100, 2),
        "date": _last_trade_day().strftime("%Y-%m-%d %H:%M:%S"),
    }
