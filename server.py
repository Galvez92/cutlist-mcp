#!/usr/bin/env python3
"""Servidor de vista previa del motor de corte (sólo biblioteca estándar).

Rutas:
  GET  /                   página de vista previa
  GET  /favicon.svg        icono de la página (también en /favicon.ico)
  GET  /api/health         {"status": "ok"}
  GET  /api/demo           optimiza el fixture real de Cortecloud y devuelve
                           JSON con los tableros, el aprovechamiento y el SVG
                           (?algorithm=guillotine|nonguillotine)
  GET  /api/example        CSV de ejemplo para la caja de texto de la página
  GET  /api/stocks         catálogo de stocks guardado (JSON en disco)
  PUT  /api/stocks         guarda el catálogo: {"stocks": [{...}, ...]}
  POST /api/optimize       optimiza las piezas enviadas en el cuerpo JSON:
                           {"csv": "..."}, {"dxf": "..."} o
                           {"promob": "..."}, más "algorithm", "sheet" o
                           "stocks": [{...}, ...]
                           (cada pieza se corta del stock de su material).
  POST /api/report.pdf     el mismo cuerpo, opcionalmente {"source": "demo"},
                           y devuelve el reporte en PDF.
"""

from __future__ import annotations

import json
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from cutlist.catalog import CatalogStore, parse_catalog, sheet_to_dict
from cutlist.cortecloud import MaterialGroup, load_fixture
from cutlist.csv_import import EXAMPLE_CSV, parse_parts_csv
from cutlist.dxf import parse_dxf
from cutlist.materials import optimize_by_material
from cutlist.models import Constraints, Part, Sheet
from cutlist.optimizer import ALGORITHMS
from cutlist.pdf import render_pdf
from cutlist.promob import parse_promob_xml
from cutlist.stock import optimize_with_stock
from cutlist.svg import render_svg

ROOT = Path(__file__).resolve().parent
INDEX = ROOT / "web" / "index.html"
FAVICON = ROOT / "web" / "favicon.svg"
MAX_SHEETS = 30
MAX_BODY = 4_000_000
STOCKS_PATH = Path(os.environ.get("CUTLIST_STOCKS") or ROOT / "data" / "stocks.json")


def demo_payload(algorithm: str) -> dict:
    """Optimiza el fixture real de Cortecloud, material por material."""
    if algorithm not in ALGORITHMS:
        return {"error": f"algoritmo desconocido: {algorithm}"}

    payload = _payload(load_fixture(), algorithm)
    payload["source"] = "tests/fixtures/cortecloud/escritorio_D_simple.json"
    return payload


def optimize_payload(body: dict) -> dict:
    """Optimiza las piezas del cuerpo JSON (CSV, DXF o Promob) contra los stocks."""
    algorithm = str(body.get("algorithm", "guillotine"))
    if algorithm not in ALGORITHMS:
        return {"error": f"algoritmo desconocido: {algorithm}"}

    sheets = _sheets_from_request(body.get("sheet") or {}, body.get("stocks"))
    parts, import_warnings, source = _parts_from_body(body)
    optimization = _optimize(parts, sheets, algorithm)
    payload = optimization.to_dict()
    payload["svg"] = render_svg(optimization.result)
    payload["stocks"] = [sheet_to_dict(sheet) for sheet in sheets]
    payload["sheet"] = payload["stocks"][0]
    payload["source"] = source
    if import_warnings:
        payload["warnings"] = [*import_warnings, *payload["warnings"]]
    return payload


def report_pdf(body: dict) -> bytes:
    """Reporte PDF: la muestra de Cortecloud o las piezas enviadas."""
    algorithm = str(body.get("algorithm", "guillotine"))
    if algorithm not in ALGORITHMS:
        raise ValueError(f"algoritmo desconocido: {algorithm}")

    if str(body.get("source") or "").strip() == "demo":
        source = "tests/fixtures/cortecloud/escritorio_D_simple.json"
        optimization = optimize_by_material(
            load_fixture(),
            algorithm=algorithm,
            constraints=Constraints(),
            max_sheets=MAX_SHEETS,
        )
    else:
        sheets = _sheets_from_request(body.get("sheet") or {}, body.get("stocks"))
        parts, import_warnings, origin = _parts_from_body(body)
        optimization = _optimize(parts, sheets, algorithm)
        source = origin
        if import_warnings:
            optimization.result.warnings = [
                *import_warnings,
                *optimization.result.warnings,
            ]

    return render_pdf(
        optimization.result, source=source, generated=time.strftime("%Y-%m-%d %H:%M")
    )


def _optimize(parts: list[Part], sheets: list[Sheet], algorithm: str):
    return optimize_with_stock(
        parts, sheets, algorithm=algorithm, constraints=Constraints(), max_sheets=MAX_SHEETS
    )


def _parts_from_body(body: dict) -> tuple[list[Part], list[str], str]:
    """Piezas del cuerpo JSON: texto `csv`, dibujo `dxf` o XML de Promob."""
    csv_text = str(body.get("csv") or "").strip()
    dxf_text = str(body.get("dxf") or "").strip()
    promob_text = str(body.get("promob") or "").strip()
    if sum(1 for text in (csv_text, dxf_text, promob_text) if text) > 1:
        raise ValueError("envía las piezas en CSV, en DXF o en XML de Promob, no en varios")
    if dxf_text:
        imported = parse_dxf(dxf_text)
        return imported.parts, imported.warnings, "dxf"
    if promob_text:
        imported = parse_promob_xml(promob_text)
        return (
            imported.parts,
            [
                *imported.warnings,
                "el XML de Promob no trae material ni veta: las piezas usan el "
                "stock comodín y se pueden girar",
            ],
            "promob",
        )
    return parse_parts_csv(csv_text), [], "csv"


