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
        self.assertIn("algorithm", body)

    def test_demo_devuelve_metricas_y_svg(self):
        status, body = self._get("/api/demo?algorithm=guillotine")
        data = json.loads(body)
        self.assertEqual(status, 200)
        self.assertNotIn("error", data)
        self.assertEqual(data["algorithm"], "guillotine")
        self.assertEqual(data["piece_count"], 30)
        self.assertGreater(data["yield_percent"], 0)
        self.assertIn("<svg", data["svg"])
        self.assertEqual(data["sheets"][0]["width"], 2500.0)

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


if __name__ == "__main__":
    unittest.main()
