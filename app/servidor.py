"""Vista previa de desarrollo de los módulos paramétricos (puerto 3000).

Servidor HTTP de la biblioteca estándar: no agrega dependencias al proyecto y
solo sirve para ver y probar los generadores desde el navegador. La demo web
pública del proyecto es otra tarea (`docs/memoria/tareas/demo-web-docs.md`); esto
es el punto de entrada del entorno de desarrollo.

Rutas
-----
``GET  /``                  página de la vista previa
``GET  /api/modulos``       módulos registrados con sus parámetros
``GET  /api/perfil``        perfil de restricciones por omisión
``POST /api/previsualizar`` ``{"tipo": "cajonera", "params": {...}}``
``POST /api/idea``          ``{"texto": "cajonera ancho=450 cajones=3"}``
"""

from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from cutlist.modules import MODULOS, generar_modulo
from cutlist.profiles import PERFIL_CORTECLOUD_MADIJAL
from cutlist.spec import construir_desde_texto, parsear

AQUI = Path(__file__).resolve().parent
PAGINA = AQUI / "preview.html"
PUERTO = int(os.environ.get("PORT", "3000"))


def _modulos() -> dict:
    return {
        "modulos": [
            {
                "tipo": registro.tipo,
                "titulo": registro.titulo,
                "descripcion": registro.descripcion,
                "campos": registro.campos_ui(),
            }
            for registro in MODULOS.values()
        ]
    }


def _perfil() -> dict:
    perfil = PERFIL_CORTECLOUD_MADIJAL
    return {
        "nombre": perfil.nombre,
        "fuente": perfil.fuente,
        "pieza_min_corte": perfil.pieza_min_corte,
        "pieza_min_recomendada": perfil.pieza_min_recomendada,
        "pieza_min_terminada": perfil.pieza_min_terminada,
        "pieza_mecanizada_min_largo": perfil.pieza_mecanizada_min_largo,
        "pieza_max": [perfil.pieza_max_largo, perfil.pieza_max_ancho],
        "tablero": [perfil.tablero_largo, perfil.tablero_ancho, perfil.tablero_espesor],
        "ranuras_permitidas": list(perfil.ranuras_permitidas),
        "barrenos_horizontales": list(perfil.barrenos_horizontales),
        "barrenos_verticales": list(perfil.barrenos_verticales),
    }


def _previsualizar(datos: dict) -> dict:
    tipo = datos.get("tipo")
    if not tipo:
        raise ValueError("falta el tipo de módulo")
    modulo = generar_modulo(str(tipo), datos.get("params") or {})
    return modulo.to_dict_con_perfil()


def _previsualizar_idea(datos: dict) -> dict:
    texto = str(datos.get("texto") or "")
    tipo, valores = parsear(texto)
    return _previsualizar({"tipo": tipo, "params": valores})


class Manejador(BaseHTTPRequestHandler):
    server_version = "cutlist-preview"

    def log_message(self, formato: str, *args) -> None:  # pragma: no cover - ruido
        print(f"{self.address_string()} - {formato % args}")

    def _responder(self, estado: int, cuerpo: bytes, tipo: str) -> None:
        self.send_response(estado)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(cuerpo)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(cuerpo)

    def _json(self, estado: int, datos: dict) -> None:
        cuerpo = json.dumps(datos, ensure_ascii=False, indent=2).encode("utf-8")
        self._responder(estado, cuerpo, "application/json; charset=utf-8")

    def _error(self, estado: int, mensaje: str) -> None:
        self._json(estado, {"error": mensaje})

    def do_GET(self) -> None:  # noqa: N802 - API de http.server
        ruta = urlparse(self.path).path
        if ruta in ("/", "/index.html"):
            if not PAGINA.exists():  # pragma: no cover - defensivo
                self._error(500, "falta app/preview.html")
                return
            self._responder(200, PAGINA.read_bytes(), "text/html; charset=utf-8")
            return
        if ruta == "/api/modulos":
            self._json(200, _modulos())
            return
        if ruta == "/api/perfil":
            self._json(200, _perfil())
            return
        self._error(404, f"ruta desconocida: {ruta}")

    def do_POST(self) -> None:  # noqa: N802 - API de http.server
        ruta = urlparse(self.path).path
        manejadores = {
            "/api/previsualizar": _previsualizar,
            "/api/idea": _previsualizar_idea,
        }
        if ruta not in manejadores:
            self._error(404, f"ruta desconocida: {ruta}")
            return
        largo = int(self.headers.get("Content-Length") or 0)
        crudo = self.rfile.read(largo) if largo else b"{}"
        try:
            datos = json.loads(crudo.decode("utf-8") or "{}")
        except json.JSONDecodeError as exc:
            self._error(400, f"JSON inválido: {exc.msg}")
            return
        try:
            if not isinstance(datos, dict):
                raise ValueError("el cuerpo debe ser un objeto JSON")
            self._json(200, manejadores[ruta](datos))
        except (ValueError, TypeError, KeyError) as exc:
            self._error(400, str(exc))


def main() -> None:
    servidor = ThreadingHTTPServer(("0.0.0.0", PUERTO), Manejador)
    print(f"Vista previa de módulos paramétricos en http://0.0.0.0:{PUERTO}")
    servidor.serve_forever()


if __name__ == "__main__":
    main()
