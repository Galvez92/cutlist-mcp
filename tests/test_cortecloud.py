"""Pruebas del formato Cortecloud (JSON de piezas)."""

from __future__ import annotations

import json
import unittest
from pathlib import Path

from cutlist.formats import cortecloud
from cutlist.formats.base import ErrorFormato
from cutlist.model import PARCIAL

FIXTURE = Path(__file__).parent / "fixtures" / "cortecloud" / "escritorio_D_simple.json"


class TestImportacionCortecloud(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.texto = FIXTURE.read_text(encoding="utf-8")
        cls.bruto = json.loads(cls.texto)

    def test_lee_todas_las_piezas_del_fixture_real(self):
        lista = cortecloud.importar(self.texto)
        self.assertEqual(len(lista.piezas), len(self.bruto["parts"]))
        self.assertEqual(
            lista.total_piezas,
            sum(int(parte["quantity"]) for parte in self.bruto["parts"]),
        )

    def test_mapea_los_campos_documentados(self):
        lista = cortecloud.importar(self.texto)
        pieza = lista.piezas[0]
        esperado = self.bruto["parts"][0]
        self.assertEqual(pieza.largo, esperado["c"])
        self.assertEqual(pieza.ancho, esperado["l"])
        self.assertEqual(pieza.cantidad, esperado["quantity"])
        self.assertEqual(pieza.nombre, esperado["function"])
        self.assertEqual(pieza.grupo, esperado["complement"])
        self.assertEqual(pieza.material, esperado["material"])
        self.assertEqual(pieza.cantos["c1"], esperado["c1"])
        self.assertEqual(pieza.cantos["l1"], esperado["l1"])
        self.assertNotIn("c2", pieza.cantos)

    def test_conserva_el_bloque_machining_tal_cual(self):
        lista = cortecloud.importar(self.texto)
        con_usinaje = [p for p in lista.piezas if p.extra.get("machining")]
        self.assertTrue(con_usinaje, "el fixture real tiene piezas con machining")
        usinaje = con_usinaje[0].extra["machining"]
        self.assertEqual(usinaje["verticalDrills"][0]["diameter"], 35)
        self.assertIn("furrowMachining", usinaje)

    def test_marca_por_revisar_con_fuente(self):
        lista = cortecloud.importar(self.texto)
        avisos = lista.por_revisar()
        self.assertTrue(avisos)
        for aviso in avisos:
            self.assertTrue(aviso.fuente and aviso.fuente.startswith("http"))
        mensajes = " ".join(a.mensaje.lower() for a in avisos)
        self.assertIn("unidad", mensajes)

    def test_ida_y_vuelta_es_fiel_al_fixture(self):
        lista = cortecloud.importar(self.texto)
        salida = cortecloud.exportar(lista)
        self.assertEqual(json.loads(salida), self.bruto)

    def test_rechaza_json_invalido_y_piezas_incompletas(self):
        with self.assertRaises(ErrorFormato):
            cortecloud.importar("{ no es json")
        with self.assertRaises(ErrorFormato):
            cortecloud.importar(json.dumps({"piezas": []}))
        with self.assertRaises(ErrorFormato):
            cortecloud.importar(json.dumps({"parts": [{"quantity": 1, "l": 500}]}))
        with self.assertRaises(ErrorFormato):
            cortecloud.importar(json.dumps({"parts": [{"quantity": 1, "c": 0, "l": 500}]}))
        with self.assertRaises(ErrorFormato):
            cortecloud.importar(json.dumps({"parts": ["no es objeto"]}))

    def test_exporta_sin_avisos_cuando_la_lista_es_nueva(self):
        lista = cortecloud.importar(self.texto)
        salida = json.loads(cortecloud.exportar(lista, sangria=0))
        self.assertEqual(set(salida), {"parts"})
        self.assertEqual(salida["parts"][0]["c1"], self.bruto["parts"][0]["c1"])

    def test_descriptor_declara_estado_y_fuentes(self):
        self.assertEqual(cortecloud.DESCRIPTOR.estado, PARCIAL)
        self.assertEqual(cortecloud.DESCRIPTOR.clave, "cortecloud")
        self.assertTrue(any("cortecloud.com" in f.url for f in cortecloud.DESCRIPTOR.fuentes))
        self.assertTrue(cortecloud.DESCRIPTOR.por_revisar)


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
