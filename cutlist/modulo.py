"""Módulo paramétrico: medidas e ideas -> lista de piezas con cantos."""

from __future__ import annotations

from dataclasses import dataclass, field

from cutlist.parts import Pieza, resumen, tabla, totales
from cutlist.profiles import (
    PERFIL_CORTECLOUD_MADIJAL,
    Hallazgo,
    PerfilRestricciones,
    resumen_hallazgos,
    validar,
)


@dataclass(frozen=True)
class Accesorio:
    """Herraje o complemento del módulo (no es una pieza de tablero)."""

    nombre: str
    cantidad: int = 1
    nota: str = ""

    def to_dict(self) -> dict:
        return {"nombre": self.nombre, "cantidad": self.cantidad, "nota": self.nota}


@dataclass
class Modulo:
    """Resultado de un generador: piezas, accesorios y notas de armado."""

    tipo: str
    nombre: str
    medidas: dict[str, float]
    piezas: list[Pieza]
    accesorios: list[Accesorio] = field(default_factory=list)
    notas: list[str] = field(default_factory=list)

    def resumen(self) -> list[Pieza]:
        """Líneas agrupadas, listas para el optimizador o el taller."""
        return resumen(self.piezas)

    def totales(self) -> dict:
        return totales(self.resumen())

    def tabla(self) -> str:
        return tabla(self.piezas)

    def validar(
        self, perfil: PerfilRestricciones = PERFIL_CORTECLOUD_MADIJAL
    ) -> list[Hallazgo]:
        return validar(self.resumen(), perfil)

    def to_dict(self) -> dict:
        return {
            "tipo": self.tipo,
            "nombre": self.nombre,
            "medidas": self.medidas,
            "piezas": [pieza.to_dict() for pieza in self.piezas],
            "accesorios": [accesorio.to_dict() for accesorio in self.accesorios],
            "notas": list(self.notas),
            "totales": self.totales(),
        }

    def to_dict_con_perfil(
        self, perfil: PerfilRestricciones = PERFIL_CORTECLOUD_MADIJAL
    ) -> dict:
        datos = self.to_dict()
        datos["piezas"] = [pieza.to_dict() for pieza in self.resumen()]
        datos["perfil"] = perfil.nombre
        datos["hallazgos"] = resumen_hallazgos(self.validar(perfil))
        return datos
