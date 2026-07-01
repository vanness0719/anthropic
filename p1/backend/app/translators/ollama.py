"""本地开源模型翻译器,走 Ollama 原生 /api/chat 接口。

使用前:
    ollama pull qwen2.5:7b      # 下载开源模型
    ollama serve                # 默认监听 http://localhost:11434
"""
from __future__ import annotations

import requests

from .base import Translator


class OllamaTranslator(Translator):
    def __init__(self, base_url: str = "http://localhost:11434", model: str = "qwen2.5:7b") -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model

    def _complete(self, system: str, user: str) -> str:
        resp = requests.post(
            f"{self.base_url}/api/chat",
            json={
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "stream": False,
                "options": {"temperature": 0},
            },
            timeout=300,
        )
        resp.raise_for_status()
        return resp.json()["message"]["content"]
