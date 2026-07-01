"""OpenAI 兼容接口翻译器(任何暴露 /v1/chat/completions 的服务)。"""
from __future__ import annotations

import requests

from .base import Translator


class OpenAICompatTranslator(Translator):
    def __init__(self, base_url: str, api_key: str | None = None, model: str = "gpt-4o-mini") -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model

    def _complete(self, system: str, user: str) -> str:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        resp = requests.post(
            f"{self.base_url}/chat/completions",
            headers=headers,
            json={
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "temperature": 0,
                "stream": False,
            },
            timeout=120,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
