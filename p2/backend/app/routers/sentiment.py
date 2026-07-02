from fastapi import APIRouter, Path

from ..services import provider
from ..services import sentiment as senti

router = APIRouter(tags=["sentiment"])


@router.get("/sentiment/market")
def market():
    """大盘情绪:涨跌家数、涨停/跌停、活跃度。"""
    act, source = provider.market_activity()
    return {"source": source, **act, "mood": senti.market_score(act)}


@router.get("/sentiment/{code}")
def stock(code: str = Path(pattern=r"^\d{6}$")):
    """个股情绪综合分(资金/热度/机构/大盘 四维加权)。"""
    ff, s1 = provider.fundflow(code)
    heat, s2 = provider.stock_heat(code)
    act, s3 = provider.market_activity()
    result = senti.compose(ff, heat, act)
    source = "akshare" if {s1, s2, s3} == {"akshare"} else ("mock" if {s1, s2, s3} == {"mock"} else "mixed")
    return {"source": source, "code": code, **result}
