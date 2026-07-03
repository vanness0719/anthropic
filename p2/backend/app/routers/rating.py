from fastapi import APIRouter, HTTPException, Path, Query

from ..services import provider
from ..services import rating as engine

router = APIRouter(tags=["rating"])


def _rate(code: str) -> tuple[dict, str]:
    bars, s1 = provider.kline(code, "daily", "qfq")
    ff, s2 = provider.fundflow(code)
    result = engine.compute(bars[-120:], ff)
    source = s1 if s1 == s2 else "mixed"
    return result, source


@router.get("/rating/batch")
def batch(codes: str = Query(..., description="逗号分隔的 6 位代码")):
    """自选股列表用的轻量批量评分:[{code, score, action}]。单只失败跳过。"""
    items = []
    for code in dict.fromkeys(c.strip() for c in codes.split(",") if c.strip()):
        try:
            r, _ = _rate(code)
            items.append({"code": code, "score": r["score"], "action": r["action"]})
        except Exception:
            continue
    return {"items": items}


@router.get("/rating/{code}")
def rating(code: str = Path(pattern=r"^\d{6}$")):
    """个股技术面综合评级:赚钱指数 + 操作建议 + 五维信号明细。"""
    try:
        result, source = _rate(code)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    return {"source": source, "code": code, **result}
