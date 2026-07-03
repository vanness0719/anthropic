"""技术指标(pandas 实现,国内软件口径)。供回测引擎使用,并作为前端
klinecharts 内置指标显示值的交叉验证基准。"""
from __future__ import annotations

import pandas as pd


def macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.DataFrame:
    """返回 DataFrame[dif, dea, macd]。macd 柱 = 2*(dif-dea)(国内约定 ×2)。"""
    ema_fast = close.ewm(span=fast, adjust=False).mean()
    ema_slow = close.ewm(span=slow, adjust=False).mean()
    dif = ema_fast - ema_slow
    dea = dif.ewm(span=signal, adjust=False).mean()
    return pd.DataFrame({"dif": dif, "dea": dea, "macd": 2 * (dif - dea)})


def kdj(high: pd.Series, low: pd.Series, close: pd.Series,
        n: int = 9, m1: int = 3, m2: int = 3) -> pd.DataFrame:
    """返回 DataFrame[k, d, j]。K/D 用国内 SMA(X,m,1) 递推(等价 alpha=1/m 的 EWMA),
    初值 50;J = 3K - 2D。"""
    llv = low.rolling(n, min_periods=1).min()
    hhv = high.rolling(n, min_periods=1).max()
    rng = (hhv - llv).replace(0, pd.NA)
    rsv = ((close - llv) / rng * 100).fillna(50.0)
    k = _sma_cn(rsv, m1)
    d = _sma_cn(k, m2)
    return pd.DataFrame({"k": k, "d": d, "j": 3 * k - 2 * d})


def _sma_cn(s: pd.Series, m: int) -> pd.Series:
    """国内 SMA(X, m, 1):Y = (X + (m-1)*Y_prev) / m,初值 50。"""
    out, prev = [], 50.0
    for x in s.astype(float):
        prev = (x + (m - 1) * prev) / m
        out.append(prev)
    return pd.Series(out, index=s.index)


def ma(close: pd.Series, n: int) -> pd.Series:
    return close.rolling(n).mean()
