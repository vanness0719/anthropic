from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException

from ..schemas import BacktestRequest
from ..services import backtest as engine
from ..services import provider

router = APIRouter(tags=["backtest"])

CN_TZ = timezone(timedelta(hours=8))


def _ts(date_str: str) -> int:
    return int(datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=CN_TZ).timestamp() * 1000)


@router.post("/backtest")
def run(req: BacktestRequest):
    if req.strategy not in engine.STRATEGIES:
        raise HTTPException(400, f"strategy 须为 {engine.STRATEGIES}")
    bars, source = provider.kline(req.code, "daily", "qfq")
    if req.start_date:
        lo = _ts(req.start_date)
        bars = [b for b in bars if b["timestamp"] >= lo]
    if req.end_date:
        hi = _ts(req.end_date) + 86_400_000
        bars = [b for b in bars if b["timestamp"] < hi]
    try:
        result = engine.run(bars, req.strategy, req.params,
                            req.initial_capital, req.fee_rate)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    return {"source": source, "code": req.code, **result}
