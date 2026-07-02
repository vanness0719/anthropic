@echo off
chcp 65001 >nul
rem 一键启动(Windows):首次运行自动创建虚拟环境并安装依赖
cd /d %~dp0

set PY=
py -3 -c "exit()" >nul 2>nul && set PY=py -3
if not defined PY (
  python -c "exit()" >nul 2>nul && set PY=python
)
if not defined PY (
  echo.
  echo [错误] 未检测到 Python。请到 https://www.python.org/downloads/ 下载安装,
  echo        安装时务必勾选 "Add python.exe to PATH",然后重新双击本文件。
  echo.
  pause
  exit /b 1
)

if not exist .venv (
  echo 首次运行,安装依赖(约 1-2 分钟)...
  %PY% -m venv .venv || (echo [错误] 创建虚拟环境失败 & pause & exit /b 1)
  .venv\Scripts\pip install --quiet --upgrade pip
  .venv\Scripts\pip install --quiet -r backend\requirements.txt || (echo [错误] 依赖安装失败,请检查网络 & pause & exit /b 1)
)

.venv\Scripts\python serve.py
pause
