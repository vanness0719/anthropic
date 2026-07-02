@echo off
chcp 65001 >nul
rem 打包为单文件可执行程序(Windows)。产物: dist_app\AStock.exe
rem 双击本文件即可;打包一次后,以后只需双击 exe,无需 Python
cd /d %~dp0

set PY=
py -3 -c "exit()" >nul 2>nul && set PY=py -3
if not defined PY (
  python -c "exit()" >nul 2>nul && set PY=python
)
if not defined PY (
  echo.
  echo [错误] 未检测到 Python。打包这一步需要 Python 3.11+,
  echo        请先到 https://www.python.org/downloads/ 下载安装,
  echo        安装时务必勾选 "Add python.exe to PATH",然后重新双击本文件。
  echo.
  pause
  exit /b 1
)

%PY% -c "import sys; sys.exit(0 if sys.version_info>=(3,11) else 1)" || (
  echo [错误] Python 版本过低,需要 3.11+。
  pause
  exit /b 1
)

if not exist .venv (
  echo 首次运行,创建环境并安装依赖(约 1-2 分钟)...
  %PY% -m venv .venv || (echo [错误] 创建虚拟环境失败 & pause & exit /b 1)
  .venv\Scripts\pip install --quiet --upgrade pip
  .venv\Scripts\pip install --quiet -r backend\requirements.txt || (echo [错误] 依赖安装失败,请检查网络 & pause & exit /b 1)
)
.venv\Scripts\pip install --quiet pyinstaller

echo 开始打包(约 2-5 分钟,请耐心等待)...
.venv\Scripts\pyinstaller --onefile --name "AStock" ^
  --distpath dist_app --workpath .build --specpath .build ^
  --paths backend ^
  --collect-submodules app ^
  --collect-all akshare ^
  --add-data "%cd%\frontend\dist;dist" ^
  --noconfirm --clean serve.py || (echo [错误] 打包失败,请把上方红字截图反馈 & pause & exit /b 1)

echo.
echo ============================================
echo 打包完成: %cd%\dist_app\AStock.exe
echo 以后双击它即可启动 A股行情 App(无需 Python)
echo ============================================
pause
