from fastapi import APIRouter, Query

from ..services import provider

router = APIRouter(tags=["quotes"])


@router.get("/quotes")
def quotes(codes: str = Query("", description="逗号分隔的 6 位代码")):
    """自选股实时快照。"""
    wanted = [c.strip() for c in codes.split(",") if c.strip()]
    items, source = provider.quotes(wanted)
    return {"source": source, "items": items}


@router.get("/search")
def search(kw: str = Query(..., min_length=1), limit: int = 20):
    """按代码或名称模糊搜索。"""
    hits, source = provider.search(kw)
    return {"source": source, "items": hits[:limit]}
