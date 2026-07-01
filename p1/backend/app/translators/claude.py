"""基于 Anthropic 官方 SDK 的 Claude 翻译器(调试阶段默认使用)。"""
from __future__ import annotations

from anthropic import Anthropic

from .base import Translator


class ClaudeTranslator(Translator):
    def __init__(
        self,
        api_key: str | None = None,
        model: str = "claude-opus-4-8",
        base_url: str | None = None,
    ) -> None:
        kwargs: dict = {}
        if api_key:
            kwargs["api_key"] = api_key
        if base_url:
            kwargs["base_url"] = base_url
        # 不传 api_key 时,SDK 会自动解析环境变量 / `ant auth login` 的 profile 凭证。
        self.client = Anthropic(**kwargs)
        self.model = model

    def _complete(self, system: str, user: str) -> str:
        # 翻译任务不需要思考,省延迟与成本;Opus 4.8 省略 thinking 即为不思考。
        resp = self.client.messages.create(
            model=self.model,
            max_tokens=8000,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return "".join(
            block.text for block in resp.content if getattr(block, "type", None) == "text"
        )
