"""Pruebas del CSV genérico (formato propio) y de las utilidades de tabla."""

from __future__ import annotations

import unittest
from pathlib import Path

from cutlist.formats import csv_generico
from cutlist.formats.base import (
    ErrorFormato,
    a_booleano,
    a_numero,
    detectar_separador,
    mapear_columnas,
)
from cutlist.model import ErrorDato, VERIFICADO

FIXTURE = Path(__file__).parent / "fixtures" / "csv_generico" / "piezas_basico.csv"


class TestUtilidadesDeTabla(unittest.TestCase):
    def test_a_numero_acepta_separadores_y_unidades(self):
        self.assertEqual(a_numero("732"), 732.0)
        self.assertEqual(a_numero("98,5"), 98.5)
        self.assertEqual(a_numero("1.173,5"), 1173.5)
        self.assertEqual(a_numero("1,173.5"), 1173.5)
        self.assertEqual(a_numero("732 mm"), 732.0)
        self.assertEqual(a_numero("1173.5", decimal="."), 1173.5)
        with self.assertRaises(ErrorDato):
            a_numero("")
        with self.assertRaises(ErrorDato):
            a_numero("sin dato")

    def test_a_booleano_es_y_en(self):
        self.assertIs(a_booleano("si"), True)
        self.assertIs(a_booleano("Sí"), True)
        self.assertIs(a_booleano("yes"), True)
        self.assertIs(a_booleano("nao"), False)
        self.assertIs(a_booleano("no"), False)
        self.assertIsNone(a_booleano(""))
        self.assertIsNone(a_booleano("quizás"))

    def test_detectar_separador(self):
        self.assertEqual(detectar_separador("a;b;c\n1;2;3"), ";")
        self.assertEqual(detectar_separador("a,b,c\n1,2,3"), ",")
        self.assertEqual(detectar_separador("a\tb\tc"), "\t")
        self.assertEqual(detectar_separador("a b c"), " ")
        self.assertEqual(detectar_separador(""), ";")
        self.assertEqual(detectar_separador("solo"), ";")

    def test_mapear_columnas_con_alias(self):
        mapa = mapear_columnas(["Designation", "Length", "Width", "Thickness", "Quantity"])
        self.assertEqual(mapa["nombre"], 0)
        self.assertEqual(mapa["largo"], 1)
        self.assertEqual(mapa["ancho"], 2)
        self.assertEqual(mapa["espesor"], 3)
        self.assertEqual(mapa["cantidad"], 4)
        self.assertEqual(mapear_columnas(["columna rara"]), {})


class TestCsvGenerico(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.texto = FIXTURE.read_text(encoding="utf-8")

    def test_lee_las_piezas_del_fixture(self):
        lista = csv_generico.importar(self.texto)
        self.assertEqual(len(lista.piezas), 5)
        self.assertEqual(lista.total_piezas, 1 + 1 + 2 + 1 + 4)
        primera = lista.piezas[0]
        self.assertEqual(primera.nombre, "Pata costado exterior acento der")
        self.assertEqual((primera.largo, primera.ancho), (732.0, 600.0))
        self.assertEqual(primera.espesor, 18.0)
        self.assertIs(primera.veta, True)
        self.assertEqual(primera.grupo, "D01")
        self.assertEqual(primera.etiqueta, "A")
        self.assertEqual(primera.notas, "doble 36")
        self.assertTrue(primera.cantos["c1"].startswith("PVC 719L"))
        self.assertNotIn("c2", primera.cantos)

    def test_lee_decimal_coma_y_campos_vacios(self):
        lista = csv_generico.importar(self.texto)
        cubierta = next(p for p in lista.piezas if p.nombre.startswith("Cubierta"))
        self.assertEqual(cubierta.ancho, 98.5)
        self.assertIsNone(cubierta.espesor)
        self.assertIsNone(cubierta.veta)
        lateral = next(p for p in lista.piezas if p.nombre == "Lateral cajón")
        self.assertEqual(lateral.cantidad, 4)
        self.assertIs(lateral.veta, False)

    def test_ida_y_vuelta_conserva_los_datos(self):
        original = csv_generico.importar(self.texto)
        salida = csv_generico.exportar(original)
        vuelta = csv_generico.importar(salida)
        self.assertEqual(len(vuelta.piezas), len(original.piezas))
        for antes, despues in zip(original.piezas, vuelta.piezas):
            self.assertEqual(antes.nombre, despues.nombre)
            self.assertEqual((antes.largo, antes.ancho), (despues.largo, despues.ancho))
            self.assertEqual(antes.cantidad, despues.cantidad)
            self.assertEqual(antes.espesor, despues.espesor)
            self.assertEqual(antes.material, despues.material)
            self.assertEqual(antes.veta, despues.veta)
            self.assertEqual(antes.grupo, despues.grupo)
            self.assertEqual(antes.cantos, despues.cantos)

    def test_exporta_con_separador_coma_y_decimal_punto(self):
        lista = csv_generico.importar(self.texto)
        salida = csv_generico.exportar(lista, separador=",", decimal=".")
        self.assertTrue(salida.startswith("nombre,largo,ancho,"))
        self.assertIn("98.5", salida)
        vuelta = csv_generico.importar(salida, separador=",", decimal=".")
        self.assertEqual(vuelta.piezas[3].ancho, 98.5)

    def test_exporta_encabezado_con_unidad_opcional(self):
        lista = csv_generico.importar(self.texto)
        salida = csv_generico.exportar(lista)
        self.assertTrue(salida.splitlines()[0].startswith("nombre;largo;ancho;cantidad"))
        con_unidad = csv_generico.exportar(lista, unidad=True)
        self.assertIn("largo_mm;ancho_mm", con_unidad.splitlines()[0])
        vuelta = csv_generico.importar(con_unidad)
        self.assertEqual(len(vuelta.piezas), len(lista.piezas))
        self.assertEqual((vuelta.piezas[0].largo, vuelta.piezas[0].ancho), (732.0, 600.0))

    def test_rechaza_archivos_sin_encabezado_o_columnas_obligatorias(self):
        with self.assertRaises(ErrorFormato):
            csv_generico.importar("")
        with self.assertRaises(ErrorFormato):
            csv_generico.importar("732;600\n1;2", encabezado=False)
        with self.assertRaises(ErrorFormato):
            csv_generico.importar("nombre;largo\nPieza;732")
        with self.assertRaises(ErrorFormato):
            csv_generico.importar("nombre;largo;ancho\nPieza;732;sin dato")

    def test_descriptor_es_verificado(self):
        self.assertEqual(csv_generico.DESCRIPTOR.estado, VERIFICADO)
        self.assertEqual(csv_generico.DESCRIPTOR.por_revisar, ())


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
