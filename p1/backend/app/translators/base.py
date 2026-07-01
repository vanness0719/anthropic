"""翻译器基类与共享的批量翻译协议。

所有翻译器都实现同一个接口 ``translate_texts(texts, source, target) -> list[str]``。
为减少调用次数,采用「一次请求翻译一页里的多个文本段」的批量协议:
把待翻译文本作为 JSON 数组发给模型,要求返回等长的 JSON 数组。
若返回长度不匹配(小模型偶发),自动回退到逐段翻译以保证结果对齐。
"""
from __future__ import annotations

import json
import re
from abc import ABC, abstractmethod

LANG_NAMES = {
    "auto": "the source language (auto-detect)",
    "en": "English",
    "zh": "Simplified Chinese",
    "zh-cn": "Simplified Chinese",
    "zh-tw": "Traditional Chinese",
    "ja": "Japanese",
    "ko": "Korean",
    "fr": "French",
    "de": "German",
    "es": "Spanish",
    "ru": "Russian",
    "pt": "Portuguese",
    "it": "Italian",
}


def _lang(code: str) -> str:
    return LANG_NAMES.get(code.lower(), code)


def build_system(source: str, target: str) -> str:
    return (
        f"You are a professional document translator. Translate text from "
        f"{_lang(source)} to {_lang(target)}. Preserve meaning, tone and technical "
        f"terms. Keep numbers, code, URLs, e-mail addresses and identifiers unchanged. "
        f"Do NOT add explanations, notes or quotation marks around the result."
    )


def _extract_json_array(raw: str) -> list | None:
    """从模型输出中稳健地抽取第一个 JSON 数组。"""
    if not raw:
        return None
    start = raw.find("[")
    end = raw.rfind("]")
    if start == -1 or end == -1 or end < start:
        return None
    snippet = raw[start : end + 1]
    try:
        value = json.loads(snippet)
    except json.JSONDecodeError:
        # 容错:去掉可能的尾随逗号后再试一次
        try:
            value = json.loads(re.sub(r",\s*]", "]", snippet))
        except json.JSONDecodeError:
            return None
    return value if isinstance(value, list) else None


class Translator(ABC):
    """翻译器抽象类。子类只需实现 ``_complete``。"""

    @abstractmethod
    def _complete(self, system: str, user: str) -> str:
        """给定 system / user 提示,返回模型的文本输出。"""

    def translate_texts(self, texts: list[str], source: str, target: str) -> list[str]:
        if not texts:
            return []
        batched = self._batch(texts, source, target)
        if batched is not None and len(batched) == len(texts):
            return batched
        # 回退:逐段翻译,保证与原文段一一对应
        out: list[str] = []
        for t in texts:
            one = self._batch([t], source, target)
            out.append(one[0] if one else t)
        return out

    def _batch(self, texts: list[str], source: str, target: str) -> list[str] | None:
        system = build_system(source, target)
        payload = json.dumps(texts, ensure_ascii=False)
        user = (
            "Translate every string in the following JSON array. "
            "Return ONLY a JSON array of the same length and order, "
            "each element the translation of the corresponding input string.\n\n"
            f"{payload}"
        )
        try:
            raw = self._complete(system, user)
        except Exception:
            return None
        arr = _extract_json_array(raw)
        if arr is None:
            return None
        return [str(x) for x in arr]
