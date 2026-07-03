"""一键启动:后端 API + 前端静态页同端口托管,自动打开浏览器并打印手机扫码地址。

三种运行形态共用本入口:
  1. ./start.sh / start.bat(venv)
  2. python serve.py(开发)
  3. PyInstaller 单文件可执行(package.sh / package.bat 打包,frozen 模式)
"""
import os
import socket
import sys
import threading
import webbrowser
from pathlib import Path

# Windows 控制台默认编码(GBK/cp1252)打印中文横幅会 UnicodeEncodeError,
# 重配为 UTF-8;仍编不出的字符降级替换而不是崩溃
for _stream in (sys.stdout, sys.stderr):
    if _stream is not None and hasattr(_stream, "reconfigure"):
        try:
            _stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

if getattr(sys, "frozen", False):  # PyInstaller 解包目录
    _BASE = Path(getattr(sys, "_MEIPASS"))
    os.environ.setdefault("P2_DIST", str(_BASE / "dist"))
else:
    _BASE = Path(__file__).resolve().parent
    sys.path.insert(0, str(_BASE / "backend"))


def lan_ip() -> str:
    """通过 UDP connect 探测本机局域网 IP(不真正发包)。"""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("223.5.5.5", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def pick_port(preferred: int = 8000) -> int:
    for port in (preferred, 8001, 8002, 8080, 0):
        try:
            with socket.socket() as s:
                s.bind(("0.0.0.0", port))
                return s.getsockname()[1]
        except OSError:
            continue
    raise RuntimeError("无可用端口")


def main() -> None:
    port = pick_port()
    local_url = f"http://127.0.0.1:{port}"
    phone_url = f"http://{lan_ip()}:{port}"

    print()
    print("=" * 46)
    print("  A股行情 App 已启动(关闭本窗口即退出)")
    print(f"  本机浏览器: {local_url} (已自动打开)")
    print(f"  iPhone(同一 Wi-Fi): {phone_url}")
    print("  手机打开后: 分享 → 添加到主屏幕")
    print("=" * 46)
    try:
        import qrcode

        qr = qrcode.QRCode(border=1)
        qr.add_data(phone_url)
        qr.print_ascii(invert=True)
    except ImportError:
        print("(pip install qrcode 可在终端显示手机扫码二维码)")
    print()

    threading.Timer(1.2, webbrowser.open, [local_url]).start()

    import uvicorn

    from app.main import app

    uvicorn.run(app, host="0.0.0.0", port=port, log_level="warning")


if __name__ == "__main__":
    main()
