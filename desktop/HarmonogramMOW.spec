from pathlib import Path

from PyInstaller.utils.hooks import collect_all


root = Path(SPEC).resolve().parents[1]
frontend = root / "frontend" / "dist"
icon = frontend / "favicon.ico"

ortools_datas, ortools_binaries, ortools_hidden = collect_all("ortools")
webview_datas, webview_binaries, webview_hidden = collect_all("webview")

a = Analysis(
    [str(root / "desktop" / "launcher.py")],
    pathex=[str(root / "backend")],
    binaries=ortools_binaries + webview_binaries,
    datas=[
        (str(frontend), "frontend"),
        *ortools_datas,
        *webview_datas,
    ],
    hiddenimports=[
        *ortools_hidden,
        *webview_hidden,
        "uvicorn.logging",
        "uvicorn.loops.auto",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan.on",
        "webview.platforms.edgechromium",
        "webview.platforms.winforms",
    ],
    hookspath=[],
    runtime_hooks=[],
    excludes=["pytest", "pytest_cov", "httpx"],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="HarmonogramMOW",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    icon=str(icon),
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name="HarmonogramMOW",
)
