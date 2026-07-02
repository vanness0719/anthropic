@echo off
rem 打包为单文件可执行程序(Windows)。产物: dist_app\A股行情.exe
rem 双击本文件即可;打包一次后,以后只需双击 exe,无需 Python
cd /d %~dp0

if not exist .venv (
  python -m venv .venv
  .venv\Scripts\pip install --quiet --upgrade pip
  .venv\Scripts\pip install --quiet -r backend\requirements.txt
)
.venv\Scripts\pip install --quiet pyinstaller

.venv\Scripts\pyinstaller --onefile --name "A股行情" ^
  --distpath dist_app --workpath .build --specpath .build ^
  --paths backend ^
  --collect-submodules app ^
  --collect-all akshare ^
  --add-data "%cd%\frontend\dist;dist" ^
  --noconfirm --clean serve.py

echo.
echo 打包完成: %cd%\dist_app\A股行情.exe
echo 以后双击它即可启动(无需 Python)。
pause
