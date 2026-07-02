"""简单回测引擎:单标的、日线、全仓进出。

避免未来函数:信号在第 t 根收盘产生,第 t+1 根开盘价成交。
仓位用可分数股简化(不取整手),手续费率对买卖双边计。
"""
from __future__ import annotations

import pandas as pd

from . import indicators

STRATEGIES = ("ma_cross", "macd", "kdj")


def _signals(df: pd.DataFrame, strategy: str, p: dict) -> pd.Series:
    """返回逐根信号:1=买入 -1=卖出 0=持有不变。"""
    close = df["close"]
    if strategy == "ma_cross":
        fast = indicators.ma(close, int(p.get("fast", 5)))
        slow = indicators.ma(close, int(p.get("slow", 20)))
        up = (fast > slow) & (fast.shift(1) <= slow.shift(1))
        down = (fast < slow) & (fast.shift(1) >= slow.shift(1))
    elif strategy == "macd":
        m = indicators.macd(close, int(p.get("fast", 12)),
                            int(p.get("slow", 26)), int(p.get("signal", 9)))
        up = (m["dif"] > m["dea"]) & (m["dif"].shift(1) <= m["dea"].shift(1))
        down = (m["dif"] < m["dea"]) & (m["dif"].shift(1) >= m["dea"].shift(1))
    elif strategy == "kdj":
        k = indicators.kdj(df["high"], df["low"], close,
                           int(p.get("n", 9)), int(p.get("m1", 3)), int(p.get("m2", 3)))
        oversold = float(p.get("oversold", 30))
        overbought = float(p.get("overbought", 70))
        cross_up = (k["k"] > k["d"]) & (k["k"].shift(1) <= k["d"].shift(1))
        cross_down = (k["k"] < k["d"]) & (k["k"].shift(1) >= k["d"].shift(1))
        up = cross_up & (k["d"] < oversold)
        down = cross_down & (k["d"] > overbought)
    else:
        raise ValueError(f"未知策略: {strategy}")
    return pd.Series(0, index=df.index).mask(up, 1).mask(down, -1)


def run(bars: list[dict], strategy: str, params: dict | None = None,
        initial_capital: float = 100_000.0, fee_rate: float = 0.0) -> dict:
    params = params or {}
    if len(bars) < 30:
        raise ValueError("K线数据不足(至少 30 根)")
    df = pd.DataFrame(bars)
    sig = _signals(df, strategy, params)

    cash, shares = initial_capital, 0.0
    entry_price = entry_ts = None
    trades: list[dict] = []
    equity: list[dict] = []
    bench_base = df["close"].iloc[0]

    for i in range(len(df)):
        # 前一根的信号在本根开盘执行
        if i > 0 and sig.iloc[i - 1] != 0:
            px = float(df["open"].iloc[i])
            if sig.iloc[i - 1] == 1 and shares == 0 and px > 0:
                shares = cash * (1 - fee_rate) / px
                cash = 0.0
                entry_price, entry_ts = px, int(df["timestamp"].iloc[i])
            elif sig.iloc[i - 1] == -1 and shares > 0:
                cash = shares * px * (1 - fee_rate)
                trades.append(_trade(entry_ts, entry_price, int(df["timestamp"].iloc[i]), px, "signal"))
                shares, entry_price, entry_ts = 0.0, None, None
        value = cash + shares * float(df["close"].iloc[i])
        equity.append({
            "timestamp": int(df["timestamp"].iloc[i]),
            "value": round(value, 2),
            "benchmark": round(initial_capital * float(df["close"].iloc[i]) / bench_base, 2),
        })

    if shares > 0:  # 期末强平结算,便于统计
        px = float(df["close"].iloc[-1])
        cash = shares * px * (1 - fee_rate)
        trades.append(_trade(entry_ts, entry_price, int(df["timestamp"].iloc[-1]), px, "end"))
        equity[-1]["value"] = round(cash, 2)

    return _stats(equity, trades, initial_capital, strategy, params)


def _trade(entry_ts, entry_price, exit_ts, exit_price, reason) -> dict:
    return {
        "entry_ts": entry_ts, "entry_price": round(entry_price, 3),
        "exit_ts": exit_ts, "exit_price": round(exit_price, 3),
        "pnl_pct": round((exit_price / entry_price - 1) * 100, 2),
        "exit_reason": reason,
    }


def _stats(equity: list[dict], trades: list[dict], initial: float,
           strategy: str, params: dict) -> dict:
    final = equity[-1]["value"]
    total_return = final / initial - 1
    days = max(1, (equity[-1]["timestamp"] - equity[0]["timestamp"]) / 86_400_000)
    annual = (final / initial) ** (365 / days) - 1 if final > 0 else -1.0

    peak, mdd = -1e18, 0.0
    for e in equity:
        peak = max(peak, e["value"])
        mdd = max(mdd, 1 - e["value"] / peak)

    wins = sum(1 for t in trades if t["pnl_pct"] > 0)
    return {
        "strategy": strategy, "params": params,
        "initial_capital": initial, "final_value": round(final, 2),
        "total_return_pct": round(total_return * 100, 2),
        "annual_return_pct": round(annual * 100, 2),
        "max_drawdown_pct": round(mdd * 100, 2),
        "benchmark_return_pct": round((equity[-1]["benchmark"] / initial - 1) * 100, 2),
        "num_trades": len(trades),
        "win_rate_pct": round(wins / len(trades) * 100, 2) if trades else None,
        "equity": equity, "trades": trades,
    }
