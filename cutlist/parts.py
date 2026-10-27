"""Piezas, cantos, veta y mecanizado: modelo base de la lista de corte.

Convención de medidas (mm)
--------------------------
Cada pieza se define con dos medidas y usa el vocabulario registrado en
`docs/memoria/MEMORIA.md` para el despiece de Cortecloud: ``largo`` (campo `c`
del fixture) y ``ancho`` (campo `l` del fixture). Igual que en ese despiece, la
pieza se dibuja con el ``largo`` en vertical::

        ancho_a  (arista de longitud = ancho)
      +-------------------+
      |                   |
 largo_a               largo_b     <- aristas de longitud = largo
      |                   |
      +-------------------+
        ancho_b  (arista de longitud = ancho)

Los cuatro nombres de arista (``largo_a``, ``largo_b``, ``ancho_a``,
``ancho_b``) son **geométricos**: no dicen si la arista queda al frente, arriba
o abajo en el mueble armado. Esa lectura va en ``funcion`` (texto libre) porque
depende de cómo se monta la pieza.

*Por revisar*: la equivalencia entre estas aristas geométricas y los campos
``c1``/``c2``/``l1``/``l2`` del formato de Cortecloud no está verificada. El
fixture real `tests/fixtures/cortecloud/escritorio_D_simple.json` trae
«Lateral cajón» con ``c=450``, ``l=75``, ``l1`` con canto y ``c1``/``c2`` en
``null``, y «Frente cajón» con los cuatro cantos, que es la muestra para
resolverlo. Mientras no se verifique, cualquier exportación debe marcar ese
mapeo como `por revisar` (ver `docs/modulos-parametricos.md`).

El canto se guarda como el texto del material del canto (igual que en
Cortecloud) o ``None`` si la arista no lleva canto.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from typing import Iterable

#: Aristas de una pieza: dos de longitud `largo` y dos de longitud `ancho`.
LADOS = ("largo_a", "largo_b", "ancho_a", "ancho_b")

#: Dirección de la veta aceptada por el motor de optimización.
VETAS = ("largo", "ancho", "indiferente")

ESPESOR_DEFAULT = 18.0
CANTO_ESPESOR_DEFAULT = 0.4


@dataclass(frozen=True)
class Cantos:
    """Canto por arista. El valor es el texto del material de canto o ``None``."""

    largo_a: str | None = None
    largo_b: str | None = None
    ancho_a: str | None = None
    ancho_b: str | None = None

    def aristas(self) -> tuple[str, ...]:
        """Nombres de las aristas que llevan canto, en orden."""
        return tuple(lado for lado in LADOS if getattr(self, lado))

    def por_arista(self) -> dict[str, str]:
        """Solo las aristas con canto: ``{"largo_a": "PVC 0.4 mm"}``."""
        return {lado: getattr(self, lado) for lado in LADOS if getattr(self, lado)}

    def cantidad(self) -> int:
        return len(self.aristas())

    def vacio(self) -> bool:
        return self.cantidad() == 0

    def con(self, **cambios: str | None) -> "Cantos":
        """Copia con algunas aristas cambiadas (valida los nombres)."""
        desconocidos = sorted(set(cambios) - set(LADOS))
        if desconocidos:
            raise ValueError(f"aristas desconocidas: {desconocidos}; use {LADOS}")
        return replace(self, **cambios)

    def todas(self, material: str) -> "Cantos":
        """Copia con canto en las cuatro aristas."""
        return Cantos(material, material, material, material)


@dataclass(frozen=True)
class Ranura:
    """Ranura (canal) para insertar un panel, en mm.

    Los nombres de campo siguen el mecanizado del fixture Cortecloud
    (``furrowMachining``: ``face``, ``depth``, ``width``, ``distance``).
    """

    cara: str = "i"
    profundidad: float = 0.0
    ancho: float = 0.0
    distancia: float = 0.0


@dataclass(frozen=True)
class Barreno:
    """Perforación, en mm. ``horizontal`` = barreno en el canto (horizontalDrills)."""

    cara: str = "i"
    x: float = 0.0
    y: float = 0.0
    profundidad: float = 0.0
    diametro: float = 0.0
    horizontal: bool = False


@dataclass(frozen=True)
class Mecanizado:
    """Mecanizado de una pieza: ranuras y barrenos."""

    ranuras: tuple[Ranura, ...] = ()
    barrenos: tuple[Barreno, ...] = ()

    def vacio(self) -> bool:
        return not self.ranuras and not self.barrenos


@dataclass(frozen=True)
class Pieza:
    """Una línea de la lista de corte.

    ``rol`` es una etiqueta corta y estable para las reglas de validación
    (``costado``, ``repisa``, ``puerta``, ``frente``, ...) y para el motor de
    optimización; ``funcion`` es el texto que lee el taller.
    """

    nombre: str
    largo: float
    ancho: float
    cantidad: int = 1
    espesor: float = ESPESOR_DEFAULT
    material: str = ""
    rol: str = ""
    veta: str = "largo"
    canto_espesor: float = CANTO_ESPESOR_DEFAULT
    cantos: Cantos = field(default_factory=Cantos)
    mecanizado: Mecanizado = field(default_factory=Mecanizado)
    funcion: str = ""
    modulo: str = ""

    def __post_init__(self) -> None:
        if self.veta not in VETAS:
            raise ValueError(f"veta inválida: {self.veta!r}; use {VETAS}")
        if self.cantidad < 0:
            raise ValueError("la cantidad no puede ser negativa")

    @property
    def area_mm2(self) -> float:
        return self.largo * self.ancho

    def medidas_terminadas(self) -> tuple[float, float]:
        """``(largo, ancho)`` terminados: suma el canto de las aristas opuestas.

        El canto de una arista de longitud ``largo`` engrosa la medida
        ``ancho`` de la pieza (y al revés).
        """
        largo = self.largo + (self.canto_espesor if self.cantos.ancho_a else 0.0)
        largo += self.canto_espesor if self.cantos.ancho_b else 0.0
        ancho = self.ancho + (self.canto_espesor if self.cantos.largo_a else 0.0)
        ancho += self.canto_espesor if self.cantos.largo_b else 0.0
        return (largo, ancho)

    def con(self, **cambios) -> "Pieza":
        """Copia con algunos campos cambiados."""
        return replace(self, **cambios)

    def to_dict(self) -> dict:
        largo_terminado, ancho_terminado = self.medidas_terminadas()
        datos = {
            "nombre": self.nombre,
            "rol": self.rol,
            "largo": self.largo,
            "ancho": self.ancho,
            "cantidad": self.cantidad,
            "espesor": self.espesor,
            "material": self.material,
            "veta": self.veta,
            "cantos": self.cantos.por_arista(),
            "canto_espesor": self.canto_espesor,
            "largo_terminado": largo_terminado,
            "ancho_terminado": ancho_terminado,
            "funcion": self.funcion,
            "modulo": self.modulo,
        }
        if not self.mecanizado.vacio():
            datos["mecanizado"] = {
                "ranuras": [vars(r) for r in self.mecanizado.ranuras],
                "barrenos": [vars(b) for b in self.mecanizado.barrenos],
            }
        return datos


# Toda la pieza (o el mecanizado) es inmutable y hashable: sirve como clave de
# agrupación de líneas idénticas.
CLAVE_AGRUPACION = (
    lambda p: (  # noqa: E731 - expresión corta y local
        p.nombre,
        p.largo,
        p.ancho,
        p.espesor,
        p.material,
        p.rol,
        p.veta,
        p.cantos,
        p.mecanizado,
    )
)


def resumen(piezas: Iterable[Pieza]) -> list[Pieza]:
    """Agrupa líneas idénticas y suma cantidades (como hacen los despieces)."""
    orden: list[tuple] = []
    agrupadas: dict[tuple, Pieza] = {}
    for pieza in piezas:
        clave = CLAVE_AGRUPACION(pieza)
        if clave in agrupadas:
            previa = agrupadas[clave]
            agrupadas[clave] = previa.con(cantidad=previa.cantidad + pieza.cantidad)
        else:
            agrupadas[clave] = pieza
            orden.append(clave)
    return [agrupadas[clave] for clave in orden]


def totales(piezas: Iterable[Pieza]) -> dict:
    """Totales de una lista de piezas (ya resumida o no)."""
    lineas = 0
    unidades = 0
    area_mm2 = 0.0
    for pieza in piezas:
        lineas += 1
        unidades += pieza.cantidad
        area_mm2 += pieza.area_mm2 * pieza.cantidad
    return {
        "lineas": lineas,
        "unidades": unidades,
        "area_mm2": area_mm2,
        "area_m2": area_mm2 / 1_000_000.0,
    }


def tabla(piezas: Iterable[Pieza]) -> str:
    """Lista de corte en texto plano (ancho fijo) para leer en consola."""
    filas = resumen(piezas)
    encabezado = (
        f"{'Cant':>5}  {'Largo':>8}  {'Ancho':>8}  {'Esp':>4}  "
        f"{'Canto':>5}  {'Veta':>11}  Nombre"
    )
    lineas = [encabezado, "-" * len(encabezado)]
    for pieza in filas:
        lineas.append(
            f"{pieza.cantidad:>5}  {pieza.largo:>8.1f}  {pieza.ancho:>8.1f}  "
            f"{pieza.espesor:>4.0f}  {pieza.cantos.cantidad():>5}  "
            f"{pieza.veta:>11}  {pieza.nombre}"
        )
    datos = totales(filas)
    lineas.append("-" * len(encabezado))
    lineas.append(
        f"{datos['unidades']:>5} piezas en {datos['lineas']} líneas  "
        f"({datos['area_m2']:.2f} m² de tablero)"
    )
    return "\n".join(lineas)
