"""Reglas del perfil de corte y validación del mecanizado.

`cutlist/models.py` describe la pieza y su mecanizado; aquí viven las reglas:

- `part_invalid_reasons` / `machining_outside`: el mecanizado tiene que caber
  en la pieza. Un barreno vertical se valida como círculo completo sobre la
  cara; un barreno horizontal (`Drill.horizontal`: barrenos al canto, como los
  `horizontalDrills` de Cortecloud o los `HOLE` de Promob con `FACENORMAL` sin
  Z) se valida **contra el canto y el espesor**: el centro debe caer dentro del
  largo del canto y dentro del espesor de la pieza, sin descontar el radio. Una
  ranura con eje se valida con su ancho abierto perpendicular al eje, así que
  puede terminar justo en el borde (ranura pasante).
- `Constraints`: el perfil Cortecloud/Madijal (mínimo de pieza y las medidas de
  ranura y barreno que admite). Genera avisos, no rechaza el archivo.

*por revisar*: la muestra de Cortecloud trae los `horizontalDrills` vacíos, así
que la posición de un barreno al canto no tiene muestra real; el export tampoco
dice cuál coordenada corre a lo largo del canto, así que el centro se acepta si
cabe con cualquiera de las dos lecturas (`x` a lo largo o `y` a lo largo). Sin
espesor conocido (`Part.thickness is None`) sólo se valida el canto contra el
lado mayor. Las ranuras `furrowMachining` de Cortecloud (sólo `face`, `depth`,
`width` y `distance`, sin eje) siguen *por revisar* y no se validan.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover - sólo para los tipos
    from .models import Drill, Machining, Part, Slot

# Tolerancia al comparar medidas de mecanizado con las del perfil (en mm).
MACHINING_TOLERANCE = 1e-6


def part_invalid_reasons(part: "Part") -> tuple[str, ...]:
    """Motivos por los que la pieza no se puede cortar (vacío si cabe)."""
    if part.machining is None:
        return ()
    return tuple(
        machining_outside(part.machining, part.width, part.height, part.thickness)
    )


def machining_outside(
    machining: "Machining",
    width: float,
    height: float,
    thickness: float | None = None,
) -> list[str]:
    """Mecanizado que cae, en todo o en parte, fuera de la pieza."""
    problems: list[str] = []
    for drill in machining.drills:
        problems.extend(_drill_problems(drill, width, height, thickness))
    for slot in machining.slots:
        problem = _slot_problem(slot, width, height)
        if problem:
            problems.append(problem)
    return problems


def _drill_problems(
    drill: "Drill", width: float, height: float, thickness: float | None
) -> list[str]:
    tolerance = MACHINING_TOLERANCE
    if drill.horizontal:
        return _edge_drill_problems(drill, width, height, thickness, tolerance)
    radius = drill.diameter / 2.0
    if (
        drill.x - radius < -tolerance
        or drill.y - radius < -tolerance
        or drill.x + radius > width + tolerance
        or drill.y + radius > height + tolerance
    ):
        return [
            f"barreno Ø{drill.diameter:g} mm en ({drill.x:g}; {drill.y:g}) "
            f"fuera del área {width:g}x{height:g} mm"
        ]
    return []


def _edge_drill_problems(
    drill: "Drill",
    width: float,
    height: float,
    thickness: float | None,
    tolerance: float,
) -> list[str]:
    """Barreno al canto: el centro debe caer dentro del canto y del espesor."""
    canto = max(width, height)
    lugar = f"barreno horizontal Ø{drill.diameter:g} mm en ({drill.x:g}; {drill.y:g})"
    # El canto es uno de los dos lados: cada coordenada debe caber en él.
    if (
        drill.x < -tolerance
        or drill.x > canto + tolerance
        or drill.y < -tolerance
        or drill.y > canto + tolerance
    ):
        return [f"{lugar} fuera del canto {canto:g} mm"]
    if thickness is not None and not (
        _fits_edge(drill.x, drill.y, canto, thickness, tolerance)
        or _fits_edge(drill.y, drill.x, canto, thickness, tolerance)
    ):
        return [f"{lugar} fuera del espesor {thickness:g} mm"]
    return []


def _fits_edge(
    along: float, across: float, canto: float, thickness: float | None, tolerance: float
) -> bool:
    """`along` corre por el canto y `across` cruza hacia el espesor."""
    if along < -tolerance or along > canto + tolerance:
        return False
    if thickness is None:
        return True
    return -tolerance <= across <= thickness + tolerance


def _slot_problem(slot: "Slot", width: float, height: float) -> str | None:
    if not slot.has_axis:
        return None
    tolerance = MACHINING_TOLERANCE
    half = slot.width / 2.0
    length = math.hypot(slot.x1 - slot.x0, slot.y1 - slot.y0)
    if length:
        # El ancho se abre perpendicular al eje: una ranura puede terminar
        # justo en el borde de la pieza (ranura pasante).
        spread_x = abs(slot.y1 - slot.y0) / length * half
        spread_y = abs(slot.x1 - slot.x0) / length * half
    else:
        spread_x = spread_y = half
    if (
        min(slot.x0, slot.x1) - spread_x < -tolerance
        or min(slot.y0, slot.y1) - spread_y < -tolerance
        or max(slot.x0, slot.x1) + spread_x > width + tolerance
        or max(slot.y0, slot.y1) + spread_y > height + tolerance
    ):
        return (
            f"ranura de {slot.width:g} mm de ({slot.x0:g}; {slot.y0:g}) a "
            f"({slot.x1:g}; {slot.y1:g}) fuera del área {width:g}x{height:g} mm"
        )
    return None


def _is_allowed(value: float, allowed: tuple[float, ...]) -> bool:
    return any(abs(value - candidate) <= MACHINING_TOLERANCE for candidate in allowed)


def _allowed_text(allowed: tuple[float, ...]) -> str:
    return "/".join(f"{value:g}" for value in allowed)


@dataclass(frozen=True)
class Constraints:
    """Perfil de restricciones de corte (por ejemplo Cortecloud/Madijal).

    Los valores por defecto son los observados en uso real y documentados en
    `docs/memoria/MEMORIA.md`; no son reglas del motor para todos los casos.
    """

    min_piece: float = 65.0
    min_machined_length: float = 250.0
    max_piece_width: float = 2480.0
    max_piece_height: float = 1810.0
    slot_widths: tuple[float, ...] = (5.7, 6.2, 6.7, 7.0, 9.7, 12.7, 15.7, 18.7, 25.7)
    horizontal_drill_diameters: tuple[float, ...] = (3.0, 8.0)
    vertical_drill_diameters: tuple[float, ...] = (3.0, 5.0, 8.0, 10.0, 15.0, 20.0, 35.0)

    def violations(self, part: "Part") -> list[str]:
        """Restricciones que la pieza no cumple (lista vacía si cumple todas)."""
        problems: list[str] = []
        short_side = min(part.width, part.height)
        long_side = max(part.width, part.height)
        if short_side < self.min_piece:
            problems.append(
                f"pieza bajo el mínimo de corte ({self.min_piece:g} mm): "
                f"{short_side:g} mm en «{part.label or 'sin nombre'}»"
            )
        fits = (
            part.width <= self.max_piece_width and part.height <= self.max_piece_height
        ) or (
            part.height <= self.max_piece_width and part.width <= self.max_piece_height
        )
        if not fits:
            problems.append(
                f"pieza sobre el máximo ({self.max_piece_width:g}x{self.max_piece_height:g} mm): "
                f"{part.width:g}x{part.height:g} en «{part.label or 'sin nombre'}»"
            )
        if long_side < self.min_machined_length:
            problems.append(
                f"pieza mecanizada menor a {self.min_machined_length:g} mm: "
                f"{long_side:g} mm en «{part.label or 'sin nombre'}»"
            )
        problems.extend(self._machining_violations(part))
        return problems

    def _machining_violations(self, part: "Part") -> list[str]:
        """Ranuras y barrenos del mecanizado que el perfil no admite."""
        machining = part.machining
        if machining is None:
            return []

        name = part.label or "sin nombre"
        problems: list[str] = []
        for width in machining.slot_widths:
            if not _is_allowed(width, self.slot_widths):
                problems.append(
                    f"ranura de {width:g} mm no permitida en «{name}» "
                    f"(permitidas: {_allowed_text(self.slot_widths)} mm)"
                )
        for label, diameters, allowed in (
            ("barreno horizontal", machining.horizontal_drills, self.horizontal_drill_diameters),
            ("barreno vertical", machining.vertical_drills, self.vertical_drill_diameters),
        ):
            for diameter in diameters:
                if not _is_allowed(diameter, allowed):
                    problems.append(
                        f"{label} Ø{diameter:g} mm no permitido en «{name}» "
                        f"(permitidos: {_allowed_text(allowed)} mm)"
                    )
        return problems
