#!/usr/bin/env bash
# 打包为单文件可执行程序(macOS/Linux)。产物: dist_app/A股行情
# 注意:可执行文件不能跨系统,Windows 的 exe 请在 Windows 上跑 package.bat
set -e
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  python3 -m venv .venv
  .venv/bin/pip install --quiet --upgrade pip
  .venv/bin/pip install --quiet -r backend/requirements.txt
fi
.venv/bin/pip install --quiet pyinstaller

.venv/bin/pyinstaller --onefile --name "AStock" \
  --distpath dist_app --workpath .build --specpath .build \
  --paths backend \
  --collect-submodules app \
  --collect-all akshare \
  --add-data "$(pwd)/frontend/dist:dist" \
  --noconfirm --clean serve.py

echo
echo "打包完成: $(pwd)/dist_app/AStock"
echo "以后双击它即可启动 A股行情 App(无需 Python)。"
