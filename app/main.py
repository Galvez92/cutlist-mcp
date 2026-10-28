"""API y demo web de cutlist-mcp."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from cutlist import optimize
from cutlist.exporters import material_csv, sheet_svg
from cutlist.importers import CortecloudImportError, parse_cortecloud

BASE_DIR = Path(__file__).resolve().parent.parent
WEB_DIR = BASE_DIR / "web"
SAMPLE_PATH = BASE_DIR / "tests" / "fixtures" / "cortecloud" / "escritorio_D_simple.json"

app = FastAPI(title="cutlist-mcp", version="0.1.0", description="Optimizador de corte de tableros")
app.mount("/static", StaticFiles(directory=WEB_DIR), name="static")


class OptimizeRequest(BaseModel):
    data: dict
    kerf: float = Field(default=4.0, ge=0, le=50)
    allow_rotation: bool = True


def _payload(data: dict, kerf: float, allow_rotation: bool) -> dict:
    document = parse_cortecloud(data, kerf=kerf)
    result = optimize(document.parts, document.stocks, kerf=kerf, allow_rotation=allow_rotation)

    groups = []
    for layout in result.groups:
        groups.append(
            {
                "material": layout.material,
                "stock": {
                    "length": layout.stock.length,
                    "width": layout.stock.width,
                    "thickness": layout.stock.thickness,
                },
                "kerf": kerf,
                "yield_pct": round(layout.yield_pct, 1),
                "sheets": [
                    {
                        "index": sheet.index,
                        "used_pct": round(sheet.used_pct, 1),
                        "svg": sheet_svg(sheet),
                    }
                    for sheet in layout.sheets
                ],
                "parts": [
                    {
                        "ref": part.ref,
                        "name": part.name,
                        "length": part.length,
                        "width": part.width,
                        "qty": part.qty,
                        "edges": part.edges,
                    }
                    for part in document.parts
                    if part.material == layout.material
                ],
                "placements": [
                    {
                        "ref": placed.ref,
                        "sheet": sheet.index,
                        "x": round(placed.x, 1),
                        "y": round(placed.y, 1),
                        "length": placed.length,
                        "width": placed.width,
                        "rotated": placed.rotated,
                    }
                    for sheet in layout.sheets
                    for placed in sheet.placements
                ],
                "csv": material_csv(layout),
            }
        )

    return {
        "summary": {
            "parts": sum(part.qty for part in document.parts),
            "sheets": len(result.sheets),
            "yield_pct": round(result.yield_pct, 1),
            "unplaced": len(result.unplaced),
        },
        "groups": groups,
        "unplaced": result.unplaced,
        "warnings": document.warnings,
    }


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(WEB_DIR / "index.html")


@app.get("/api/demo", summary="Optimizar la muestra real de Cortecloud")
def demo(
    kerf: float = Query(default=4.0, ge=0, le=50),
    allow_rotation: bool = Query(default=True),
) -> dict:
    data = json.loads(SAMPLE_PATH.read_text(encoding="utf-8"))
    return _payload(data, kerf, allow_rotation)


@app.post("/api/optimize", summary="Optimizar una lista de corte en JSON de Cortecloud")
def optimize_endpoint(request: OptimizeRequest) -> dict:
    try:
        return _payload(request.data, request.kerf, request.allow_rotation)
    except CortecloudImportError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
