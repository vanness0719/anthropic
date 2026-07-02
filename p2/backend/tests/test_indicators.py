import math

import pandas as pd

from app.services import indicators


def test_macd_constant_series_is_zero():
    close = pd.Series([10.0] * 60)
    m = indicators.macd(close)
    assert m["dif"].abs().max() < 1e-9
    assert m["dea"].abs().max() < 1e-9
    assert m["macd"].abs().max() < 1e-9


def test_macd_hand_computed_first_steps():
    # 手算前两步:EMA 递推 alpha=2/(n+1),macd 柱 = 2*(dif-dea)
    close = pd.Series([10.0, 11.0, 12.0])
    m = indicators.macd(close, fast=12, slow=26, signal=9)
    a12, a26 = 2 / 13, 2 / 27
    e12 = 10 + a12 * (11 - 10)
    e26 = 10 + a26 * (11 - 10)
    dif1 = e12 - e26
    assert math.isclose(m["dif"].iloc[1], dif1, rel_tol=1e-12)
    dea1 = 0 + (2 / 10) * (dif1 - 0)
    assert math.isclose(m["dea"].iloc[1], dea1, rel_tol=1e-12)
    assert math.isclose(m["macd"].iloc[1], 2 * (dif1 - dea1), rel_tol=1e-12)


def test_kdj_bounds_and_direction():
    n = 100
    up = pd.Series(range(1, n + 1), dtype=float)
    k = indicators.kdj(up * 1.01, up * 0.99, up)
    # 单调上涨:RSV 恒高,K/D 收敛到高位
    assert k["k"].iloc[-1] > 80
    assert k["d"].iloc[-1] > 80
    down = pd.Series(range(n, 0, -1), dtype=float)
    k2 = indicators.kdj(down * 1.01, down * 0.99, down)
    assert k2["k"].iloc[-1] < 20
    # K/D 有界(J 可越界属正常)
    assert k["k"].between(0, 100).all()
    assert k["d"].between(0, 100).all()


def test_kdj_flat_series_stays_50():
    close = pd.Series([10.0] * 30)
    k = indicators.kdj(close, close, close)
    assert (k["k"] - 50).abs().max() < 1e-9
    assert (k["j"] - 50).abs().max() < 1e-9
