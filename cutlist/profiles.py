"""Perfiles de restricciones opcionales de máquina/proveedor.

Un perfil es un conjunto de límites **de un proveedor o taller concreto**, no
una regla del motor. Se aplica solo si se pide: `validar(piezas, perfil)`.

Perfil `cortecloud_madijal`: transcrito de `docs/memoria/MEMORIA.md`
(«Perfil de restricciones de ejemplo (opcional): Cortecloud/Madijal»), que a su
vez describe restricciones observadas en uso real. Es el único perfil cargado;
los valores son del enunciado de la MEMORIA, no de un manual público, así que
cualquier ajuste posterior debe volver a esa ficha.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from cutlist.parts import Pieza

#: 3/8" = 9.525 mm: la MEMORIA enuncia los barrenos horizontales en pulgadas.
PULGADA_3_8 = 9.525


@dataclass(frozen=True)
class PerfilRestricciones:
    """Límites de corte, mecanizado y tablero de un proveedor concreto."""

    nombre: str
    fuente: str
    #: Pieza mínima medida de corte (mm), excluyendo el canto.
    pieza_min_corte: float
    #: Medida recomendada por sobre el mínimo (mm).
    pieza_min_recomendada: float
    #: Medida terminada mínima con canto en ambos lados (mm).
    pieza_min_terminada: float
    #: Espesor de referencia del canto usado en `pieza_min_terminada` (mm).
    canto_espesor: float
    #: Largo mínimo de una pieza mecanizada (mm).
    pieza_mecanizada_min_largo: float
    pieza_max_largo: float
    pieza_max_ancho: float
    tablero_largo: float
    tablero_ancho: float
    tablero_espesor: float
    #: Anchos de ranura (canal) que la máquina puede ejecutar (mm).
    ranuras_permitidas: tuple[float, ...]
    #: Diámetros de barreno en el canto (mm).
    barrenos_horizontales: tuple[float, ...]
    #: Diámetros de barreno en la cara (mm).
    barrenos_verticales: tuple[float, ...]
    #: Luz máxima entre apoyos de una repisa antes de avisar (mm). `None` = sin
    #: aviso: *por revisar*, no hay fuente verificada para un valor de carga.
    luz_max_repisa_aviso: float | None = None

    def nombre_de(self) -> str:
        return self.nombre


PERFIL_CORTECLOUD_MADIJAL = PerfilRestricciones(
    nombre="cortecloud_madijal",
    fuente="docs/memoria/MEMORIA.md (perfil de restricciones de ejemplo)",
    pieza_min_corte=65.0,
    pieza_min_recomendada=70.0,
    pieza_min_terminada=66.0,
    canto_espesor=0.4,
    pieza_mecanizada_min_largo=250.0,
    pieza_max_largo=2480.0,
    pieza_max_ancho=1810.0,
    tablero_largo=2500.0,
    tablero_ancho=1830.0,
    tablero_espesor=18.0,
    ranuras_permitidas=(5.7, 6.2, 6.7, 7.0, 9.7, 12.7, 15.7, 18.7, 25.7),
    barrenos_horizontales=(PULGADA_3_8,),
    barrenos_verticales=(3.0, 5.0, 8.0, 10.0, 15.0, 20.0, 35.0),
)

PERFILES = {PERFIL_CORTECLOUD_MADIJAL.nombre: PERFIL_CORTECLOUD_MADIJAL}

NIVEL_ERROR = "error"
NIVEL_AVISO = "aviso"


@dataclass(frozen=True)
class Hallazgo:
    """Resultado de aplicar una regla del perfil a una pieza."""

    pieza: str
    nivel: str
    regla: str
    mensaje: str

    def to_dict(self) -> dict:
        return {
            "pieza": self.pieza,
            "nivel": self.nivel,
            "regla": self.regla,
            "mensaje": self.mensaje,
        }


def _error(pieza: Pieza, regla: str, mensaje: str) -> Hallazgo:
    return Hallazgo(pieza.nombre, NIVEL_ERROR, regla, mensaje)


def _aviso(pieza: Pieza, regla: str, mensaje: str) -> Hallazgo:
    return Hallazgo(pieza.nombre, NIVEL_AVISO, regla, mensaje)


def _cabe(largo: float, ancho: float, limite_largo: float, limite_ancho: float) -> bool:
    """¿Cabe en un rectángulo, permitiendo girar la pieza 90°?"""
    return (largo <= limite_largo and ancho <= limite_ancho) or (
        ancho <= limite_largo and largo <= limite_ancho
    )


def validar_pieza(pieza: Pieza, perfil: PerfilRestricciones) -> list[Hallazgo]:
    """Aplica todas las reglas del perfil a una pieza."""
    hallazgos: list[Hallazgo] = []

    if pieza.largo <= 0 or pieza.ancho <= 0:
        hallazgos.append(
            _error(pieza, "dimension_invalida", "largo y ancho deben ser mayores que cero")
        )
        return hallazgos

    corte_menor = min(pieza.largo, pieza.ancho)
    if corte_menor < perfil.pieza_min_corte:
        hallazgos.append(
            _error(
                pieza,
                "pieza_minima",
                f"medida de corte {corte_menor:.1f} mm bajo el mínimo "
                f"{perfil.pieza_min_corte:.0f} mm del perfil {perfil.nombre}",
            )
        )
    elif corte_menor < perfil.pieza_min_recomendada:
        hallazgos.append(
            _aviso(
                pieza,
                "pieza_minima_recomendada",
                f"medida de corte {corte_menor:.1f} mm sobre el mínimo pero bajo el "
                f"recomendado {perfil.pieza_min_recomendada:.0f} mm",
            )
        )

    # La medida terminada mínima solo tiene sentido en piezas con canto: una pieza
    # sin canto ya está a su medida final.
    largo_terminado, ancho_terminado = pieza.medidas_terminadas()
    terminada_menor = min(largo_terminado, ancho_terminado)
    if not pieza.cantos.vacio() and terminada_menor < perfil.pieza_min_terminada:
        hallazgos.append(
            _aviso(
                pieza,
                "pieza_terminada_ajustada",
                f"medida terminada {terminada_menor:.1f} mm (canto "
                f"{pieza.canto_espesor} mm) bajo la terminada mínima "
                f"{perfil.pieza_min_terminada:.0f} mm",
            )
        )

    if not _cabe(pieza.largo, pieza.ancho, perfil.pieza_max_largo, perfil.pieza_max_ancho):
        hallazgos.append(
            _error(
                pieza,
                "pieza_maxima",
                f"{pieza.largo:.1f} x {pieza.ancho:.1f} mm excede la pieza máxima "
                f"{perfil.pieza_max_largo:.0f} x {perfil.pieza_max_ancho:.0f} mm",
            )
        )
    elif not _cabe(pieza.largo, pieza.ancho, perfil.tablero_largo, perfil.tablero_ancho):
        hallazgos.append(
            _aviso(
                pieza,
                "no_cabe_en_tablero",
                f"{pieza.largo:.1f} x {pieza.ancho:.1f} mm no cabe en el tablero "
                f"{perfil.tablero_largo:.0f} x {perfil.tablero_ancho:.0f} mm",
            )
        )

    if not pieza.mecanizado.vacio():
        if pieza.largo < perfil.pieza_mecanizada_min_largo:
            hallazgos.append(
                _error(
                    pieza,
                    "pieza_mecanizada_corta",
                    f"pieza mecanizada de largo {pieza.largo:.1f} mm bajo el mínimo "
                    f"{perfil.pieza_mecanizada_min_largo:.0f} mm",
                )
            )
        for ranura in pieza.mecanizado.ranuras:
            if ranura.ancho not in perfil.ranuras_permitidas:
                hallazgos.append(
                    _error(
                        pieza,
                        "ranura_no_permitida",
                        f"ranura de {ranura.ancho} mm fuera de las permitidas "
                        f"{perfil.ranuras_permitidas}",
                    )
                )
        for barreno in pieza.mecanizado.barrenos:
            permitidos = (
                perfil.barrenos_horizontales
                if barreno.horizontal
                else perfil.barrenos_verticales
            )
            if barreno.diametro not in permitidos:
                tipo = "horizontal" if barreno.horizontal else "vertical"
                hallazgos.append(
                    _error(
                        pieza,
                        "barreno_no_permitido",
                        f"barreno {tipo} de Ø{barreno.diametro} mm fuera de los "
                        f"permitidos {permitidos}",
                    )
                )

    if perfil.luz_max_repisa_aviso is not None and pieza.rol == "repisa":
        if pieza.ancho > perfil.luz_max_repisa_aviso:
            hallazgos.append(
                _aviso(
                    pieza,
                    "luz_repisa",
                    f"repisa de {pieza.ancho:.1f} mm de luz supera el aviso de "
                    f"{perfil.luz_max_repisa_aviso:.0f} mm",
                )
            )

    return hallazgos


def validar(
    piezas: Iterable[Pieza], perfil: PerfilRestricciones = PERFIL_CORTECLOUD_MADIJAL
) -> list[Hallazgo]:
    """Aplica el perfil a una lista de piezas (una línea por hallazgo)."""
    hallazgos: list[Hallazgo] = []
    for pieza in piezas:
        hallazgos.extend(validar_pieza(pieza, perfil))
    return hallazgos


def errores(hallazgos: Iterable[Hallazgo]) -> list[Hallazgo]:
    return [h for h in hallazgos if h.nivel == NIVEL_ERROR]


def avisos(hallazgos: Iterable[Hallazgo]) -> list[Hallazgo]:
    return [h for h in hallazgos if h.nivel == NIVEL_AVISO]


def resumen_hallazgos(hallazgos: Iterable[Hallazgo]) -> dict:
    lista = list(hallazgos)
    return {
        "errores": len(errores(lista)),
        "avisos": len(avisos(lista)),
        "detalle": [h.to_dict() for h in lista],
    }
