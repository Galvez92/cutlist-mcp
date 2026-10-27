"""Cajonera (torre de cajones) paramétrica.

Geometría (mm, medidas exteriores)
----------------------------------
- ``ancho``, ``alto`` y ``fondo`` son exteriores: de costado exterior a costado
  exterior, criterio de modulación de ARAUCO (*Cómo Diseñar y Construir
  Correctamente una Cocina*, serie Cómo Hacer 17).
- Caja del cuerpo: 2 costados de ``alto x fondo``, base y tapa entre costados
  (``ancho - 2 x espesor``), un travesaño trasero de rigidez y trasera de 3 mm
  clavada al dorso (espesor de trasera según ARAUCO #17).
- Frentes cubrientes: la altura total se reparte en ``cajones`` frentes con
  ``juego`` entre ellos. La caja de cada cajón se arma como el despiece real del
  fixture `tests/fixtures/cortecloud/escritorio_D_simple.json`.
- La cajonera apoya en el piso (sin zócalo).

Convención de cantos: ver `docs/modulos-parametricos.md`. En piezas verticales
(costados, frentes) el frente del mueble se marca en ``largo_a``; en horizontales
(base, tapa) en ``ancho_a``. La pieza y su espejo son la misma línea, por eso el
lado izquierdo/derecho no se distingue.
"""

from __future__ import annotations

from dataclasses import dataclass

from cutlist.modulo import Accesorio, Modulo
from cutlist.modules.common import (
    ALTO_TRAVESAÑO_DEFAULT,
    CANTO_DEFAULT,
    JUEGO_DEFAULT,
    MATERIAL_DEFAULT,
    MATERIAL_TRASERA_DEFAULT,
    cajon,
    elegir_corredera,
    exigir_positivo,
    frentes,
    repartir,
)
from cutlist.parts import Cantos, Pieza

CAMPOS = {
    "ancho": "Ancho exterior, de costado a costado (mm)",
    "alto": "Alto exterior total (mm)",
    "fondo": "Profundidad del costado (mm)",
    "cajones": "Cantidad de cajones",
    "espesor": "Espesor del tablero del cuerpo (mm)",
    "trasera_espesor": "Espesor de la trasera (mm); 0 = sin trasera",
    "juego": "Holgura entre frentes (mm) — por revisar",
    "juego_corredera": "Juego lateral total de la corredera (mm) — por revisar",
    "margen_alto_cajon": "Diferencia de alto entre frente y caja del cajón (mm) — por revisar",
    "juego_fondo": "Holgura entre el fondo de la caja y la trasera (mm)",
    "alturas_frente": "Alturas de frente explícitas, de abajo hacia arriba (mm)",
    "material": "Texto del material del cuerpo (como en el despiece)",
    "material_frente": "Texto del material de frentes; vacío = igual al cuerpo",
    "material_trasera": "Texto del material de la trasera",
    "canto": "Texto del canto de las aristas vistas del cuerpo",
    "canto_frente": "Texto del canto de los frentes; vacío = igual al del cuerpo",
    "nombre": "Nombre del módulo para el despiece",
}


@dataclass
class ParamsCajonera:
    ancho: float = 450.0
    alto: float = 800.0
    fondo: float = 500.0
    cajones: int = 4
    espesor: float = 18.0
    trasera_espesor: float = 3.0
    juego: float = JUEGO_DEFAULT
    juego_corredera: float = 25.0
    margen_alto_cajon: float = 20.0
    juego_fondo: float = 10.0
    alturas_frente: tuple[float, ...] | None = None
    material: str = MATERIAL_DEFAULT
    material_frente: str = ""
    material_trasera: str = MATERIAL_TRASERA_DEFAULT
    canto: str = CANTO_DEFAULT
    canto_frente: str = ""
    nombre: str = ""


