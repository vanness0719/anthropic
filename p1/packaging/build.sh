#!/usr/bin/env bash
# 在 Linux / macOS 上把 p1 打包成单文件可执行程序。
# 产物:p1/packaging/dist/doclingo-p1
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd .. && pwd)"

echo "==> [1/3] 构建前端静态产物"
( cd "$ROOT/frontend" && npm install --no-audit --no-fund && npm run build )

echo "==> [2/3] 安装 Python 打包依赖"
python -m pip install -r "$ROOT/backend/requirements.txt" pyinstaller

echo "==> [3/3] PyInstaller 打包"
pyinstaller --clean --noconfirm doclingo-p1.spec

echo ""
echo "完成 ✅  可执行程序:$(pwd)/dist/doclingo-p1"
echo "双击运行,或在终端执行 ./dist/doclingo-p1"
