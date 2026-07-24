from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("harmonogram-mow")

app = FastAPI(
    title="Harmonogram MOW API",
    version="1.0.0",
    description=(
        "API generatora sześciotygodniowego harmonogramu. "
        "Profil demonstracyjny nie stanowi weryfikacji prawnej."
    ),
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)


@app.exception_handler(RequestValidationError)
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


@app.exception_handler(Exception)
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
