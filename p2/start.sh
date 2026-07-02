#!/usr/bin/env bash
# 一键启动(macOS / Linux):首次运行自动创建虚拟环境并安装依赖
set -e
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null; then
  echo "需要 Python 3.11+,请先安装: https://www.python.org/downloads/"
  exit 1
fi

if [ ! -d .venv ]; then
  echo "首次运行,安装依赖(约 1-2 分钟)..."
  python3 -m venv .venv
  .venv/bin/pip install --quiet --upgrade pip
  .venv/bin/pip install --quiet -r backend/requirements.txt
fi

exec .venv/bin/python serve.py
