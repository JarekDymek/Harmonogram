from __future__ import annotations

import ctypes
import os
from pathlib import Path
import socket
import sys
import threading
import time


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = PROJECT_ROOT / "backend"
if BACKEND_ROOT.is_dir():
    sys.path.insert(0, str(BACKEND_ROOT))


def bundled_frontend() -> Path:
    configured = os.getenv("HARMONOGRAM_FRONTEND_DIR")
    if configured:
        return Path(configured).resolve()
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS).resolve() / "frontend"
    return PROJECT_ROOT / "frontend" / "dist"


def available_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server_socket:
        server_socket.bind(("127.0.0.1", 0))
        return int(server_socket.getsockname()[1])


def show_error(message: str) -> None:
    ctypes.windll.user32.MessageBoxW(
        0,
        message,
        "Harmonogram MOW — błąd uruchamiania",
        0x10,
    )


def self_test() -> int:
    frontend = bundled_frontend()
    if not (frontend / "index.html").is_file():
        return 2
    os.environ["HARMONOGRAM_FRONTEND_DIR"] = str(frontend)
    from app.main import create_app

    application = create_app(frontend)
    documented_paths = set(application.openapi()["paths"])
    return 0 if "/api/health" in documented_paths else 3


def run_desktop() -> int:
    frontend = bundled_frontend()
    if not (frontend / "index.html").is_file():
        show_error("Nie znaleziono plików interfejsu aplikacji.")
        return 2

    os.environ["HARMONOGRAM_FRONTEND_DIR"] = str(frontend)

    import uvicorn
    import webview

    from app.main import app

    port = available_port()
    server = uvicorn.Server(
        uvicorn.Config(
            app,
            host="127.0.0.1",
            port=port,
            log_level="warning",
            access_log=False,
        )
    )
    server.install_signal_handlers = lambda: None
    server_thread = threading.Thread(
        target=server.run,
        name="harmonogram-api",
        daemon=True,
    )
    server_thread.start()

    for _ in range(200):
        if server.started:
            break
        if not server_thread.is_alive():
            show_error("Lokalny backend nie uruchomił się poprawnie.")
            return 4
        time.sleep(0.05)
    else:
        server.should_exit = True
        show_error("Przekroczono czas oczekiwania na lokalny backend.")
        return 5

    try:
        webview.create_window(
            "Harmonogram MOW",
            f"http://127.0.0.1:{port}/",
            width=1440,
            height=900,
            min_size=(960, 640),
            background_color="#f4f6f7",
        )
        webview.start(debug=False, private_mode=False)
    finally:
        server.should_exit = True
        server_thread.join(timeout=5)
    return 0


def main() -> int:
    if "--self-test" in sys.argv:
        return self_test()
    try:
        return run_desktop()
    except Exception as exc:
        show_error(f"Nie udało się uruchomić aplikacji:\n\n{exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
