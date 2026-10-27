"""Clóset (armario de colgar y repisas) paramétrico.

Geometría (mm, medidas exteriores)
----------------------------------
- ``ancho``, ``alto`` y ``fondo`` exteriores (costado a costado).
- Caja: 2 costados, tapa y base entre costados, trasera de 3 mm clavada al dorso
  (espesor de trasera según ARAUCO, serie Cómo Hacer 17).
- Repisas: repartidas en el interior o en posiciones explícitas. Si
  ``repisas_moviles`` está activo, los costados llevan barrenos Ø5 con el
  criterio de ARAUCO #6 (a 40–50 mm del borde, 30 mm de paso entre barrenos,
  una posición y dos arriba y dos abajo).
- Puertas ``batiente`` (cubrientes, con ``juego`` entre ellas) o ``corredera``
  (traslapadas, con juego de guía). El barral es un accesorio, no una pieza.

El módulo no decide la distribución interna (dónde va el colgado y dónde las
repisas): eso se pide con ``posiciones_repisas`` y ``barral_altura``.
"""

from __future__ import annotations

from dataclasses import dataclass

from cutlist.modulo import Accesorio, Modulo
from cutlist.modules.common import (
    CANTO_DEFAULT,
    JUEGO_DEFAULT,
    MATERIAL_DEFAULT,
    MATERIAL_TRASERA_DEFAULT,
    barrenos_repisa,
    exigir_positivo,
    frentes,
    posiciones_repisas,
    repartir,
)
from cutlist.parts import Cantos, Mecanizado, Pieza

TIPOS_PUERTA = ("batiente", "corredera", "sin")

CAMPOS = {
    "ancho": "Ancho exterior, de costado a costado (mm)",
    "alto": "Alto exterior total (mm)",
    "fondo": "Profundidad del costado (mm) — por revisar",
    "puertas": "Cantidad de puertas",
    "tipo_puerta": "batiente, corredera o sin",
    "repisas": "Cantidad de repisas (si no se dan posiciones explícitas)",
    "posiciones_repisas": "Alturas de repisa sobre el piso interior (mm)",
    "barral_altura": "Altura del barral sobre el piso del módulo (mm); vacío = sin barral",
    "repisas_moviles": "Perforar los costados para soportes de repisa (Ø5)",
    "espesor": "Espesor del tablero del cuerpo (mm)",
    "espesor_puerta": "Espesor del tablero de puertas (mm)",
    "trasera_espesor": "Espesor de la trasera (mm); 0 = sin trasera",
    "juego": "Holgura entre puertas (mm) — por revisar",
    "traslape_corredera": "Traslape entre puertas correderas (mm) — por revisar",
    "juego_guia": "Juego vertical para las guías de puerta corredera (mm) — por revisar",
    "material": "Texto del material del cuerpo (como en el despiece)",
    "material_frente": "Texto del material de puertas; vacío = igual al cuerpo",
    "material_trasera": "Texto del material de la trasera",
    "canto": "Texto del canto de las aristas vistas del cuerpo",
    "canto_frente": "Texto del canto de las puertas; vacío = igual al del cuerpo",
    "nombre": "Nombre del módulo para el despiece",
}


@dataclass
class ParamsCloset:
    ancho: float = 1500.0
    alto: float = 2400.0
    fondo: float = 600.0
    puertas: int = 2
    tipo_puerta: str = "batiente"
    repisas: int = 3
    posiciones_repisas: tuple[float, ...] | None = None
    barral_altura: float | None = 1700.0
    repisas_moviles: bool = False
    espesor: float = 18.0
    espesor_puerta: float = 18.0
    trasera_espesor: float = 3.0
    juego: float = JUEGO_DEFAULT
    traslape_corredera: float = 30.0
    juego_guia: float = 45.0
    material: str = MATERIAL_DEFAULT
    material_frente: str = ""
    material_trasera: str = MATERIAL_TRASERA_DEFAULT
    canto: str = CANTO_DEFAULT
    canto_frente: str = ""
    nombre: str = ""


def _bisagras_por_puerta(alto_puerta: float) -> int:
    """Cantidad de bisagras según el alto de la puerta — *por revisar*."""
    if alto_puerta <= 900:
        return 2
    if alto_puerta <= 1600:
        return 3
    return 4


