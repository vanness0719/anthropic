import logging
import os
import threading
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import config
from .routers import backtest, fundflow, kline, quotes, rating, sentiment
from .services.provider import UpstreamError

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="p2 A股行情 API", version="0.1.0")

# 前端开发服务器跨域(生产走 nginx 同源代理,不依赖此配置)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (quotes.router, kline.router, fundflow.router, sentiment.router, backtest.router, rating.router):
    app.include_router(r, prefix="/api")


@app.on_event("startup")
def prewarm_spot_cache():
    """后台预热全市场快照:akshare 首次拉取要十几秒,避免用户首次搜索卡住。"""
    from .services import provider

    def warm():
        try:
            provider.spot()
        except Exception:
            pass  # 失败不影响启动,搜索时会再试并按 auto 规则降级

    threading.Thread(target=warm, daemon=True).start()


@app.exception_handler(UpstreamError)
def upstream_error(_: Request, exc: UpstreamError):
    return JSONResponse(status_code=502, content={"detail": str(exc)})


@app.get("/api/health")
def health():
    return {"status": "ok", "data_source": config.DATA_SOURCE}


# 单进程模式:若前端已构建(frontend/dist 存在),由后端直接托管,
# 手机访问 http://<IP>:8000 即可,无需单独跑 nginx/vite。
# P2_DIST 供 PyInstaller 打包后指向解包目录(见 serve.py)。
_DIST = Path(os.environ.get("P2_DIST") or Path(__file__).resolve().parents[2] / "frontend" / "dist")
if _DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=_DIST / "assets"), name="assets")

    @app.api_route("/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    def spa(path: str):
        f = _DIST / path
        if path and ".." not in path and f.is_file():
            return FileResponse(f)
        return FileResponse(_DIST / "index.html")  # SPA 路由回退