def _payload(groups: list[MaterialGroup], algorithm: str) -> dict:
    optimization = optimize_by_material(
        groups, algorithm=algorithm, constraints=Constraints(), max_sheets=MAX_SHEETS
    )
    payload = optimization.to_dict()
    payload["svg"] = render_svg(optimization.result)
    return payload


def _sheets_from_request(sheet_data, stocks_data) -> list[Sheet]:
    """Catálogo del cuerpo JSON: una lista `stocks` o un `sheet` único comodín."""
    if stocks_data is None:
        return parse_catalog([sheet_data or {}], default_label="Stock indicado")
    return parse_catalog(stocks_data)


def _catalog() -> CatalogStore:
    """Catálogo guardado; la ruta se puede cambiar con `CUTLIST_STOCKS`."""
    return CatalogStore(Path(STOCKS_PATH))


class Handler(BaseHTTPRequestHandler):
    server_version = "cutlist-mcp/0.1"

    def do_GET(self) -> None:  # noqa: N802 (nombre impuesto por http.server)
        path = urlsplit(self.path).path
        query = parse_qs(urlsplit(self.path).query)

        if path in ("/", "/index.html"):
            try:
                self._send(200, "text/html; charset=utf-8", INDEX.read_bytes())
            except FileNotFoundError:
                self._send(500, "text/plain; charset=utf-8", b"falta web/index.html")
        elif path in ("/favicon.ico", "/favicon.svg"):
            try:
                self._send(200, "image/svg+xml", FAVICON.read_bytes())
            except FileNotFoundError:
                self._send(404, "text/plain; charset=utf-8", b"sin favicon")
        elif path == "/api/health":
            self._json({"status": "ok"})
        elif path == "/api/demo":
            algorithm = query.get("algorithm", ["guillotine"])[0]
            try:
                payload = demo_payload(algorithm)
            except Exception as error:  # noqa: BLE001 - se reporta en la vista
                self._json({"error": f"{type(error).__name__}: {error}"}, status=500)
                return
            self._json(payload, status=400 if "error" in payload else 200)
        elif path == "/api/example":
            self._json({"csv": EXAMPLE_CSV})
        elif path == "/api/stocks":
            sheets, warning = _catalog().load()
            payload = {"stocks": [sheet_to_dict(sheet) for sheet in sheets]}
            if warning:
                payload["warning"] = warning
            self._json(payload)
        else:
            self._send(404, "text/plain; charset=utf-8", b"no encontrado")

    def do_POST(self) -> None:  # noqa: N802 (nombre impuesto por http.server)
        path = urlsplit(self.path).path
        if path not in ("/api/optimize", "/api/report.pdf"):
            self._send(404, "text/plain; charset=utf-8", b"no encontrado")
            return

        try:
            body = self._read_json()
            if path == "/api/report.pdf":
                pdf = report_pdf(body)
            else:
                payload = optimize_payload(body)
        except (ValueError, TypeError) as error:
            self._json({"error": str(error)}, status=400)
            return
        except Exception as error:  # noqa: BLE001 - se reporta en la vista
            self._json({"error": f"{type(error).__name__}: {error}"}, status=500)
            return

        if path == "/api/report.pdf":
            self._send(
                200,
                "application/pdf",
                pdf,
                {"Content-Disposition": 'attachment; filename="cutlist-reporte.pdf"'},
            )
        else:
            self._json(payload, status=400 if "error" in payload else 200)

    def do_PUT(self) -> None:  # noqa: N802 (nombre impuesto por http.server)
        if urlsplit(self.path).path != "/api/stocks":
            self._send(404, "text/plain; charset=utf-8", b"no encontrado")
            return

        try:
            body = self._read_json()
            saved = _catalog().save(parse_catalog(body.get("stocks")))
        except (ValueError, TypeError) as error:
            self._json({"error": str(error)}, status=400)
            return
        except Exception as error:  # noqa: BLE001 - se reporta en la vista
            self._json({"error": f"{type(error).__name__}: {error}"}, status=500)
            return

        self._json({"stocks": [sheet_to_dict(sheet) for sheet in saved]})

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            raise ValueError("cuerpo vacío o demasiado grande")
        body = json.loads(self.rfile.read(length).decode("utf-8"))
        if not isinstance(body, dict):
            raise ValueError("se espera un objeto JSON")
        return body

    def _json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self._send(status, "application/json; charset=utf-8", body)

    def _send(
        self,
        status: int,
        content_type: str,
        body: bytes,
        headers: dict | None = None,
    ) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)


def _watch_reload() -> None:
    """Reinicia el proceso cuando cambia código Python (recarga para desarrollo)."""
    watched = [ROOT / "server.py", *sorted((ROOT / "cutlist").glob("*.py"))]
    stamps = {path: path.stat().st_mtime for path in watched if path.exists()}
    while True:
        time.sleep(1.0)
        for path, stamp in list(stamps.items()):
            try:
                current = path.stat().st_mtime
            except OSError:
                continue
            if current != stamp:
                print(f"[reload] {path.name} cambió, reiniciando", flush=True)
                os.execv(sys.executable, [sys.executable, *sys.argv])


def main() -> None:
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    if "--reload" in sys.argv:
        threading.Thread(target=_watch_reload, daemon=True).start()
    print(f"cutlist-mcp escuchando en http://0.0.0.0:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
