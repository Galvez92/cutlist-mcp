import json
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

import server


class ServerTest(unittest.TestCase):
    """Recorre las rutas reales del servidor de vista previa."""

    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.port = cls.httpd.server_address[1]
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

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


if __name__ == "__main__":
    unittest.main()
