"""Librero (estantería de libros) paramétrico.

Geometría (mm, medidas exteriores)
----------------------------------
- ``ancho``, ``alto`` y ``fondo`` exteriores (costado a costado).
- Caja: 2 costados de ``alto x fondo`` (con canto frontal y canto en la arista
  superior, porque la tapa va entre costados), tapa y base entre costados,
  repisas entre costados y trasera de 3 mm clavada al dorso (espesor de trasera
  según ARAUCO, serie Cómo Hacer 17).
- Repisas repartidas en el interior o en alturas explícitas; con
  ``repisas_moviles`` los costados llevan barrenos Ø5 (criterio de ARAUCO #6).

*Por revisar*: los valores por omisión de ``fondo`` (300 mm) y de la altura útil
entre repisas se tomaron de guías de taller ("un librero de 30 a 35 cm de
profundidad y la misma separación entre entrepaños": https://www.instagram.com/p/B7RItFOH3XF/),
no de un documento técnico; la luz máxima entre apoyos tampoco tiene fuente
verificada y por eso el perfil no la avisa salvo que se configure
(``PerfilRestricciones.luz_max_repisa_aviso``). Ajuste esas medidas antes de
fabricar.
"""

from __future__ import annotations

from dataclasses import dataclass

from cutlist.modulo import Accesorio, Modulo
from cutlist.modules.common import (
    CANTO_DEFAULT,
    MATERIAL_DEFAULT,
    MATERIAL_TRASERA_DEFAULT,
    barrenos_repisa,
    exigir_positivo,
    posiciones_repisas,
)
from cutlist.parts import Cantos, Mecanizado, Pieza

CAMPOS = {
    "ancho": "Ancho exterior, de costado a costado (mm)",
    "alto": "Alto exterior total (mm)",
    "fondo": "Profundidad del costado (mm) — por revisar",
    "repisas": "Cantidad de repisas (si no se dan posiciones explícitas)",
    "posiciones_repisas": "Alturas de repisa sobre el piso interior (mm)",
    "repisas_moviles": "Perforar los costados para soportes de repisa (Ø5)",
    "espesor": "Espesor del tablero del cuerpo (mm)",
    "trasera_espesor": "Espesor de la trasera (mm); 0 = sin trasera",
    "material": "Texto del material del cuerpo (como en el despiece)",
    "material_trasera": "Texto del material de la trasera",
    "canto": "Texto del canto de las aristas vistas del cuerpo",
    "nombre": "Nombre del módulo para el despiece",
}


@dataclass
class ParamsLibrero:
    ancho: float = 800.0
    alto: float = 2000.0
    fondo: float = 300.0
    repisas: int = 4
    posiciones_repisas: tuple[float, ...] | None = None
    repisas_moviles: bool = False
    espesor: float = 18.0
    trasera_espesor: float = 3.0
    material: str = MATERIAL_DEFAULT
    material_trasera: str = MATERIAL_TRASERA_DEFAULT
    canto: str = CANTO_DEFAULT
    nombre: str = ""


def generar(params: ParamsLibrero) -> Modulo:
    exigir_positivo(
        ancho=params.ancho,
        alto=params.alto,
        fondo=params.fondo,
        espesor=params.espesor,
    )
    if params.repisas < 0:
        raise ValueError("la cantidad de repisas no puede ser negativa")
    if params.trasera_espesor >= params.fondo:
        raise ValueError("la trasera no puede ocupar toda la profundidad")

    material, canto = params.material, params.canto
    nombre = params.nombre or f"Librero {params.ancho:.0f}x{params.alto:.0f}x{params.fondo:.0f}"
    ancho_interior = params.ancho - 2 * params.espesor
    if ancho_interior <= 0:
        raise ValueError("el ancho exterior no deja interior entre costados")

    interior_desde = params.espesor
    interior_hasta = params.alto - params.espesor
    alturas_repisas = (
        list(params.posiciones_repisas)
        if params.posiciones_repisas is not None
        else posiciones_repisas(params.repisas, interior_desde, interior_hasta)
    )
    for posicion in alturas_repisas:
        if not interior_desde < posicion < interior_hasta:
            raise ValueError(
                f"la repisa a {posicion:.0f} mm queda fuera del interior del módulo"
            )

    comun = {"espesor": params.espesor, "material": material, "modulo": nombre}
    mecanizado_costado = barrenos_repisa(alturas_repisas) if params.repisas_moviles else Mecanizado()
    funcion_costado = "Costado — canto frontal y canto en la arista superior"
    if mecanizado_costado.barrenos:
        funcion_costado += ", con barrenos Ø5 para repisas móviles"

    piezas: list[Pieza] = [
        Pieza(
            nombre="Costado",
            largo=params.alto,
            ancho=params.fondo,
            cantidad=2,
            rol="costado",
            cantos=Cantos(largo_a=canto, ancho_a=canto),
            mecanizado=mecanizado_costado,
            funcion=funcion_costado,
            **comun,
        ),
        Pieza(
            nombre="Base",
            largo=params.fondo,
            ancho=ancho_interior,
            rol="base",
            cantos=Cantos(ancho_a=canto),
            funcion="Base entre costados — canto en la arista frontal",
            **comun,
        ),
        Pieza(
            nombre="Tapa",
            largo=params.fondo,
            ancho=ancho_interior,
            rol="tapa",
            cantos=Cantos(ancho_a=canto),
            funcion="Tapa entre costados — canto en la arista frontal",
            **comun,
        ),
    ]

    if alturas_repisas:
        piezas.append(
            Pieza(
                nombre="Repisa",
                largo=params.fondo,
                ancho=ancho_interior,
                cantidad=len(alturas_repisas),
                rol="repisa",
                cantos=Cantos(ancho_a=canto),
                funcion="Repisa entre costados — canto en la arista frontal",
                **comun,
            )
        )
    if params.trasera_espesor > 0:
        piezas.append(
            Pieza(
                nombre="Trasera",
                largo=params.alto,
                ancho=params.ancho,
                espesor=params.trasera_espesor,
                material=params.material_trasera,
                rol="trasera",
                veta="indiferente",
                funcion="Trasera clavada al dorso del módulo (rigidiza el librero)",
                modulo=nombre,
            )
        )

    notas = [
        "Tapa y base entre costados: las aristas superiores de los costados quedan a la vista.",
    ]
    if not alturas_repisas:
        notas.append("Librero sin repisas.")
    elif params.posiciones_repisas is None:
        notas.append("Repisas repartidas parejas en el interior del módulo.")
    else:
        notas.append("Repisas en las alturas pedidas.")
    if alturas_repisas:
        notas.append(
            "Alturas de repisa sobre el piso interior (mm): "
            + ", ".join(f"{altura - params.espesor:.0f}" for altura in alturas_repisas)
        )
    if params.trasera_espesor <= 0:
        notas.append("Sin trasera: el librero necesita muro o rigidización adicional.")

    accesorios = [
        Accesorio(nombre="Tornillo 4 x 50 mm", nota="Armado de costados, base y tapa"),
    ]
    if params.repisas_moviles and alturas_repisas:
        accesorios.append(
            Accesorio(
                nombre="Soporte de repisa Ø5",
                cantidad=4 * len(alturas_repisas),
                nota="Cuatro soportes por repisa",
            )
        )

    return Modulo(
        tipo="librero",
        nombre=nombre,
        medidas={
            "ancho": params.ancho,
            "alto": params.alto,
            "fondo": params.fondo,
            "repisas": len(alturas_repisas),
            "ancho_interior": ancho_interior,
        },
        piezas=piezas,
        accesorios=accesorios,
        notas=notas,
    )
