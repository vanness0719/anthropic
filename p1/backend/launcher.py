"""桌面启动器:双击即启动本地服务并打开浏览器。

打包成单文件可执行程序后(见 ../packaging),用户无需安装任何依赖,
双击即可:自动选一个空闲端口 -> 启动 FastAPI(内置托管前端)-> 打开浏览器。
关闭控制台窗口即退出。
"""
from __future__ import annotations

import os
import socket
import threading
import time
import webbrowser


def _find_free_port(preferred: int = 8000) -> int:
    for candidate in (preferred, 0):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.bind(("127.0.0.1", candidate))
            port = s.getsockname()[1]
            s.close()
            return port
        except OSError:
            continue
    return preferred


def main() -> None:
    port = int(os.environ.get("P1_PORT") or _find_free_port(8000))
    url = f"http://127.0.0.1:{port}"

    def _open() -> None:
        time.sleep(1.5)
        try:
            webbrowser.open(url)
        except Exception:
            pass

    threading.Thread(target=_open, daemon=True).start()

    print("\n" + "=" * 52)
    print("  p1 · PDF 文档翻译(保留排版)")
    print(f"  已启动:{url}")
    print("  浏览器会自动打开;关闭此窗口即退出程序。")
    print("=" * 52 + "\n")

    import uvicorn

    from app.main import app

    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")


if __name__ == "__main__":
    main()
