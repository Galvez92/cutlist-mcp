"""Pruebas del registro de formatos y de las utilidades de archivo."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from cutlist import formats
from cutlist.formats.base import ErrorFormato
from cutlist.model import (
    Colocacion,
    Hoja,
    Layout,
    ListaCorte,
    PARCIAL,
    Pieza,
    POR_REVISAR,
    VERIFICADO,
)

FIXTURES = Path(__file__).parent / "fixtures"
CLAVES_ESPERADAS = {
    "cortecloud", "csv_generico", "dxf", "opencutlist", "polyboard", "pro100", "promob",
}


class TestRegistro(unittest.TestCase):
    def test_lista_los_siete_formatos_pedidos(self):
        self.assertEqual(set(formats.claves()), CLAVES_ESPERADAS)
        self.assertEqual({d.clave for d in formats.listar_formatos()}, CLAVES_ESPERADAS)

    def test_cada_formato_declara_estado_y_fuente(self):
        for descriptor in formats.listar_formatos():
            with self.subTest(formato=descriptor.clave):
                self.assertTrue(descriptor.fuentes)
                for fuente in descriptor.fuentes:
                    self.assertTrue(fuente.url)
                    self.assertTrue(fuente.descripcion)
                self.assertIn(descriptor.estado, (VERIFICADO, PARCIAL, POR_REVISAR))
                if descriptor.estado != VERIFICADO:
                    self.assertTrue(
                        descriptor.por_revisar,
                        f"{descriptor.clave} sin nada marcado por revisar",
                    )

    def test_por_revisar_enumera_solo_los_no_verificados(self):
        pendientes = formats.por_revisar()
        self.assertEqual(set(pendientes), {"promob", "pro100"})
        for avisos in pendientes.values():
            self.assertTrue(avisos)
            self.assertTrue(all(a.fuente for a in avisos))

    def test_importar_por_clave_marca_el_origen(self):
        texto = (FIXTURES / "csv_generico" / "piezas_basico.csv").read_text(encoding="utf-8")
        lista = formats.importar(texto, "csv_generico")
        self.assertEqual(lista.origen, "csv_generico")
        self.assertEqual(len(lista.piezas), 5)

    def test_formato_desconocido(self):
        with self.assertRaises(ErrorFormato):
            formats.importar("", "no_existe")
        with self.assertRaises(ErrorFormato):
            formats.exportar(ListaCorte(), "no_existe")
        with self.assertRaises(ErrorFormato):
            formats.descriptor("no_existe")

    def test_los_formatos_de_solo_lectura_no_se_exportan(self):
        lista = ListaCorte(piezas=[Pieza("Pieza", 300, 200)])
        for clave in ("polyboard", "promob", "pro100"):
            with self.subTest(formato=clave):
                with self.assertRaises(ErrorFormato):
                    formats.exportar(lista, clave)

    def test_dxf_solo_se_exporta_desde_un_layout(self):
        hoja = Hoja(nombre="H1", largo=2500, ancho=1830)
        hoja.colocaciones = [
            Colocacion(pieza=Pieza("Pieza", 300, 200), x=0, y=0,
                       largo=300, ancho=200, identificador="P-01")
        ]
        texto = formats.exportar(Layout(hojas=[hoja]), "dxf")
        self.assertIn("POLYLINE", texto)
        with self.assertRaises(ErrorFormato):
            formats.exportar(ListaCorte(piezas=[Pieza("Pieza", 300, 200)]), "dxf")

    def test_importar_archivo_deduce_la_extension(self):
        lista = formats.importar_archivo(FIXTURES / "cortecloud" / "escritorio_D_simple.json")
        self.assertEqual(lista.origen, "cortecloud")
        with self.assertRaises(ErrorFormato):
            formats.importar_archivo(FIXTURES / "README.md")
        self.assertIsNone(formats.formato_para_extension("piezas.xlsx"))

    def test_exportar_archivo_escribe_y_se_puede_releer(self):
        lista = formats.importar_archivo(FIXTURES / "cortecloud" / "escritorio_D_simple.json")
        with tempfile.TemporaryDirectory() as carpeta:
            destino = Path(carpeta) / "piezas.csv"
            formats.exportar_archivo(lista, destino, "csv_generico")
            self.assertTrue(destino.exists())
            vuelta = formats.importar_archivo(destino, "csv_generico")
            self.assertEqual(len(vuelta.piezas), len(lista.piezas))

    def test_exportar_cortecloud_a_json_es_relegible(self):
        lista = formats.importar_archivo(FIXTURES / "cortecloud" / "escritorio_D_simple.json")
        texto = formats.exportar(lista, "cortecloud")
        self.assertEqual(json.loads(texto)["parts"][0]["quantity"],
                         lista.piezas[0].cantidad)


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
