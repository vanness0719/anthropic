from fastapi import APIRouter, HTTPException, Path, Query

from ..services import provider

router = APIRouter(tags=["kline"])

PERIODS = {"daily", "weekly", "monthly", "1", "5", "15", "30", "60"}


@router.get("/kline/{code}")
def kline(
    code: str = Path(pattern=r"^\d{6}$"),
    period: str = Query("daily"),
    adjust: str = Query("qfq", description="qfq/hfq/none"),
    limit: int = Query(500, ge=30, le=2000),
):
    if period not in PERIODS:
        raise HTTPException(400, f"period 须为 {sorted(PERIODS)}")
    bars, source = provider.kline(code, period, adjust)
    return {"source": source, "code": code, "period": period, "items": bars[-limit:]}
