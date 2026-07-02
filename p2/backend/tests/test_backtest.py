from datetime import datetime, timedelta, timezone

import pytest

from app.services import backtest

CN_TZ = timezone(timedelta(hours=8))


def make_bars(closes, start="2024-01-01"):
    day = datetime.strptime(start, "%Y-%m-%d").replace(tzinfo=CN_TZ)
    bars = []
    prev = closes[0]
    for c in closes:
        bars.append({
            "timestamp": int(day.timestamp() * 1000),
            "open": prev,  # 次日开盘 = 前日收盘,便于手算
            "high": max(prev, c) * 1.001,
            "low": min(prev, c) * 0.999,
            "close": float(c), "volume": 1e6, "amount": 1e7,
        })
        prev = c
        day += timedelta(days=1)
    return bars


def test_ma_cross_v_shape_hand_check():
    """先跌后涨的 V 形:fast=2/slow=4 在反转后金叉一次,期末强平。"""
    closes = [100, 98, 96, 94, 92, 90, 92, 96, 102, 110, 120, 130, 140, 150,
              160, 170, 180, 190, 200, 210, 220, 230, 240, 250, 260, 270,
              280, 290, 300, 310]
    r = backtest.run(make_bars(closes), "ma_cross", {"fast": 2, "slow": 4})
    assert r["num_trades"] == 1
    t = r["trades"][0]
    assert t["exit_reason"] == "end"
    assert t["pnl_pct"] > 100  # 低位买入持有到 310
    # 全仓无费:总收益 = 单笔收益
    assert abs(r["total_return_pct"] - t["pnl_pct"]) < 0.01
    assert r["win_rate_pct"] == 100.0


def test_equity_and_benchmark_consistency():
    closes = list(range(100, 160, 2))
    r = backtest.run(make_bars(closes), "ma_cross", {"fast": 2, "slow": 4},
                     initial_capital=50_000)
    assert r["equity"][0]["value"] == 50_000
    # 基准 = 首日买入持有
    expect_bench = 50_000 * closes[-1] / closes[0]
    assert abs(r["equity"][-1]["benchmark"] - expect_bench) < 0.01


def test_max_drawdown_hand_check():
    """持仓期间 200→100 的回撤=50%(用恒持仓策略:涨势金叉后暴跌)。"""
    closes = [100]*5 + [110, 120, 150, 200] + [100]*5 + [100]*20
    r = backtest.run(make_bars(closes), "ma_cross", {"fast": 2, "slow": 4})
    assert r["max_drawdown_pct"] == pytest.approx(50.0, abs=1.0)


def test_fee_reduces_return():
    # V 形保证产生一次金叉买入(单调序列不会交叉)
    closes = [100, 96, 92, 90, 92, 96, 102, 110] + list(range(112, 160, 2))
    free = backtest.run(make_bars(closes), "ma_cross", {"fast": 2, "slow": 4})
    paid = backtest.run(make_bars(closes), "ma_cross", {"fast": 2, "slow": 4},
                        fee_rate=0.003)
    assert free["num_trades"] >= 1
    assert paid["final_value"] < free["final_value"]


def test_macd_and_kdj_strategies_run():
    import math
    closes = [100 * (1 + 0.3 * math.sin(i / 8)) for i in range(200)]
    for s in ("macd", "kdj"):
        r = backtest.run(make_bars(closes), s)
        assert r["num_trades"] >= 1
        assert len(r["equity"]) == 200


def test_no_lookahead_trade_price_is_next_open():
    closes = [100, 98, 96, 94, 92, 90, 92, 96, 102, 110] + [120] * 20
    r = backtest.run(make_bars(closes), "ma_cross", {"fast": 2, "slow": 4})
    bars = make_bars(closes)
    by_ts = {b["timestamp"]: b for b in bars}
    for t in r["trades"]:
        assert t["entry_price"] == pytest.approx(by_ts[t["entry_ts"]]["open"], rel=1e-9)


def test_insufficient_bars_raises():
    with pytest.raises(ValueError):
        backtest.run(make_bars([100] * 10), "ma_cross")
