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
  POST /api/optimize       optimiza el CSV enviado en el cuerpo JSON:
                           {"csv": "...", "algorithm": "...", "sheet": {...}}
                           o, con varios tipos de stock, "stocks": [{...}, ...]
                           (cada pieza se corta del stock de su material).
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

from cutlist.cortecloud import MaterialGroup, load_fixture
from cutlist.csv_import import EXAMPLE_CSV, parse_parts_csv
from cutlist.materials import optimize_by_material
from cutlist.models import Constraints, Sheet
from cutlist.optimizer import ALGORITHMS
from cutlist.stock import optimize_with_stock
from cutlist.svg import render_svg

ROOT = Path(__file__).resolve().parent
INDEX = ROOT / "web" / "index.html"
FAVICON = ROOT / "web" / "favicon.svg"
MAX_SHEETS = 30
MAX_BODY = 512_000


def demo_payload(algorithm: str) -> dict:
    """Optimiza el fixture real de Cortecloud, material por material."""
    if algorithm not in ALGORITHMS:
        return {"error": f"algoritmo desconocido: {algorithm}"}

    payload = _payload(load_fixture(), algorithm)
    payload["source"] = "tests/fixtures/cortecloud/escritorio_D_simple.json"
    return payload


def csv_payload(
    csv_text: str, algorithm: str, sheet_data: dict, stocks_data=None
) -> dict:
    """Optimiza el CSV asignando cada pieza al stock de su material."""
    if algorithm not in ALGORITHMS:
        return {"error": f"algoritmo desconocido: {algorithm}"}

    sheets = _sheets_from_request(sheet_data, stocks_data)
    parts = parse_parts_csv(csv_text)
    optimization = optimize_with_stock(
        parts, sheets, algorithm=algorithm, constraints=Constraints(), max_sheets=MAX_SHEETS
    )
    payload = optimization.to_dict()
    payload["svg"] = render_svg(optimization.result)
    payload["stocks"] = [_sheet_dict(sheet) for sheet in sheets]
    payload["sheet"] = payload["stocks"][0]
    payload["source"] = "csv"
    return payload


def _payload(groups: list[MaterialGroup], algorithm: str) -> dict:
    optimization = optimize_by_material(
        groups, algorithm=algorithm, constraints=Constraints(), max_sheets=MAX_SHEETS
    )
    payload = optimization.to_dict()
    payload["svg"] = render_svg(optimization.result)
    return payload


def _sheets_from_request(sheet_data: dict, stocks_data) -> list[Sheet]:
    """Catálogo de stocks del cuerpo JSON: una lista `stocks` o un `sheet` único."""
    if stocks_data is None:
        return [_sheet_from_request(sheet_data)]
    if not isinstance(stocks_data, list):
        raise ValueError("«stocks» debe ser una lista de objetos")
    if not stocks_data:
        raise ValueError("«stocks» está vacío")
    sheets = []
    for index, data in enumerate(stocks_data, start=1):
        if not isinstance(data, dict):
            raise ValueError(f"stock {index}: se espera un objeto")
        material = str(data.get("material") or "").strip()
        sheets.append(
            _sheet_from_request(
                data, material=material, label=material or f"Stock {index}"
            )
        )
    return sheets


def _sheet_from_request(
    data: dict, material: str = "", label: str = "Stock indicado"
) -> Sheet:
    """Un stock del cuerpo JSON; por defecto 2500×1830×18 mm con kerf de 4 mm."""
    return Sheet(
        width=float(data.get("width", 2500)),
        height=float(data.get("height", 1830)),
        thickness=float(data.get("thickness", 18)),
        kerf=float(data.get("kerf", 4)),
        label=label,
        material=material,
    )


def _sheet_dict(sheet: Sheet) -> dict:
    return {
        "material": sheet.material,
        "label": sheet.label,
        "width": sheet.width,
        "height": sheet.height,
        "thickness": sheet.thickness,
        "kerf": sheet.kerf,
    }


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
        else:
            self._send(404, "text/plain; charset=utf-8", b"no encontrado")

    def do_POST(self) -> None:  # noqa: N802 (nombre impuesto por http.server)
        if urlsplit(self.path).path != "/api/optimize":
            self._send(404, "text/plain; charset=utf-8", b"no encontrado")
            return

        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            self._json({"error": "cuerpo vacío o demasiado grande"}, status=400)
            return

        try:
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(body, dict):
                raise ValueError("se espera un objeto JSON")
            payload = csv_payload(
                str(body.get("csv", "")),
                str(body.get("algorithm", "guillotine")),
                body.get("sheet") or {},
                body.get("stocks"),
            )
        except (ValueError, TypeError) as error:
            self._json({"error": str(error)}, status=400)
            return
        except Exception as error:  # noqa: BLE001 - se reporta en la vista
            self._json({"error": f"{type(error).__name__}: {error}"}, status=500)
            return

        self._json(payload, status=400 if "error" in payload else 200)

    def _json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self._send(status, "application/json; charset=utf-8", body)

    def _send(self, status: int, content_type: str, body: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
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
