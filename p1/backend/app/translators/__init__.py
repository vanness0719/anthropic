"""翻译器工厂:根据 provider 名称构造对应实现。"""
from __future__ import annotations

from ..config import settings
from .base import Translator
from .claude import ClaudeTranslator
from .ollama import OllamaTranslator
from .openai_compat import OpenAICompatTranslator

PROVIDERS = ["claude", "openai", "ollama"]


def build_translator(
    provider: str,
    *,
    model: str | None = None,
    api_key: str | None = None,
    base_url: str | None = None,
) -> Translator:
    provider = (provider or "claude").lower()
    if provider == "claude":
        return ClaudeTranslator(
            api_key=api_key or settings.anthropic_api_key,
            model=model or settings.claude_model,
            base_url=base_url,
        )
    if provider == "openai":
        return OpenAICompatTranslator(
            base_url=base_url or settings.openai_base_url,
            api_key=api_key or settings.openai_api_key,
            model=model or settings.openai_model,
        )
    if provider == "ollama":
        return OllamaTranslator(
            base_url=base_url or settings.ollama_base_url,
            model=model or settings.ollama_model,
        )
    raise ValueError(f"未知的 provider: {provider}")


def default_model(provider: str) -> str:
    return {
        "claude": settings.claude_model,
        "openai": settings.openai_model,
        "ollama": settings.ollama_model,
    }.get(provider.lower(), "")


__all__ = ["build_translator", "default_model", "PROVIDERS", "Translator"]
