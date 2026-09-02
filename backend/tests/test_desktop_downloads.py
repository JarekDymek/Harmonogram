import importlib.util
from pathlib import Path
import sys
from types import SimpleNamespace
from unittest.mock import Mock


def test_desktop_enables_downloads_before_opening_window(monkeypatch):
    launcher_path = Path(__file__).resolve().parents[2] / "desktop" / "launcher.py"
    spec = importlib.util.spec_from_file_location("desktop_launcher_test", launcher_path)
    launcher = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(launcher)
    frontend = Mock()
    frontend.__truediv__ = Mock(return_value=Mock(is_file=lambda: True))
    monkeypatch.setattr(launcher, "bundled_frontend", lambda: frontend)
    monkeypatch.setattr(launcher, "available_port", lambda: 8765)
    monkeypatch.setattr(launcher.threading, "Thread", Mock())
    monkeypatch.setenv("HARMONOGRAM_FRONTEND_DIR", "test")
    server = SimpleNamespace(started=True, run=lambda: None, should_exit=False)
    monkeypatch.setitem(sys.modules, "uvicorn", SimpleNamespace(
        Config=Mock(), Server=Mock(return_value=server),
    ))
    monkeypatch.setitem(sys.modules, "app.main", SimpleNamespace(app=object()))
    webview = SimpleNamespace(settings={}, start=Mock())

    def create_window(*args, **kwargs):
        assert webview.settings["ALLOW_DOWNLOADS"] is True

    webview.create_window = Mock(side_effect=create_window)
    monkeypatch.setitem(sys.modules, "webview", webview)
    assert launcher.run_desktop() == 0
    webview.create_window.assert_called_once()
    webview.start.assert_called_once_with(debug=False, private_mode=False)
    assert server.should_exit
