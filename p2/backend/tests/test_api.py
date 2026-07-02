"""API 集成测试:强制 mock 数据源,验证各端点契约与数值自洽。"""
import os

os.environ["P2_DATA_SOURCE"] = "mock"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["data_source"] == "mock"


def test_search_and_quotes():
    r = client.get("/api/search", params={"kw": "茅台"}).json()
    assert r["items"][0]["code"] == "600519"
    q = client.get("/api/quotes", params={"codes": "600519,000001"}).json()
    assert [i["code"] for i in q["items"]] == ["600519", "000001"]
    assert all(i["price"] > 0 for i in q["items"])


def test_kline_shape_and_order():
    r = client.get("/api/kline/600519", params={"period": "daily", "limit": 100}).json()
    items = r["items"]
    assert len(items) == 100
    ts = [b["timestamp"] for b in items]
    assert ts == sorted(ts)
    for b in items:
        assert b["low"] <= min(b["open"], b["close"]) <= max(b["open"], b["close"]) <= b["high"]


def test_kline_minute_period():
    r = client.get("/api/kline/600519", params={"period": "60", "limit": 50}).json()
    assert len(r["items"]) == 50


def test_kline_bad_period():
    assert client.get("/api/kline/600519", params={"period": "2"}).status_code == 400


def test_fundflow_conservation():
    """东财口径:主力 = 超大单 + 大单;四类单净额之和 ≈ 0。"""
    r = client.get("/api/fundflow/600519").json()
    assert len(r["history"]) == 100
    for d in r["history"]:
        assert abs(d["main_net"] - (d["xl_net"] + d["lg_net"])) <= 2  # 取整误差
        assert abs(d["xl_net"] + d["lg_net"] + d["md_net"] + d["sm_net"]) <= 2


def test_fundflow_rank_sorted():
    r = client.get("/api/fundflow/rank", params={"limit": 10}).json()
    nets = [i["main_net"] for i in r["items"]]
    assert nets == sorted(nets, reverse=True)


def test_sentiment_stock_dimensions_in_range():
    r = client.get("/api/sentiment/600519").json()
    assert 0 <= r["score"] <= 100
    assert set(r["dimensions"]) == {"fund", "heat", "institution", "market"}
    for d in r["dimensions"].values():
        assert 0 <= d["score"] <= 100


def test_sentiment_market():
    r = client.get("/api/sentiment/market").json()
    assert r["up"] > 0 and r["down"] > 0
    assert 0 <= r["mood"]["score"] <= 100


def test_backtest_endpoint():
    r = client.post("/api/backtest", json={
        "code": "600519", "strategy": "macd", "params": {},
        "initial_capital": 100000, "fee_rate": 0.0003,
    })
    assert r.status_code == 200
    body = r.json()
    assert body["num_trades"] >= 0
    assert len(body["equity"]) > 100
    assert body["equity"][0]["value"] == 100000


def test_backtest_bad_strategy():
    r = client.post("/api/backtest", json={"code": "600519", "strategy": "nope"})
    assert r.status_code == 400
