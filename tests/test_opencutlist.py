"""Pruebas del formato SketchUp/OpenCutList (CSV)."""

from __future__ import annotations

import unittest
from pathlib import Path

from cutlist.formats import opencutlist
from cutlist.formats.base import ErrorFormato
from cutlist.model import PARCIAL

FIXTURE = Path(__file__).parent / "fixtures" / "opencutlist" / "parts_opencutlist.csv"


class TestOpenCutList(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.texto = FIXTURE.read_text(encoding="utf-8")

    def test_lee_los_campos_obligatorios_y_opcionales(self):
        lista = opencutlist.importar(self.texto)
        self.assertEqual(len(lista.piezas), 3)
        primera = lista.piezas[0]
        self.assertEqual(primera.nombre, "Pata costado exterior acento der")
        self.assertEqual((primera.largo, primera.ancho, primera.espesor), (732.0, 600.0, 18.0))
        self.assertEqual(primera.cantidad, 1)
        self.assertEqual(primera.etiqueta, "A")
        self.assertTrue(primera.material.startswith("Roble Americano"))

    def test_sin_cantidad_asume_uno(self):
        lista = opencutlist.importar(self.texto)
        cubierta = next(p for p in lista.piezas if p.nombre == "Cubierta izquierda")
        self.assertEqual(cubierta.cantidad, 1)

    def test_exporta_las_columnas_documentadas(self):
        lista = opencutlist.importar(self.texto)
        salida = opencutlist.exportar(lista)
        self.assertEqual(
            salida.splitlines()[0],
            "Designation;Length;Width;Thickness;Quantity;Material;Tags",
        )
        vuelta = opencutlist.importar(salida)
        self.assertEqual([p.nombre for p in vuelta.piezas],
                         [p.nombre for p in lista.piezas])
        self.assertEqual([p.cantidad for p in vuelta.piezas],
                         [p.cantidad for p in lista.piezas])
        self.assertEqual([p.etiqueta for p in vuelta.piezas],
                         [p.etiqueta for p in lista.piezas])

    def test_exporta_sin_etiquetas_cuando_se_pide(self):
        lista = opencutlist.importar(self.texto)
        salida = opencutlist.exportar(lista, incluir_etiquetas=False)
        self.assertEqual(
            salida.splitlines()[0],
            "Designation;Length;Width;Thickness;Quantity;Material",
        )

    def test_lee_otros_separadores_y_encabezados_en_espanol(self):
        texto = "Designación,Longitud,Anchura,Espesor,Cantidad\nCostado,732,564,18,2\n"
        lista = opencutlist.importar(texto, separador=",")
        self.assertEqual(len(lista.piezas), 1)
        self.assertEqual(lista.piezas[0].cantidad, 2)
        self.assertEqual(lista.piezas[0].largo, 732.0)

    def test_rechaza_archivos_sin_los_campos_obligatorios(self):
        with self.assertRaises(ErrorFormato):
            opencutlist.importar("Designation;Length;Width\nCostado;732;564\n")
        with self.assertRaises(ErrorFormato):
            opencutlist.importar("")
        with self.assertRaises(ErrorFormato):
            opencutlist.importar("Designation;Length;Width;Thickness\nCostado;732\n")

    def test_marca_por_revisar_y_cita_las_fuentes(self):
        lista = opencutlist.importar(self.texto)
        mensajes = " ".join(a.mensaje.lower() for a in lista.por_revisar())
        self.assertIn("unidad", mensajes)
        self.assertIn(".skp", mensajes)
        fuentes = " ".join(f.url for f in opencutlist.DESCRIPTOR.fuentes)
        self.assertIn("docs.opencutlist.org", fuentes)
        self.assertEqual(opencutlist.DESCRIPTOR.estado, PARCIAL)


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