def generar(params: ParamsCajonera) -> Modulo:
    exigir_positivo(
        ancho=params.ancho,
        alto=params.alto,
        fondo=params.fondo,
        espesor=params.espesor,
    )
    if params.cajones < 1:
        raise ValueError("la cajonera necesita al menos un cajón")

    material, material_frente, canto, canto_frente = frentes(
        params.material, params.material_frente, params.canto, params.canto_frente
    )
    nombre = params.nombre or f"Cajonera {params.ancho:.0f}x{params.alto:.0f}x{params.fondo:.0f}"
    ancho_interior = params.ancho - 2 * params.espesor
    if ancho_interior <= 0:
        raise ValueError("el ancho exterior no deja interior entre costados")
    if params.trasera_espesor >= params.fondo:
        raise ValueError("la trasera no puede ocupar toda la profundidad")

    comun = {"espesor": params.espesor, "material": material, "modulo": nombre}
    piezas: list[Pieza] = [
        Pieza(
            nombre="Costado",
            largo=params.alto,
            ancho=params.fondo,
            cantidad=2,
            rol="costado",
            cantos=Cantos(largo_a=canto),
            funcion="Costado — canto en la arista frontal",
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
        Pieza(
            nombre="Travesaño trasero",
            largo=ancho_interior,
            ancho=ALTO_TRAVESAÑO_DEFAULT,
            rol="travesaño",
            funcion="Travesaño trasero de rigidez, entre costados",
            **comun,
        ),
    ]

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
                **{"modulo": nombre},
            )
        )

    alturas = list(params.alturas_frente or repartir(params.alto, params.cajones, params.juego))
    if len(alturas) != params.cajones:
        raise ValueError(
            f"se pidieron {params.cajones} cajones y se dieron {len(alturas)} alturas de frente"
        )
    if sum(alturas) + (params.cajones - 1) * params.juego > params.alto:
        raise ValueError("las alturas de frente no caben en el alto del módulo")

    ancho_caja = ancho_interior - params.juego_corredera
    if ancho_caja <= 2 * params.espesor:
        raise ValueError("el juego de corredera no deja ancho útil en la caja del cajón")
    fondo_util = params.fondo - params.trasera_espesor - params.juego_fondo
    largo_corredera, estandar = elegir_corredera(fondo_util)

    notas = [
        "Frentes cubrientes: cubren el frente del módulo, con "
        f"{params.juego:.0f} mm de holgura entre ellos (por revisar).",
        f"Caja de cajón de {ancho_caja:.0f} mm de ancho exterior "
        f"({ancho_interior:.0f} mm de interior menos {params.juego_corredera:.0f} mm de "
        "juego de corredera: por revisar contra el herraje).",
        "La trasera se clava/atornilla al dorso, sin ranura.",
    ]
    if not estandar:
        notas.append(
            f"El cajón queda de {largo_corredera:.0f} mm de fondo: no calza ninguna "
            "corredera de 400/450/500 mm (ARAUCO #17); por revisar el catálogo del herraje."
        )

    for numero, alto_frente in enumerate(alturas, start=1):
        alto_caja = alto_frente - params.margen_alto_cajon
        if alto_caja <= 0:
            raise ValueError(
                f"el frente {numero} de {alto_frente:.0f} mm no deja alto para la caja"
            )
        piezas.append(
            Pieza(
                nombre="Frente de cajón",
                largo=alto_frente,
                ancho=params.ancho,
                espesor=params.espesor,
                material=material_frente,
                rol="frente",
                cantos=Cantos().todas(canto_frente),
                funcion="Frente de cajón cubriente — canto en las 4 aristas",
                modulo=nombre,
            )
        )
        piezas.extend(
            cajon(
                nombre="cajón",
                ancho_exterior=ancho_caja,
                largo=largo_corredera,
                alto=alto_caja,
                espesor=params.espesor,
                material=material,
                canto=canto,
                modulo=nombre,
            )
        )

    accesorios = [
        Accesorio(
            nombre="Corredera",
            cantidad=params.cajones,
            nota=f"Un par por cajón, largo {largo_corredera:.0f} mm",
        ),
        Accesorio(nombre="Tirador o manija", cantidad=params.cajones),
        Accesorio(nombre="Tornillo 4 x 50 mm", nota="Armado de costados, base y tapa"),
    ]

    return Modulo(
        tipo="cajonera",
        nombre=nombre,
        medidas={
            "ancho": params.ancho,
            "alto": params.alto,
            "fondo": params.fondo,
            "cajones": params.cajones,
            "ancho_interior": ancho_interior,
            "largo_caja_cajon": largo_corredera,
        },
        piezas=piezas,
        accesorios=accesorios,
        notas=notas,
    )
