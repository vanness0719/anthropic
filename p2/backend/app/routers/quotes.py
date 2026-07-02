from fastapi import APIRouter, Query

from ..services import provider

router = APIRouter(tags=["quotes"])


@router.get("/quotes")
def quotes(codes: str = Query("", description="逗号分隔的 6 位代码")):
    """自选股实时快照。"""
    wanted = [c.strip() for c in codes.split(",") if c.strip()]
    rows, source = provider.spot()
    by_code = {r["code"]: r for r in rows}
    return {"source": source, "items": [by_code[c] for c in wanted if c in by_code]}


@router.get("/search")
def search(kw: str = Query(..., min_length=1), limit: int = 20):
    """按代码或名称模糊搜索。"""
    rows, source = provider.spot()
    kw = kw.strip().lower()
    hits = [r for r in rows if kw in r["code"] or kw in r["name"].lower()]
    return {"source": source, "items": hits[:limit]}
