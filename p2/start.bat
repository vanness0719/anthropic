@echo off
rem 一键启动(Windows):首次运行自动创建虚拟环境并安装依赖
cd /d %~dp0

where python >nul 2>nul
if errorlevel 1 (
  echo 需要 Python 3.11+,请先安装: https://www.python.org/downloads/
  exit /b 1
)

if not exist .venv (
  echo 首次运行,安装依赖(约 1-2 分钟)...
  python -m venv .venv
  .venv\Scripts\pip install --quiet --upgrade pip
  .venv\Scripts\pip install --quiet -r backend\requirements.txt
)

.venv\Scripts\python serve.py
