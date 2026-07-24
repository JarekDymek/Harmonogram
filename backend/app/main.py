from __future__ import annotations

import logging
import os
from pathlib import Path
import sys

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import router


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("harmonogram-mow")

DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://jarekdymek.github.io",
]


def configured_cors_origins() -> list[str]:
    value = os.getenv("CORS_ORIGINS", "")
    if not value.strip():
        return DEFAULT_CORS_ORIGINS
    return [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]


def frontend_directory() -> Path | None:
    configured = os.getenv("HARMONOGRAM_FRONTEND_DIR")
    if configured:
        candidate = Path(configured).resolve()
    elif getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        candidate = Path(sys._MEIPASS).resolve() / "frontend"
    else:
        candidate = Path(__file__).resolve().parents[2] / "frontend" / "dist"
    return candidate if (candidate / "index.html").is_file() else None


async def request_validation_error(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "status": "INVALID_REQUEST",
            "message": "Żądanie nie jest zgodne ze schematem API.",
            "details": exc.errors(),
        },
    )


async def unhandled_error(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Nieobsłużony błąd dla %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "status": "INTERNAL_ERROR",
            "publicResult": "BLAD_WEWNETRZNY",
            "message": "Wystąpił błąd wewnętrzny. Nie opublikowano harmonogramu.",
        },
    )


def create_app(static_frontend: Path | None = None) -> FastAPI:
    application = FastAPI(
        title="Harmonogram MOW API",
        version="1.2.0",
        description=(
            "API generatora harmonogramu 1–6 tygodni dla 3 lub 4 wychowawców. "
            "Profil demonstracyjny nie stanowi weryfikacji prawnej."
        ),
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=configured_cors_origins(),
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(router)
    application.add_exception_handler(
        RequestValidationError,
        request_validation_error,
    )
    application.add_exception_handler(Exception, unhandled_error)

    frontend = static_frontend or frontend_directory()
    if frontend and (frontend / "index.html").is_file():
        frontend = frontend.resolve()
        assets = frontend / "assets"
        if assets.is_dir():
            application.mount(
                "/assets",
                StaticFiles(directory=assets),
                name="frontend-assets",
            )

        @application.get("/{requested_path:path}", include_in_schema=False)
        async def serve_frontend(requested_path: str) -> FileResponse:
            if requested_path.startswith("api/"):
                raise HTTPException(status_code=404, detail="Endpoint nie istnieje.")
            candidate = (frontend / requested_path).resolve()
            if candidate.is_relative_to(frontend) and candidate.is_file():
                return FileResponse(candidate)
            return FileResponse(frontend / "index.html")

    return application


app = create_app()
