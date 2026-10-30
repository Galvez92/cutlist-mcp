import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

import server
from tests.support import block, dxf_document, insert, lwpolyline

RECT = [(0, 0), (600, 0), (600, 732), (0, 732)]
DEFAULT_STOCK = {"material": "", "width": 2500, "height": 1830, "thickness": 18, "kerf": 4}


class ServerTest(unittest.TestCase):
    """Recorre las rutas reales del servidor de vista previa."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.stocks_path = Path(cls.tmp.name) / "stocks.json"
        cls.previous_stocks_path = server.STOCKS_PATH
        server.STOCKS_PATH = cls.stocks_path
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.port = cls.httpd.server_address[1]
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        server.STOCKS_PATH = cls.previous_stocks_path
        cls.tmp.cleanup()

    def _get(self, path):
        with urllib.request.urlopen(
            f"http://127.0.0.1:{self.port}{path}", timeout=15
        ) as response:
            return response.status, response.read().decode("utf-8")

    def test_health(self):
        status, body = self._get("/api/health")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body), {"status": "ok"})

    def test_pagina_principal(self):
        status, body = self._get("/")
        self.assertEqual(status, 200)
        self.assertIn("cutlist-mcp", body)
        self.assertIn('rel="icon"', body)

    def test_pagina_tiene_editor_de_stocks(self):
        status, body = self._get("/")
        self.assertEqual(status, 200)
        for marker in (
            'id="stocks"',
            'id="add-stock"',
            'id="reset-stocks"',
            'id="stocks-status"',
            "Agregar stock",
            "readStocks()",
            "/api/stocks",
        ):
            self.assertIn(marker, body)
        self.assertIn("2500", body)  # stock por defecto: 2500 × 1830 × 18, kerf 4

    def test_pagina_tiene_importacion_dxf_y_reporte(self):
        status, body = self._get("/")
        self.assertEqual(status, 200)
        for marker in (
            'id="dxf"',
            'accept=".dxf',
            'id="clear-dxf"',
            'id="report"',
            "/api/report.pdf",
            "customPayload()",
        ):
            self.assertIn(marker, body)

    def test_favicon(self):
        for path in ("/favicon.svg", "/favicon.ico"):
            status, body = self._get(path)
            self.assertEqual(status, 200, path)
            self.assertIn("<svg", body)

    def test_demo_devuelve_metricas_y_svg(self):
        status, body = self._get("/api/demo?algorithm=guillotine")
        data = json.loads(body)
        self.assertEqual(status, 200)
        self.assertNotIn("error", data)
        self.assertEqual(data["algorithm"], "guillotine")
        self.assertEqual(data["piece_count"], 30)
        self.assertEqual(data["unplaced"], [])
        self.assertGreater(data["yield_percent"], 0)
        self.assertIn("<svg", data["svg"])
        self.assertEqual(data["sheets"][0]["width"], 2500.0)

    def test_demo_agrupa_por_material(self):
        status, body = self._get("/api/demo")
        data = json.loads(body)
        self.assertEqual(status, 200)
        self.assertEqual(len(data["materials"]), 2)
        self.assertEqual(
            sorted(material["material"] for material in data["materials"]),
            [
                "Moscato 2 C 18 mm 771L ARAUCO (2500x1830)",
                "Roble Americano 2 C 18 mm 719L ARAUCO (2500x1830)",
            ],
        )
        self.assertEqual(sum(m["sheets_used"] for m in data["materials"]), data["sheets_used"])
        self.assertEqual(sum(m["piece_count"] for m in data["materials"]), 30)
        labels = {sheet["label"] for sheet in data["sheets"]}
        self.assertEqual(len(labels), 2)

    def test_demo_con_algoritmo_no_guillotina(self):
        status, body = self._get("/api/demo?algorithm=nonguillotine")
        data = json.loads(body)
        self.assertEqual(status, 200)
        self.assertEqual(data["algorithm"], "nonguillotine")
        self.assertEqual(data["piece_count"], 30)

    def test_algoritmo_desconocido(self):
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            self._get("/api/demo?algorithm=nope")
        self.assertEqual(ctx.exception.code, 400)
        payload = json.loads(ctx.exception.read().decode("utf-8"))
        self.assertIn("error", payload)

    def test_ruta_desconocida(self):
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            self._get("/nada")
        self.assertEqual(ctx.exception.code, 404)

    def test_ejemplo_de_csv(self):
        status, body = self._get("/api/example")
        self.assertEqual(status, 200)
        self.assertIn("ancho,alto", json.loads(body)["csv"])

    def test_optimiza_un_csv(self):
        status, data = self._post(
            "/api/optimize", {"csv": "ancho,alto,cantidad\n600,732,2\n300,400\n"}
        )
        self.assertEqual(status, 200)
        self.assertEqual(data["piece_count"], 3)
        self.assertEqual(data["unplaced"], [])
        self.assertIn("<svg", data["svg"])
        self.assertEqual(data["sheet"]["kerf"], 4.0)

    def test_stock_personalizado(self):
        status, data = self._post(
            "/api/optimize",
            {"csv": "ancho,alto\n1000,800\n", "sheet": {"width": 1000, "height": 800, "kerf": 0}},
        )
        self.assertEqual(status, 200)
        self.assertEqual(data["yield_percent"], 100.0)

    def test_varios_stocks_uno_por_material(self):
        status, data = self._post(
            "/api/optimize",
            {
                "csv": "ancho,alto,material\n600,732,Roble\n500,400,Moscato\n",
                "stocks": [
                    {"material": "Roble", "width": 600, "height": 732, "kerf": 0},
                    {"material": "Moscato", "width": 500, "height": 400, "kerf": 0},
                ],
            },
        )
        self.assertEqual(status, 200)
        self.assertEqual([m["material"] for m in data["materials"]], ["Roble", "Moscato"])
        self.assertEqual(data["unplaced"], [])
        self.assertEqual(len(data["stocks"]), 2)
        self.assertEqual(data["sheet"]["material"], "Roble")
        self.assertEqual(data["yield_percent"], 100.0)

    def test_material_sin_stock_queda_sin_ubicar(self):
        status, data = self._post(
            "/api/optimize",
            {
                "csv": "ancho,alto,material\n600,732,Pino\n",
                "stocks": [{"material": "Roble", "width": 2500, "height": 1830}],
            },
        )
        self.assertEqual(status, 200)
        self.assertEqual(len(data["unplaced"]), 1)
        self.assertTrue(any("Pino" in warning for warning in data["warnings"]))

    def test_stocks_invalidos_devuelven_400(self):
        for stocks in ([], "Roble"):
            with self.subTest(stocks=stocks):
                with self.assertRaises(urllib.error.HTTPError) as ctx:
                    self._post("/api/optimize", {"csv": "ancho,alto\n600,732\n", "stocks": stocks})
                self.assertEqual(ctx.exception.code, 400)

    def test_stocks_guardados_por_defecto(self):
        status, body = self._get("/api/stocks")
        data = json.loads(body)
        self.assertEqual(status, 200)
        self.assertEqual(data["stocks"][0]["width"], 2500.0)
        self.assertNotIn("warning", data)

    def test_guarda_y_relee_los_stocks(self):
        stocks = [
            {"material": "Roble", "width": 600, "height": 732, "kerf": 0},
            {"material": "Moscato", "width": 500, "height": 400},
        ]
        try:
            status, saved = self._put("/api/stocks", {"stocks": stocks})
            self.assertEqual(status, 200)
            self.assertEqual(
                [stock["material"] for stock in saved["stocks"]], ["Roble", "Moscato"]
            )
            self.assertTrue(self.stocks_path.exists())

            status, body = self._get("/api/stocks")
            stored = json.loads(body)["stocks"]
            self.assertEqual(stored[1]["height"], 400.0)
        finally:
            self._put("/api/stocks", {"stocks": [DEFAULT_STOCK]})

    def test_stocks_invalidos_al_guardar(self):
        for stocks in ([], [{"width": "ancho"}]):
            with self.subTest(stocks=stocks):
                with self.assertRaises(urllib.error.HTTPError) as ctx:
                    self._put("/api/stocks", {"stocks": stocks})
                self.assertEqual(ctx.exception.code, 400)

    def test_optimiza_un_dxf(self):
        document = dxf_document([lwpolyline(RECT, layer="Roble")])
        status, data = self._post(
            "/api/optimize",
            {
                "dxf": document,
                "stocks": [{"material": "Roble", "width": 600, "height": 732, "kerf": 0}],
            },
        )
        self.assertEqual(status, 200)
        self.assertEqual(data["source"], "dxf")
        self.assertEqual(data["piece_count"], 1)
        self.assertEqual(data["materials"][0]["material"], "Roble")
        self.assertEqual(data["unplaced"], [])

    def test_optimiza_un_dxf_con_bloque(self):
        document = dxf_document(
            [insert("PANEL", layer="Roble")],
            blocks=[block("PANEL", [lwpolyline(RECT, layer="0")])],
        )
        status, data = self._post("/api/optimize", {"dxf": document})
        self.assertEqual(status, 200)
        self.assertEqual(data["piece_count"], 1)
        self.assertEqual(data["materials"][0]["material"], "Roble")

    def test_optimiza_un_xml_de_promob(self):
        xml = Path("tests/fixtures/promob/SID0036A.xml").read_text(encoding="utf-8")
        status, data = self._post("/api/optimize", {"promob": xml})
        self.assertEqual(status, 200)
        self.assertEqual(data["source"], "promob")
        self.assertEqual(data["piece_count"], 1)
        self.assertEqual(data["cut_list"][0]["label"], "Right Side Panel Toe Kick")
        self.assertEqual(data["invalid"], [])
        self.assertTrue(
            any("no es rectangular" in warning for warning in data["warnings"])
        )

    def test_promob_con_mecanizado_fuera_de_la_pieza(self):
        xml = (
            '<PROGRAM PARTDESCRIPTION="mala"><HEADER DX="300" DY="200" />'
            '<CONTENT><HOLE X="5" Y="100" DIAMETER="35" /></CONTENT></PROGRAM>'
        )
        status, data = self._post("/api/optimize", {"promob": xml})
        self.assertEqual(status, 200)
        self.assertEqual(data["invalid"], ["P01"])
        self.assertEqual(data["piece_count"], 0)
        self.assertTrue(any("no se corta" in warning for warning in data["warnings"]))

    def test_dxf_invalido_devuelve_400(self):
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            self._post("/api/optimize", {"dxf": "esto no es un dxf\n"})
        self.assertEqual(ctx.exception.code, 400)

    def test_csv_y_dxf_juntos_devuelven_400(self):
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            self._post(
                "/api/optimize",
                {"csv": "ancho,alto\n600,732\n", "dxf": dxf_document([lwpolyline(RECT)])},
            )
        self.assertEqual(ctx.exception.code, 400)
        error = json.loads(ctx.exception.read().decode("utf-8"))["error"]
        self.assertIn("no en varios", error)

    def test_reporte_pdf(self):
        status, headers, body = self._post_raw(
            "/api/report.pdf", {"csv": "ancho,alto,etiqueta\n600,732,Costado\n"}
        )
        self.assertEqual(status, 200)
        self.assertEqual(headers["Content-Type"], "application/pdf")
        self.assertIn("cutlist-reporte.pdf", headers["Content-Disposition"])
        self.assertTrue(body.startswith(b"%PDF-1.4"))
        self.assertIn(b"Costado", body)
        self.assertIn(b"Tablero 1", body)

    def test_reporte_pdf_de_la_muestra_de_cortecloud(self):
        status, _, body = self._post_raw("/api/report.pdf", {"source": "demo"})
        self.assertEqual(status, 200)
        self.assertIn(b"Tablero 1", body)

    def test_reporte_pdf_con_dxf_y_materiales(self):
        document = dxf_document(
            [
                lwpolyline(RECT, layer="Roble"),
                lwpolyline([(0, 0), (500, 0), (500, 400), (0, 400)], layer="Moscato"),
            ]
        )
        status, _, body = self._post_raw(
            "/api/report.pdf",
            {
                "dxf": document,
                "stocks": [
                    {"material": "Roble", "width": 600, "height": 732, "kerf": 0},
                    {"material": "Moscato", "width": 500, "height": 400, "kerf": 0},
                ],
            },
        )
        self.assertEqual(status, 200)
        self.assertIn(b"Roble", body)
        self.assertIn(b"Moscato", body)

    def test_reporte_pdf_con_algoritmo_desconocido(self):
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            self._post_raw(
                "/api/report.pdf",
                {"csv": "ancho,alto\n600,732\n", "algorithm": "nope"},
            )
        self.assertEqual(ctx.exception.code, 400)

    def test_csv_invalido_devuelve_400(self):
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            self._post("/api/optimize", {"csv": "alto\n732\n"})
        self.assertEqual(ctx.exception.code, 400)
        self.assertIn("ancho", json.loads(ctx.exception.read().decode("utf-8"))["error"])

    def test_algoritmo_desconocido_en_post(self):
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            self._post("/api/optimize", {"csv": "ancho,alto\n600,732\n", "algorithm": "nope"})
        self.assertEqual(ctx.exception.code, 400)

    def test_post_a_ruta_desconocida(self):
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            self._post("/api/otra", {})
        self.assertEqual(ctx.exception.code, 404)

    def _post(self, path, payload):
        request = urllib.request.Request(
            f"http://127.0.0.1:{self.port}{path}",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=15) as response:
            return response.status, json.loads(response.read().decode("utf-8"))

    def _post_raw(self, path, payload):
        request = urllib.request.Request(
            f"http://127.0.0.1:{self.port}{path}",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=15) as response:
            return response.status, dict(response.headers), response.read()

    def _put(self, path, payload):
        request = urllib.request.Request(
            f"http://127.0.0.1:{self.port}{path}",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="PUT",
        )
        with urllib.request.urlopen(request, timeout=15) as response:
            return response.status, json.loads(response.read().decode("utf-8"))


if __name__ == "__main__":
    unittest.main()
