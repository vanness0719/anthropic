"""基于 PyMuPDF 的「保留排版」PDF 翻译核心。

思路(业界常见做法):
1. 逐页用 get_text("dict") 提取文本块(block),每块含 bbox / 字号 / 颜色;
2. 把整页文本块交给翻译器批量翻译;
3. 用 redaction 抹掉原文(保留图片),再把译文按原 bbox 回填,
   字号自适应缩小以塞进原文框,从而尽量还原版式、图片、表格位置。

局限(MVP):复杂的多栏 / 竖排 / 公式排版可能有偏差;CJK 目标语言使用
PyMuPDF 内置的 CJK 字体(china-s/japan/korea 等)。
"""
from __future__ import annotations

from typing import Callable

import fitz  # PyMuPDF

# 目标语言 -> PyMuPDF 内置字体名(内置 CJK 字体,无需外部字体文件)
_CJK_FONTS = {
    "zh": "china-s",
    "zh-cn": "china-s",
    "zh-tw": "china-t",
    "ja": "japan",
    "ko": "korea",
}


def _to_rgb(color_int: int) -> tuple[float, float, float]:
    r = (color_int >> 16) & 255
    g = (color_int >> 8) & 255
    b = color_int & 255
    return (r / 255.0, g / 255.0, b / 255.0)


def _font_for(target: str) -> str:
    return _CJK_FONTS.get(target.lower(), "helv")


def _apply_redactions(page: "fitz.Page") -> None:
    """抹除原文但尽量保留图片。不同 PyMuPDF 版本签名略有差异,做兼容。"""
    try:
        page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)
    except (TypeError, AttributeError):
        page.apply_redactions()


def _insert_textbox(
    page: "fitz.Page",
    rect: "fitz.Rect",
    text: str,
    size: float,
    color: tuple[float, float, float],
    font: str,
) -> None:
    """把译文写进 rect;放不下就逐步缩小字号。"""
    fs = max(size, 4.0)
    for _ in range(14):
        leftover = page.insert_textbox(
            rect, text, fontsize=fs, fontname=font, color=color, align=0
        )
        if leftover >= 0:  # >=0 表示全部写下
            return
        fs -= 0.7
        if fs < 4.0:
            break
    # 最后兜底:用最小字号强行写入(可能截断,但保证有内容)
    page.insert_textbox(rect, text, fontsize=4.0, fontname=font, color=color, align=0)


def _collect_blocks(page: "fitz.Page") -> list[dict]:
    items: list[dict] = []
    data = page.get_text("dict")
    for block in data.get("blocks", []):
        if block.get("type") != 0:  # 只处理文本块,跳过图片块
            continue
        text_parts: list[str] = []
        sizes: list[float] = []
        colors: list[int] = []
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                text_parts.append(span.get("text", ""))
                sizes.append(span.get("size", 11))
                colors.append(span.get("color", 0))
            text_parts.append(" ")
        text = "".join(text_parts).strip()
        if not text:
            continue
        items.append(
            {
                "bbox": fitz.Rect(block["bbox"]),
                "text": text,
                "size": min(sizes) if sizes else 11.0,
                "color": colors[0] if colors else 0,
            }
        )
    return items


def translate_pdf(
    input_path: str,
    output_path: str,
    translator,
    source_lang: str,
    target_lang: str,
    progress_cb: Callable[[int, int], None] | None = None,
) -> None:
    doc = fitz.open(input_path)
    font = _font_for(target_lang)
    total = doc.page_count
    try:
        for pno in range(total):
            page = doc[pno]
            items = _collect_blocks(page)
            if items:
                translations = translator.translate_texts(
                    [it["text"] for it in items], source_lang, target_lang
                )
                for it in items:
                    page.add_redact_annot(it["bbox"], fill=(1, 1, 1))
                _apply_redactions(page)
                for it, tr in zip(items, translations):
                    _insert_textbox(
                        page,
                        it["bbox"],
                        tr or it["text"],
                        it["size"],
                        _to_rgb(it["color"]),
                        font,
                    )
            if progress_cb:
                progress_cb(pno + 1, total)
        doc.save(output_path, garbage=4, deflate=True)
    finally:
        doc.close()
