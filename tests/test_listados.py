"""Pruebas de los listados con columnas declaradas: PolyBoard, Promob y PRO100."""

from __future__ import annotations

import unittest
from pathlib import Path

from cutlist.formats import polyboard, pro100, promob
from cutlist.formats.base import ErrorFormato
from cutlist.model import PARCIAL, POR_REVISAR

FIXTURES = Path(__file__).parent / "fixtures"


def leer(ruta: str) -> str:
    return (FIXTURES / ruta).read_text(encoding="utf-8")


class TestPolyboard(unittest.TestCase):
    def test_lee_con_las_columnas_por_defecto_y_avisa(self):
        lista = polyboard.importar(leer("polyboard/lista_corte.csv"))
        self.assertEqual(len(lista.piezas), 3)
        self.assertEqual(lista.total_piezas, 6)
        primera = lista.piezas[0]
        self.assertEqual(primera.nombre, "Pata costado exterior acento der")
        self.assertEqual((primera.largo, primera.ancho), (732.0, 600.0))
        self.assertEqual(primera.espesor, 18.0)
        self.assertEqual(lista.piezas[2].cantidad, 4)
        mensajes = " ".join(a.mensaje.lower() for a in lista.por_revisar())
        self.assertIn("columnas declaradas", mensajes)

    def test_lee_con_columnas_declaradas_por_el_usuario(self):
        texto = "732;600;Pata costado;2\n"
        lista = polyboard.importar(
            texto, columnas=("largo", "ancho", "nombre", "cantidad")
        )
        self.assertEqual(lista.piezas[0].nombre, "Pata costado")
        self.assertEqual(lista.piezas[0].cantidad, 2)
        self.assertFalse(
            [a for a in lista.por_revisar() if "declaradas por defecto" in a.mensaje]
        )

    def test_lee_con_encabezado_real(self):
        texto = "Nombre;Largo;Ancho;Espesor\nEstante;300;200;18\n"
        lista = polyboard.importar(texto, encabezado=True)
        self.assertEqual(lista.piezas[0].nombre, "Estante")
        self.assertEqual(lista.piezas[0].largo, 300.0)
        self.assertEqual(lista.piezas[0].espesor, 18.0)

    def test_las_columnas_desconocidas_no_desalinean_los_datos(self):
        texto = "Nombre;Rareza;Largo;Ancho\nEstante;xx;300;200\n"
        lista = polyboard.importar(texto, encabezado=True)
        self.assertEqual(lista.piezas[0].nombre, "Estante")
        self.assertEqual((lista.piezas[0].largo, lista.piezas[0].ancho), (300.0, 200.0))

    def test_errores_de_columnas_y_de_datos(self):
        with self.assertRaises(ErrorFormato):
            polyboard.importar("1;2;3", columnas=("largo", "ancho", "espesor"))
        with self.assertRaises(ErrorFormato):
            polyboard.importar("Pieza;sin dato;600")
        with self.assertRaises(ErrorFormato):
            polyboard.importar("")

    def test_descriptor_de_solo_lectura(self):
        self.assertEqual(polyboard.DESCRIPTOR.estado, PARCIAL)
        self.assertTrue(polyboard.DESCRIPTOR.permite_importar)
        self.assertFalse(polyboard.DESCRIPTOR.permite_exportar)
        self.assertFalse(hasattr(polyboard, "exportar"))
        fuentes = " ".join(f.url for f in polyboard.DESCRIPTOR.fuentes)
        self.assertIn("wooddesigner.org", fuentes)


class TestPromob(unittest.TestCase):
    def test_lee_con_las_columnas_por_defecto_y_avisa(self):
        lista = promob.importar(leer("promob/listagem.txt"))
        self.assertEqual(len(lista.piezas), 3)
        primera = lista.piezas[0]
        self.assertEqual(primera.nombre, "Costado interior izq")
        self.assertEqual((primera.largo, primera.ancho, primera.espesor),
                         (732.0, 564.0, 18.0))
        self.assertEqual(primera.grupo, "D02")
        self.assertIs(primera.veta, True)
        self.assertTrue(primera.cantos["c1"].startswith("PVC 771L"))
        self.assertIs(lista.piezas[1].veta, False)
        self.assertEqual(lista.piezas[2].cantidad, 2)
        self.assertTrue(any("por optimizador" in a.mensaje for a in lista.por_revisar()))

    def test_lee_con_columnas_declaradas(self):
        texto = "732;564;Costado interior izq\n"
        lista = promob.importar(texto, columnas=("largo", "ancho", "nombre"))
        self.assertEqual(lista.piezas[0].nombre, "Costado interior izq")
        self.assertFalse(
            [a for a in lista.por_revisar() if "declaradas por defecto" in a.mensaje]
        )

    def test_lee_con_encabezado_y_separador_coma(self):
        texto = "Nome,Quantidade,Comprimento,Largura\nCostado,2,732,564\n"
        lista = promob.importar(texto, encabezado=True)
        self.assertEqual(lista.piezas[0].cantidad, 2)
        self.assertEqual(lista.piezas[0].largo, 732.0)

    def test_errores(self):
        with self.assertRaises(ErrorFormato):
            promob.importar("")
        with self.assertRaises(ErrorFormato):
            promob.importar("Costado;no es numero;564")

    def test_descriptor_por_revisar_con_fuentes(self):
        self.assertEqual(promob.DESCRIPTOR.estado, POR_REVISAR)
        self.assertTrue(promob.DESCRIPTOR.por_revisar)
        self.assertFalse(promob.DESCRIPTOR.permite_exportar)
        fuentes = " ".join(f.url for f in promob.DESCRIPTOR.fuentes)
        self.assertIn("suporte.promob.com", fuentes)
        self.assertIn("cutplanning", fuentes)


class TestPro100(unittest.TestCase):
    def test_lee_el_listado_con_tabuladores(self):
        lista = pro100.importar(leer("pro100/listado_detalles.txt"))
        self.assertEqual(len(lista.piezas), 4)
        self.assertEqual(lista.piezas[0].nombre, "Pata costado exterior acento der")
        self.assertEqual((lista.piezas[0].largo, lista.piezas[0].ancho), (732.0, 600.0))
        self.assertEqual(lista.piezas[0].espesor, 18.0)
        self.assertEqual(lista.piezas[2].cantidad, 4)
        self.assertTrue(any("no publicado" in a.mensaje for a in lista.por_revisar()))

    def test_lee_con_columnas_declaradas(self):
        texto = "Estante;300;200\n"
        lista = pro100.importar(texto, columnas=("nombre", "ancho", "largo"))
        self.assertEqual((lista.piezas[0].largo, lista.piezas[0].ancho), (200.0, 300.0))

    def test_errores(self):
        with self.assertRaises(ErrorFormato):
            pro100.importar("")
        with self.assertRaises(ErrorFormato):
            pro100.importar("Estante;1;sin dato;200;18")

    def test_descriptor_por_revisar_con_fuentes(self):
        self.assertEqual(pro100.DESCRIPTOR.estado, POR_REVISAR)
        fuentes = " ".join(f.url for f in pro100.DESCRIPTOR.fuentes)
        self.assertIn("cutlistplus.com", fuentes)
        self.assertIn("sovetpro100", fuentes)
        self.assertFalse(pro100.DESCRIPTOR.permite_exportar)


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
