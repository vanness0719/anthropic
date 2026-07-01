# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller 打包配置:把后端 + 前端静态产物打成单文件可执行程序。

用法(在 p1/packaging 目录下运行):
    pyinstaller --clean --noconfirm doclingo-p1.spec
产物:p1/packaging/dist/doclingo-p1[.exe]
"""
import os

from PyInstaller.utils.hooks import collect_all, collect_submodules

HERE = os.path.abspath(os.getcwd())  # 期望在 p1/packaging 下执行
BACKEND = os.path.abspath(os.path.join(HERE, "..", "backend"))
FRONTEND_DIST = os.path.abspath(os.path.join(HERE, "..", "frontend", "dist"))

if not os.path.isdir(FRONTEND_DIST):
    raise SystemExit(
        f"未找到前端构建产物: {FRONTEND_DIST}\n请先在 p1/frontend 执行 `npm run build`。"
    )

datas = [(FRONTEND_DIST, "frontend_dist")]
binaries = []
hiddenimports = []

# 把动态导入较多的包整包收集,避免运行时缺模块 / 缺二进制。
for pkg in ("fitz", "pymupdf", "anthropic", "uvicorn"):
    try:
        pkg_datas, pkg_bins, pkg_hidden = collect_all(pkg)
        datas += pkg_datas
        binaries += pkg_bins
        hiddenimports += pkg_hidden
    except Exception:
        pass

hiddenimports += collect_submodules("uvicorn")
hiddenimports += ["app.main"]

a = Analysis(
    [os.path.join(BACKEND, "launcher.py")],
    pathex=[BACKEND],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="doclingo-p1",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,  # 保留控制台窗口,方便查看日志 / 关闭即退出
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
