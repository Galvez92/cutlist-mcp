#!/usr/bin/env python3
"""Servidor de vista previa del motor de corte (sólo biblioteca estándar).

Rutas:
  GET /                    página de vista previa
  GET /api/health          {"status": "ok"}
  GET /api/demo            optimiza el fixture real de Cortecloud y devuelve
                           JSON con los tableros, el aprovechamiento y el SVG
                           (?algorithm=guillotine|nonguillotine)
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

from cutlist.demo import load_demo_parts
from cutlist.models import Constraints
from cutlist.optimizer import ALGORITHMS, optimize
from cutlist.svg import render_svg

ROOT = Path(__file__).resolve().parent
INDEX = ROOT / "web" / "index.html"
MAX_SHEETS = 30


def demo_payload(algorithm: str) -> dict:
    """Optimiza el fixture real y devuelve el resultado listo para la vista."""
    if algorithm not in ALGORITHMS:
        return {"error": f"algoritmo desconocido: {algorithm}"}

    parts, sheet = load_demo_parts()
    result = optimize(
        parts,
        [sheet],
        algorithm=algorithm,
        constraints=Constraints(),
        max_sheets=MAX_SHEETS,
    )
    payload = result.to_dict()
    payload["svg"] = render_svg(result)
    payload["source"] = "tests/fixtures/cortecloud/escritorio_D_simple.json"
    payload["sheet"] = {
        "width": sheet.width,
        "height": sheet.height,
        "thickness": sheet.thickness,
        "kerf": sheet.kerf,
    }
    return payload


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
        else:
            self._send(404, "text/plain; charset=utf-8", b"no encontrado")

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
