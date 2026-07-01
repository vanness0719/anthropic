"""FastAPI 应用:上传 PDF -> 后台翻译(保留排版)-> 轮询进度 -> 下载。

接口:
  GET  /api/providers            列出可用的翻译引擎与默认模型
  POST /api/jobs                 上传 PDF + 参数,创建翻译任务(后台执行)
  GET  /api/jobs/{job_id}        查询任务状态与进度
  GET  /api/jobs/{job_id}/download  下载译文 PDF
"""
from __future__ import annotations

import os
import tempfile
import uuid

from fastapi import BackgroundTasks, FastAPI, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .pdf_translator import translate_pdf
from .translators import PROVIDERS, build_translator, default_model

app = FastAPI(title="p1 · PDF Translator", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 简单的内存任务表(MVP)。生产可换成 Redis / DB。
JOBS: dict[str, dict] = {}


@app.get("/api/providers")
def list_providers() -> dict:
    return {
        "providers": [
            {"id": p, "default_model": default_model(p)} for p in PROVIDERS
        ]
    }


def _process(
    job_id: str,
    input_path: str,
    output_path: str,
    provider: str,
    model: str | None,
    api_key: str | None,
    base_url: str | None,
    source_lang: str,
    target_lang: str,
) -> None:
    job = JOBS[job_id]
    try:
        translator = build_translator(
            provider, model=model, api_key=api_key, base_url=base_url
        )
        job["status"] = "processing"

        def cb(done: int, total: int) -> None:
            job["done"] = done
            job["total"] = total

        translate_pdf(input_path, output_path, translator, source_lang, target_lang, cb)
        job["status"] = "done"
        job["output_path"] = output_path
    except Exception as exc:  # noqa: BLE001 — 面向用户回传错误信息
        job["status"] = "error"
        job["error"] = str(exc)


@app.post("/api/jobs")
async def create_job(
    background_tasks: BackgroundTasks,
    file: UploadFile,
    source_lang: str = Form("auto"),
    target_lang: str = Form("zh"),
    provider: str = Form("claude"),
    model: str | None = Form(None),
    api_key: str | None = Form(None),
    base_url: str | None = Form(None),
) -> dict:
    if (file.content_type or "") not in ("application/pdf", "application/octet-stream") and not (
        file.filename or ""
    ).lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="仅支持 PDF 文件")

    job_id = uuid.uuid4().hex
    workdir = tempfile.mkdtemp(prefix=f"p1_{job_id}_")
    input_path = os.path.join(workdir, "input.pdf")
    output_path = os.path.join(workdir, "translated.pdf")

    with open(input_path, "wb") as fh:
        fh.write(await file.read())

    stem = os.path.splitext(os.path.basename(file.filename or "document"))[0]
    JOBS[job_id] = {
        "status": "pending",
        "done": 0,
        "total": 0,
        "download_name": f"{stem}.{target_lang}.pdf",
        "output_path": None,
        "error": None,
    }

    background_tasks.add_task(
        _process,
        job_id,
        input_path,
        output_path,
        provider,
        model,
        api_key,
        base_url,
        source_lang,
        target_lang,
    )
    return {"job_id": job_id}


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str) -> dict:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="任务不存在")
    return {
        "job_id": job_id,
        "status": job["status"],
        "done": job["done"],
        "total": job["total"],
        "error": job["error"],
    }


@app.get("/api/jobs/{job_id}/download")
def download(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="任务不存在")
    if job["status"] != "done" or not job["output_path"]:
        raise HTTPException(status_code=409, detail="任务尚未完成")
    return FileResponse(
        job["output_path"],
        media_type="application/pdf",
        filename=job["download_name"],
    )
