import unittest

from cutlist.models import OptimizationResult, Part, Sheet
from cutlist.optimizer import optimize
from cutlist.pdf import render_pdf


class PdfTest(unittest.TestCase):
    def _result(self):
        return optimize(
            [
                Part(width=600, height=732, quantity=2, label="Costado"),
                Part(width=300, height=200, label="Tapa"),
            ],
            [Sheet(width=2500, height=1830, label="Roble", material="Roble")],
        )

    def test_estructura_pdf(self):
        pdf = render_pdf(self._result(), source="csv", generated="2026-10-29 12:00")
        self.assertTrue(pdf.startswith(b"%PDF-1.4"))
        self.assertTrue(pdf.rstrip().endswith(b"%%EOF"))
        self.assertIn(b"/Type /Catalog", pdf)
        self.assertIn(b"/Type /Pages", pdf)
        self.assertIn(b"/BaseFont /Helvetica", pdf)
        self.assertIn(b"/BaseFont /Courier", pdf)
        self.assertIn(b"/Encoding /WinAnsiEncoding", pdf)

    def test_contenido_del_reporte(self):
        pdf = render_pdf(self._result(), source="csv")
        for text in (
            b"cutlist-mcp",
            b"Resumen",
            b"Aprovechamiento",
            b"Tableros utilizados",
            b"Piezas por tablero",
            b"Medida final",
            b"Costado",
            b"Lista de corte",
        ):
            with self.subTest(text=text):
                self.assertIn(text, pdf)

    def test_medidas_finales_de_cada_pieza(self):
        result = self._result()
        pdf = render_pdf(result)
        for layout in result.layouts:
            for placement in layout.placements:
                expected = (
                    f"({placement.width:g} x {placement.height:g} mm)"
                ).encode("ascii")
                with self.subTest(piece=placement.piece.label):
                    self.assertIn(expected, pdf)

    def test_xref_apunta_a_cada_objeto(self):
        pdf = render_pdf(self._result())
        start = pdf.index(b"xref\n")
        trailer = pdf.index(b"trailer\n")
        lines = pdf[start:trailer].splitlines()
        size = int(lines[1].split()[1])
        entries = lines[2 : 2 + size]
        self.assertEqual(len(entries), size)
        for number in range(1, size):
            offset = int(entries[number].split()[0])
            with self.subTest(object=number):
                self.assertTrue(pdf[offset:].startswith(f"{number} 0 obj".encode()))

    def test_pagina_nueva_cuando_no_cabe(self):
        result = optimize(
            [Part(width=1000, height=1000, quantity=20)],
            [Sheet(width=1000, height=1000, kerf=0)],
        )
        pdf = render_pdf(result)
        self.assertGreaterEqual(pdf.count(b"/Type /Page "), 2)

    def test_resultado_sin_tableros(self):
        pdf = render_pdf(
            OptimizationResult(
                layouts=[], unplaced=[], cut_list=[], warnings=[], algorithm="guillotine"
            )
        )
        self.assertTrue(pdf.startswith(b"%PDF-1.4"))
        self.assertIn("No se usó ningún tablero".encode("cp1252"), pdf)

    def test_acentos_y_simbolos(self):
        result = optimize(
            [Part(width=600, height=732, label="Pieza áéíóú «ñ»")],
            [Sheet(width=2500, height=1830, material="Roble Americano")],
        )
        pdf = render_pdf(result)
        self.assertIn("Pieza áéíóú «ñ»".encode("cp1252"), pdf)


if __name__ == "__main__":
    unittest.main()
