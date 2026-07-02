"""一键启动:后端 API + 前端静态页同端口托管,打印局域网地址与二维码。

用法:python serve.py(或直接 ./start.sh)
iPhone 与电脑连同一 Wi-Fi,扫码打开后「分享 → 添加到主屏幕」。
"""
import socket
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "backend"))

PORT = 8000


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


def main() -> None:
    if not (ROOT / "frontend" / "dist").is_dir():
        print("⚠ frontend/dist 不存在,只提供 API。如需页面请先: cd frontend && npm run build")

    url = f"http://{lan_ip()}:{PORT}"
    print()
    print("=" * 46)
    print("  A股行情 App 已启动")
    print(f"  iPhone(同一 Wi-Fi)访问: {url}")
    print("  打开后: 分享 → 添加到主屏幕")
    print("=" * 46)
    try:
        import qrcode

        qr = qrcode.QRCode(border=1)
        qr.add_data(url)
        qr.print_ascii(invert=True)
    except ImportError:
        print("(pip install qrcode 可在终端显示二维码)")
    print()

    import uvicorn

    from app.main import app

    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="warning")


if __name__ == "__main__":
    main()
