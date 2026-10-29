#!/usr/bin/env python3
"""Servidor de vista previa del motor de corte (sólo biblioteca estándar).

Rutas:
  GET  /                   página de vista previa
  GET  /api/health         {"status": "ok"}
  GET  /api/demo           optimiza el fixture real de Cortecloud y devuelve
                           JSON con los tableros, el aprovechamiento y el SVG
                           (?algorithm=guillotine|nonguillotine)
  GET  /api/example        CSV de ejemplo para la caja de texto de la página
  POST /api/optimize       optimiza el CSV enviado en el cuerpo JSON:
                           {"csv": "...", "algorithm": "...", "sheet": {...}}
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

from cutlist.csv_import import EXAMPLE_CSV, parse_parts_csv
from cutlist.demo import load_demo_parts
from cutlist.models import Constraints, Sheet
from cutlist.optimizer import ALGORITHMS, optimize
from cutlist.svg import render_svg

ROOT = Path(__file__).resolve().parent
INDEX = ROOT / "web" / "index.html"
MAX_SHEETS = 30
MAX_BODY = 512_000


def demo_payload(algorithm: str) -> dict:
    """Optimiza el fixture real y devuelve el resultado listo para la vista."""
    if algorithm not in ALGORITHMS:
        return {"error": f"algoritmo desconocido: {algorithm}"}

    parts, sheet = load_demo_parts()
    payload = _payload(parts, sheet, algorithm)
    payload["source"] = "tests/fixtures/cortecloud/escritorio_D_simple.json"
    return payload


def csv_payload(csv_text: str, algorithm: str, sheet_data: dict) -> dict:
    """Optimiza las piezas de un CSV genérico sobre el stock indicado."""
    if algorithm not in ALGORITHMS:
        return {"error": f"algoritmo desconocido: {algorithm}"}

    sheet = _sheet_from_request(sheet_data)
    payload = _payload(parse_parts_csv(csv_text), sheet, algorithm)
    payload["source"] = "csv"
    return payload


def _payload(parts, sheet, algorithm: str) -> dict:
    result = optimize(
        parts,
        [sheet],
        algorithm=algorithm,
        constraints=Constraints(),
        max_sheets=MAX_SHEETS,
    )
    payload = result.to_dict()
    payload["svg"] = render_svg(result)
    payload["sheet"] = {
        "width": sheet.width,
        "height": sheet.height,
        "thickness": sheet.thickness,
        "kerf": sheet.kerf,
    }
    return payload


def _sheet_from_request(data: dict) -> Sheet:
    """Stock del cuerpo JSON; por defecto 2500×1830×18 mm con kerf de 4 mm."""
    return Sheet(
        width=float(data.get("width", 2500)),
        height=float(data.get("height", 1830)),
        thickness=float(data.get("thickness", 18)),
        kerf=float(data.get("kerf", 4)),
        label="Stock indicado",
    )


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
