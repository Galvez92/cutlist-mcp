"""Pruebas del formato DXF (exportación de layouts y lectura de contornos)."""

from __future__ import annotations

import unittest
from pathlib import Path

from cutlist.formats import dxf
from cutlist.formats.base import ErrorFormato
from cutlist.model import Colocacion, Hoja, Layout, ListaCorte, PARCIAL, Pieza

FIXTURE = Path(__file__).parent / "fixtures" / "dxf" / "rectangulo_lineas.dxf"


def layout_de_ejemplo() -> Layout:
    hoja = Hoja(nombre="H1", largo=2500, ancho=1830, espesor=18,
                material="Moscato 2 C 18 mm 771L ARAUCO")
    pata = Pieza("Pata costado exterior acento der", 732, 600)
    lateral = Pieza("Lateral cajón", 450, 75, cantidad=4)
    hoja.colocaciones = [
        Colocacion(pieza=pata, x=10, y=10, largo=732, ancho=600, identificador="P-01"),
        Colocacion(pieza=lateral, x=800, y=10, largo=450, ancho=75, identificador="P-02"),
    ]
    return Layout(hojas=[hoja])


class TestExportacionDxf(unittest.TestCase):
    def test_escribe_dxf_r12_con_polilineas(self):
        texto = dxf.exportar(layout_de_ejemplo())
        self.assertIn("AC1009", texto)
        self.assertIn("$INSUNITS", texto)
        self.assertIn("POLYLINE", texto)
        self.assertIn("VERTEX", texto)
        self.assertIn("SEQEND", texto)
        self.assertIn("PIEZAS", texto)
        self.assertIn("P-01", texto)
        self.assertTrue(texto.strip().endswith("EOF"))
        with self.assertRaises(ErrorFormato):
            dxf.exportar(ListaCorte(piezas=[Pieza("X", 100, 100)]))
        with self.assertRaises(ErrorFormato):
            dxf.exportar(Layout())

    def test_ida_y_vuelta_recupera_las_piezas_colocadas(self):
        texto = dxf.exportar(layout_de_ejemplo())
        lista = dxf.importar(texto)
        self.assertEqual([p.nombre for p in lista.piezas], ["P-01", "P-02"])
        self.assertEqual((lista.piezas[0].largo, lista.piezas[0].ancho), (732.0, 600.0))
        self.assertEqual((lista.piezas[1].largo, lista.piezas[1].ancho), (450.0, 75.0))
        self.assertTrue(all(p.grupo == "PIEZAS" for p in lista.piezas))

    def test_las_capas_propias_se_excluyen_salvo_que_se_pida_lo_contrario(self):
        texto = dxf.exportar(layout_de_ejemplo())
        todas = dxf.importar(texto, excluir_capas=())
        self.assertEqual(len(todas.piezas), 3)
        self.assertIn("HOJA", {p.grupo for p in todas.piezas})
        solo_piezas = dxf.importar(texto, solo_capa="PIEZAS")
        self.assertEqual(len(solo_piezas.piezas), 2)

    def test_exporta_sin_etiquetas(self):
        texto = dxf.exportar(layout_de_ejemplo(), incluir_etiquetas=False)
        self.assertNotIn("P-01", texto)
        self.assertEqual(len(dxf.importar(texto).piezas), 2)


class TestLecturaDxf(unittest.TestCase):
    def test_lee_rectangulos_formados_por_line(self):
        lista = dxf.importar(FIXTURE.read_text(encoding="utf-8"))
        self.assertEqual(len(lista.piezas), 2)
        self.assertEqual(lista.piezas[0].nombre, "Costado interior der")
        self.assertEqual((lista.piezas[0].largo, lista.piezas[0].ancho), (500.0, 300.0))
        self.assertEqual(lista.piezas[1].nombre, "contorno 2")
        self.assertEqual((lista.piezas[1].largo, lista.piezas[1].ancho), (200.0, 100.0))
        self.assertTrue(all(p.grupo == "PIEZAS" for p in lista.piezas))

    def test_posicion_se_guarda_en_extra(self):
        pieza = dxf.importar(FIXTURE.read_text(encoding="utf-8")).piezas[1]
        self.assertEqual(pieza.extra, {"x": 600.0, "y": 0.0})

    def test_errores(self):
        with self.assertRaises(ErrorFormato):
            dxf.importar("0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n")
        with self.assertRaises(ErrorFormato):
            dxf.importar("archivo que no es dxf\n")
        with self.assertRaises(ErrorFormato):
            dxf.importar("0\nSECTION\n2\nENTITIES\n0\nLINE\n8x\nPIEZAS\n0\nENDSEC\n0\nEOF\n")

    def test_marca_por_revisar_y_cita_autodesk(self):
        lista = dxf.importar(FIXTURE.read_text(encoding="utf-8"))
        self.assertTrue(lista.por_revisar())
        fuentes = " ".join(f.url for f in dxf.DESCRIPTOR.fuentes)
        self.assertIn("help.autodesk.com", fuentes)
        self.assertEqual(dxf.DESCRIPTOR.estado, PARCIAL)


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
