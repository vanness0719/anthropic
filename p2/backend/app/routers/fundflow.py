from fastapi import APIRouter, Path, Query

from ..services import provider

router = APIRouter(tags=["fundflow"])


@router.get("/fundflow/rank")
def rank(limit: int = Query(50, ge=1, le=100)):
    """今日全市场主力净流入排名。"""
    rows, source = provider.fundflow_rank(limit)
    return {"source": source, "items": rows}


@router.get("/fundflow/{code}")
def fundflow(code: str = Path(pattern=r"^\d{6}$"), days: int = Query(100, ge=1, le=365)):
    """个股每日大单资金流(主力/超大单/大单/中单/小单 净额与净占比,单位:元 / %)。"""
    hist, source = provider.fundflow(code)
    hist = hist[-days:]
    return {
        "source": source,
        "code": code,
        "latest": hist[-1] if hist else None,
        "history": hist,
    }
