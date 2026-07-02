import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import config
from .routers import backtest, fundflow, kline, quotes, sentiment
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

for r in (quotes.router, kline.router, fundflow.router, sentiment.router, backtest.router):
    app.include_router(r, prefix="/api")


@app.exception_handler(UpstreamError)
def upstream_error(_: Request, exc: UpstreamError):
    return JSONResponse(status_code=502, content={"detail": str(exc)})


@app.get("/api/health")
def health():
    return {"status": "ok", "data_source": config.DATA_SOURCE}
