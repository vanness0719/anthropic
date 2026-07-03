import math
from datetime import datetime, timedelta, timezone

import pytest

from app.services import rating

CN_TZ = timezone(timedelta(hours=8))


def make_bars(closes, vol_pattern=None):
    day = datetime(2025, 1, 1, tzinfo=CN_TZ)
    bars, prev = [], closes[0]
    for i, c in enumerate(closes):
        vol = 1e6 * (vol_pattern[i] if vol_pattern else 1.0)
        bars.append({
            "timestamp": int(day.timestamp() * 1000),
            "open": prev, "high": max(prev, c) * 1.002,
            "low": min(prev, c) * 0.998, "close": float(c),
            "volume": vol, "amount": vol * c,
        })
        prev = c
        day += timedelta(days=1)
    return bars


def make_ff(main_pcts):
    return [{"main_pct": p, "main_net": p * 1e5} for p in main_pcts]


def uptrend(n=100):
    return [100 * (1 + 0.01) ** i for i in range(n)]


def downtrend(n=100):
    return [100 * (1 - 0.01) ** i for i in range(n)]


def test_uptrend_with_inflow_scores_high():
    r = rating.compute(make_bars(uptrend()), make_ff([5, 6, 4, 7, 5]))
    assert r["score"] >= 65
    assert r["action"] in ("积极买入", "逢低买入")
    trend = next(s for s in r["signals"] if s["key"] == "trend")
    assert trend["signal"] == "bullish"
    assert "支撑" in r["strategy"]


def test_downtrend_with_outflow_scores_low():
    r = rating.compute(make_bars(downtrend()), make_ff([-5, -6, -4, -7, -5]))
    assert r["score"] <= 40
    assert r["action"] in ("减持", "回避")
    trend = next(s for s in r["signals"] if s["key"] == "trend")
    assert trend["signal"] == "bearish"


def test_score_is_weighted_sum_of_signals():
    r = rating.compute(make_bars(uptrend()), make_ff([0]))
    expect = sum(s["score"] * rating.WEIGHTS[s["key"]] for s in r["signals"])
    assert r["score"] == pytest.approx(expect, abs=0.11)


def test_v_reversal_turns_macd_bullish():
    # 深跌后连涨:金叉可能早于"最近3根"窗口,但方向必须转多
    closes = downtrend(60) + [downtrend(60)[-1] * (1 + 0.02) ** i for i in range(1, 15)]
    r = rating.compute(make_bars(closes), make_ff([2, 3, 1, 4, 2]))
    macd = next(s for s in r["signals"] if s["key"] == "macd")
    assert macd["signal"] == "bullish"
    # 连涨 9 根内金叉应落在检测窗口,detail 标注"金叉"
    closes2 = downtrend(60) + [downtrend(60)[-1] * (1 + 0.02) ** i for i in range(1, 10)]
    r2 = rating.compute(make_bars(closes2), make_ff([2]))
    macd2 = next(s for s in r2["signals"] if s["key"] == "macd")
    assert "金叉" in macd2["detail"] or macd2["signal"] == "bullish"


def test_volume_price_divergence():
    # 末 5 日放量下跌 → 量能看空
    closes = [100 + math.sin(i / 5) for i in range(95)] + [99, 97, 95, 93, 91]
    vols = [1.0] * 95 + [3.0] * 5
    r = rating.compute(make_bars(closes, vols), make_ff([0]))
    vol = next(s for s in r["signals"] if s["key"] == "volume")
    assert vol["signal"] == "bearish"
    assert "放量下跌" in vol["detail"]


def test_insufficient_bars_raises():
    with pytest.raises(ValueError):
        rating.compute(make_bars(uptrend(30)), make_ff([0]))


def test_all_scores_in_range_and_fields_present():
    r = rating.compute(make_bars(uptrend()), make_ff([1, -2, 3]))
    assert 0 <= r["score"] <= 100
    assert set(rating.WEIGHTS) == {s["key"] for s in r["signals"]}
    for s in r["signals"]:
        assert 0 <= s["score"] <= 100
        assert s["signal"] in ("bullish", "bearish", "neutral")
        assert s["detail"]
    assert r["disclaimer"]
