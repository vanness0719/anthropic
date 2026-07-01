# 在 Windows 上把 p1 打包成单文件 .exe。
# 产物:p1\packaging\dist\doclingo-p1.exe
# 用法(PowerShell):  ./build.ps1
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot
$Root = (Resolve-Path "..").Path

Write-Host "==> [1/3] 构建前端静态产物"
Push-Location "$Root\frontend"
npm install --no-audit --no-fund
npm run build
Pop-Location

Write-Host "==> [2/3] 安装 Python 打包依赖"
python -m pip install -r "$Root\backend\requirements.txt" pyinstaller

Write-Host "==> [3/3] PyInstaller 打包"
pyinstaller --clean --noconfirm doclingo-p1.spec

Write-Host ""
Write-Host "完成 ✅  可执行程序: $PSScriptRoot\dist\doclingo-p1.exe"
Write-Host "双击 doclingo-p1.exe 即可运行。"