def generar(params: ParamsCloset) -> Modulo:
    exigir_positivo(
        ancho=params.ancho,
        alto=params.alto,
        fondo=params.fondo,
        espesor=params.espesor,
        espesor_puerta=params.espesor_puerta,
    )
    if params.tipo_puerta not in TIPOS_PUERTA:
        raise ValueError(f"tipo_puerta inválido: {params.tipo_puerta!r}; use {TIPOS_PUERTA}")
    if params.repisas < 0:
        raise ValueError("la cantidad de repisas no puede ser negativa")
    if params.tipo_puerta != "sin" and params.puertas < 1:
        raise ValueError("se pidieron puertas pero la cantidad es menor que uno")
    if params.tipo_puerta == "corredera" and params.puertas < 2:
        raise ValueError("las puertas correderas necesitan al menos dos hojas")

    material, material_frente, canto, canto_frente = frentes(
        params.material, params.material_frente, params.canto, params.canto_frente
    )
    nombre = params.nombre or f"Clóset {params.ancho:.0f}x{params.alto:.0f}x{params.fondo:.0f}"
    ancho_interior = params.ancho - 2 * params.espesor
    if ancho_interior <= 0:
        raise ValueError("el ancho exterior no deja interior entre costados")
    if params.trasera_espesor >= params.fondo:
        raise ValueError("la trasera no puede ocupar toda la profundidad")

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
    funcion_costado = "Costado — canto en la arista frontal"
    if mecanizado_costado.barrenos:
        funcion_costado += " y barrenos Ø5 para repisas móviles"

    piezas: list[Pieza] = [
        Pieza(
            nombre="Costado",
            largo=params.alto,
            ancho=params.fondo,
            cantidad=2,
            rol="costado",
            cantos=Cantos(largo_a=canto),
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

    if not alturas_repisas:
        notas = ["Módulo sin repisas."]
    elif params.posiciones_repisas is None:
        notas = ["Repisas repartidas parejas en el interior del módulo."]
    else:
        notas = ["Repisas en las alturas pedidas."]
    notas.append(
        "La trasera se clava/atornilla al dorso, sin ranura."
        if params.trasera_espesor > 0
        else "Módulo sin trasera: necesita muro o rigidización adicional."
    )
    if alturas_repisas:
        notas.append(
            "Alturas de repisa sobre el piso interior (mm): "
            + ", ".join(f"{altura - params.espesor:.0f}" for altura in alturas_repisas)
        )

    accesorios: list[Accesorio] = []
    if params.barral_altura is not None:
        if not 0 < params.barral_altura < params.alto:
            raise ValueError("la altura del barral debe quedar dentro del módulo")
        accesorios.extend(
            [
                Accesorio(
                    nombre="Barral redondo",
                    nota=f"A {params.barral_altura:.0f} mm sobre el piso del módulo "
                    "(por revisar según el tipo de colgado)",
                ),
                Accesorio(nombre="Soporte de barral", cantidad=2),
            ]
        )
    if mecanizado_costado.barrenos:
        accesorios.append(
            Accesorio(
                nombre="Soporte de repisa Ø5",
                cantidad=4 * len(alturas_repisas),
                nota="Cuatro soportes por repisa",
            )
        )

    if params.tipo_puerta == "batiente":
        alto_puerta = params.alto - params.juego
        if alto_puerta <= 0:
            raise ValueError("la holgura de puerta deja alto no positivo")
        ancho_puerta = repartir(params.ancho, params.puertas, params.juego)[0]
        piezas.append(
            Pieza(
                nombre="Puerta",
                largo=alto_puerta,
                ancho=ancho_puerta,
                cantidad=params.puertas,
                espesor=params.espesor_puerta,
                material=material_frente,
                rol="puerta",
                cantos=Cantos().todas(canto_frente),
                funcion="Puerta batiente cubriente — canto en las 4 aristas",
                modulo=nombre,
            )
        )
        notas.append(
            f"Puertas cubrientes de {ancho_puerta:.1f} mm con {params.juego:.0f} mm de "
            "holgura entre ellas (por revisar)."
        )
        accesorios.append(
            Accesorio(
                nombre="Bisagra",
                cantidad=_bisagras_por_puerta(alto_puerta) * params.puertas,
                nota="Cantidad por alto de puerta — por revisar con el herraje",
            )
        )
        accesorios.append(Accesorio(nombre="Tirador o manija", cantidad=params.puertas))
    elif params.tipo_puerta == "corredera":
        ancho_hoja = (
            params.ancho + (params.puertas - 1) * params.traslape_corredera
        ) / params.puertas
        alto_hoja = params.alto - params.juego_guia
        if alto_hoja <= 0:
            raise ValueError("el juego de guía deja alto de hoja no positivo")
        piezas.append(
            Pieza(
                nombre="Puerta corredera",
                largo=alto_hoja,
                ancho=ancho_hoja,
                cantidad=params.puertas,
                espesor=params.espesor_puerta,
                material=material_frente,
                rol="puerta",
                cantos=Cantos().todas(canto_frente),
                funcion="Hoja de puerta corredera traslapada — canto en las 4 aristas",
                modulo=nombre,
            )
        )
        notas.append(
            f"Hojas traslapadas {params.traslape_corredera:.0f} mm y "
            f"{params.juego_guia:.0f} mm de juego para las guías: por revisar contra "
            "el sistema de correderas elegido."
        )
        accesorios.extend(
            [
                Accesorio(nombre="Guía superior de puerta corredera", nota="Por revisar"),
                Accesorio(nombre="Guía inferior de puerta corredera", nota="Por revisar"),
            ]
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
                funcion="Trasera clavada al dorso del módulo",
                modulo=nombre,
            )
        )

    return Modulo(
        tipo="closet",
        nombre=nombre,
        medidas={
            "ancho": params.ancho,
            "alto": params.alto,
            "fondo": params.fondo,
            "puertas": params.puertas if params.tipo_puerta != "sin" else 0,
            "repisas": len(alturas_repisas),
            "ancho_interior": ancho_interior,
        },
        piezas=piezas,
        accesorios=accesorios,
        notas=notas,
    )
