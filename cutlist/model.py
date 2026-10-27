"""Modelo de datos común (piezas, hojas, layouts y listas de corte).

Convenciones:
- Unidades: milímetros (mm), salvo que el formato indique lo contrario.
- Cantos: claves ``c1``/``c2`` (lados del largo) y ``l1``/``l2`` (lados del ancho),
  misma convención que el JSON de Cortecloud. El valor es el texto del canto
  (``None`` = sin canto).
- Veta: ``True`` con veta, ``False`` sin veta, ``None`` desconocido.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

# Estados de verificación de un formato o de un dato.
VERIFICADO = "verificado"
PARCIAL = "parcial"
POR_REVISAR = "por revisar"


class ErrorDato(ValueError):
    """Dato inválido dentro de una lista de piezas."""


@dataclass(frozen=True)
class Fuente:
    """Documentación pública consultada para un formato."""

    url: str
    descripcion: str


@dataclass(frozen=True)
class Aviso:
    """Dato no verificado; se marca «por revisar» con su fuente."""

    mensaje: str
    fuente: str | None = None
    estado: str = POR_REVISAR

    def texto(self) -> str:
        base = f"{self.estado}: {self.mensaje}"
        return f"{base} (fuente: {self.fuente})" if self.fuente else base


@dataclass
class Pieza:
    """Una pieza de tablero."""

    nombre: str
    largo: float
    ancho: float
    cantidad: int = 1
    material: str | None = None
    espesor: float | None = None
    veta: bool | None = None
    cantos: dict[str, str | None] = field(default_factory=dict)
    grupo: str | None = None
    etiqueta: str | None = None
    notas: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.nombre = (self.nombre or "").strip() or "sin nombre"
        self.largo = float(self.largo)
        self.ancho = float(self.ancho)
        if self.largo <= 0 or self.ancho <= 0:
            raise ErrorDato(
                f"pieza {self.nombre!r}: largo y ancho deben ser > 0 "
                f"(largo={self.largo}, ancho={self.ancho})"
            )
        if self.cantidad is None:
            self.cantidad = 1
        self.cantidad = int(self.cantidad)
        if self.cantidad < 1:
            raise ErrorDato(f"pieza {self.nombre!r}: cantidad debe ser >= 1")
        self.cantos = {k: v for k, v in (self.cantos or {}).items() if v}

    @property
    def area_mm2(self) -> float:
        """Área de una pieza, sin multiplicar por la cantidad."""
        return self.largo * self.ancho

    @property
    def area_total_m2(self) -> float:
        """Área de todas las unidades de la pieza, en m²."""
        return self.area_mm2 * self.cantidad / 1_000_000


@dataclass
class ListaCorte:
    """Conjunto de piezas leído de (o destinado a) algún formato."""

    piezas: list[Pieza] = field(default_factory=list)
    origen: str | None = None
    metadatos: dict[str, Any] = field(default_factory=dict)
    avisos: list[Aviso] = field(default_factory=list)

    def agregar(self, pieza: Pieza) -> Pieza:
        self.piezas.append(pieza)
        return pieza

    def avisar(self, mensaje: str, fuente: str | None = None) -> None:
        self.avisos.append(Aviso(mensaje=mensaje, fuente=fuente))

    def por_revisar(self) -> list[Aviso]:
        return [a for a in self.avisos if a.estado == POR_REVISAR]

    @property
    def total_piezas(self) -> int:
        """Cantidad de piezas físicas (suma de cantidades)."""
        return sum(p.cantidad for p in self.piezas)

    @property
    def area_total_m2(self) -> float:
        return sum(p.area_total_m2 for p in self.piezas)


@dataclass
class Colocacion:
    """Una pieza ubicada dentro de una hoja (resultado de un layout)."""

    pieza: Pieza
    x: float
    y: float
    largo: float
    ancho: float
    rotada: bool = False
    identificador: str | None = None

    @property
    def x2(self) -> float:
        return self.x + self.largo

    @property
    def y2(self) -> float:
        return self.y + self.ancho

    @property
    def area_mm2(self) -> float:
        return self.largo * self.ancho


@dataclass
class Hoja:
    """Un tablero de stock con las piezas que se cortan de él."""

    nombre: str
    largo: float
    ancho: float
    espesor: float | None = None
    material: str | None = None
    kerf: float | None = None
    colocaciones: list[Colocacion] = field(default_factory=list)

    @property
    def area_mm2(self) -> float:
        return self.largo * self.ancho

    @property
    def area_usada_mm2(self) -> float:
        return sum(c.area_mm2 for c in self.colocaciones)

    @property
    def aprovechamiento(self) -> float:
        """Porcentaje de aprovechamiento (0-100)."""
        if self.area_mm2 <= 0:
            return 0.0
        return 100.0 * self.area_usada_mm2 / self.area_mm2


@dataclass
class Layout:
    """Resultado de optimización: hojas con piezas colocadas."""

    hojas: list[Hoja] = field(default_factory=list)
    metadatos: dict[str, Any] = field(default_factory=dict)

    @property
    def aprovechamiento(self) -> float:
        total = sum(h.area_mm2 for h in self.hojas)
        usada = sum(h.area_usada_mm2 for h in self.hojas)
        return 100.0 * usada / total if total > 0 else 0.0
