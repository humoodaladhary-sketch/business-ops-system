from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from src.database import init_db
from src.api.routes_kpi import router as kpi_router

app = FastAPI(
    title="Oman Broadband — Quality Management KPI System",
    description="KPI tracking system for Hamood Al Adhari, Senior QM Engineer",
    version="1.0.0",
)

app.include_router(kpi_router)

static_dir = Path(__file__).parent.parent / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


@app.on_event("startup")
async def startup():
    init_db()


@app.get("/")
async def root():
    index_path = static_dir / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"system": "Oman Broadband QM KPI System", "engineer": "Hamood Al Adhari"}
