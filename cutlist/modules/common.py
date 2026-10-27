"""Piezas, repartos y mecanizados que comparten los generadores de módulos.

Valores de referencia usados aquí y su origen
---------------------------------------------
- ``ALTO_TRAVESAÑO`` 100 mm: travesaños del despiece real de Cortecloud en
  `tests/fixtures/cortecloud/escritorio_D_simple.json` («Travesaño trasero», 100
  mm de ancho).
- ``LARGOS_CORREDERA`` 400/450/500 mm: ARAUCO, *Cómo Diseñar y Construir
  Correctamente una Cocina* (serie Cómo Hacer 17), que menciona correderas
  tradicionales de 40, 50 y 60 cm.
- ``DISTANCIA_BARRENO_BORDE`` 40–50 mm, ``PASO_BARRENOS_REPISA`` 30 mm y el
  criterio de «una posición y dos o tres hacia arriba y hacia abajo»: ARAUCO,
  *Cómo Instalar Repisas* (serie Cómo Hacer 6).
- ``JUEGO_DEFAULT``, ``juego_corredera``, ``margen_alto_cajon`` y la profundidad
  del barreno de repisa son valores de taller: **por revisar** contra el herraje
  real antes de fabricar (ver `docs/modulos-parametricos.md`).
"""

from __future__ import annotations

from typing import Sequence

from cutlist.parts import Barreno, Cantos, Mecanizado, Pieza

MATERIAL_DEFAULT = "Melamina 18 mm"
CANTO_DEFAULT = "PVC 0.4 mm"
MATERIAL_TRASERA_DEFAULT = "MDF 3 mm"

JUEGO_DEFAULT = 3.0
ALTO_TRAVESAÑO_DEFAULT = 100.0
LARGOS_CORREDERA = (400.0, 450.0, 500.0)
DISTANCIA_BARRENO_BORDE = 50.0
PASO_BARRENOS_REPISA = 30.0
BARRENOS_POR_POSICION = 5
DIAMETRO_BARRENO_REPISA = 5.0
PROFUNDIDAD_BARRENO_REPISA = 12.0


def repartir(total: float, cantidad: int, juego: float) -> list[float]:
    """Reparte ``total`` en ``cantidad`` tramos iguales con ``cantidad - 1`` juegos.

    Es el reparto de puertas cubrientes a lo ancho y de frentes de cajón a lo
    alto: ``largo = (total - (cantidad - 1) * juego) / cantidad``.
    """
    if cantidad <= 0:
        raise ValueError("la cantidad de tramos debe ser mayor que cero")
    return [(total - (cantidad - 1) * juego) / cantidad for _ in range(cantidad)]


def posiciones_repisas(cantidad: int, desde: float, hasta: float) -> list[float]:
    """Posiciones de ``cantidad`` repisas repartidas entre ``desde`` y ``hasta``.

    Devuelve las alturas de cada repisa (mm, relativas al mismo origen que
    ``desde`` y ``hasta``). Se usa cuando no se entregan posiciones explícitas.
    """
    if cantidad <= 0:
        return []
    if hasta <= desde:
        raise ValueError("el interior del módulo no tiene altura útil")
    paso = (hasta - desde) / (cantidad + 1)
    return [desde + paso * i for i in range(1, cantidad + 1)]


def elegir_corredera(
    disponible: float, largos: Sequence[float] = LARGOS_CORREDERA
) -> tuple[float, bool]:
    """Largo de corredera a usar: el mayor estándar que quepa.

    Devuelve ``(largo, es_estandar)``. Si ninguno de los largos conocidos cabe,
    usa ``disponible`` y avisa (el catálogo del herraje es *por revisar*).
    """
    candidatos = [largo for largo in largos if largo <= disponible]
    if candidatos:
        return (max(candidatos), True)
    return (max(disponible, 0.0), False)


def frentes(material: str, material_frente: str, canto: str, canto_frente: str) -> tuple[str, str, str, str]:
    """Completa los valores de frente: vacío = igual al cuerpo."""
    return (
        material,
        material_frente or material,
        canto,
        canto_frente or canto,
    )


def cajon(
    nombre: str,
    ancho_exterior: float,
    largo: float,
    alto: float,
    espesor: float,
    material: str,
    canto: str,
    modulo: str = "",
) -> list[Pieza]:
    """Caja de cajón de 5 líneas, según el despiece real del fixture Cortecloud.

    El fixture trae, para un cajón de 438 mm de ancho exterior: laterales
    ``450 x 75`` (2), frente interior y trasera ``402 x 75`` (= ancho exterior
    menos los dos laterales) y piso ``450 x 438`` (bajo la caja, del tamaño
    exterior). El canto va solo en la arista superior de los laterales.
    """
    ancho_entre_laterales = ancho_exterior - 2 * espesor
    if ancho_entre_laterales <= 0:
        raise ValueError("el cajón no tiene ancho útil entre laterales")
    if alto <= 0 or largo <= 0:
        raise ValueError("el cajón necesita largo y alto mayores que cero")

    comun = {
        "espesor": espesor,
        "material": material,
        "veta": "largo",
        "modulo": modulo,
        "rol": "cajon",
    }
    return [
        Pieza(
            nombre=f"Lateral {nombre}",
            largo=largo,
            ancho=alto,
            cantidad=2,
            cantos=Cantos(largo_a=canto),
            funcion="Lateral de cajón: canto en la arista superior",
            **comun,
        ),
        Pieza(
            nombre=f"Frente interior {nombre}",
            largo=ancho_entre_laterales,
            ancho=alto,
            funcion="Frente interior de cajón, entre laterales (bajo el frente cubriente)",
            **comun,
        ),
        Pieza(
            nombre=f"Trasera {nombre}",
            largo=ancho_entre_laterales,
            ancho=alto,
            funcion="Trasera de cajón, entre laterales",
            **comun,
        ),
        Pieza(
            nombre=f"Piso {nombre}",
            largo=largo,
            ancho=ancho_exterior,
            funcion="Piso de cajón, clavado/atornillado bajo la caja",
            **comun,
        ),
    ]


def barrenos_repisa(
    posiciones: Sequence[float],
    distancia_borde: float = DISTANCIA_BARRENO_BORDE,
    paso: float = PASO_BARRENOS_REPISA,
    por_posicion: int = BARRENOS_POR_POSICION,
    profundidad: float = PROFUNDIDAD_BARRENO_REPISA,
) -> Mecanizado:
    """Barrenos Ø5 para soportes de repisa móvil (ARAUCO #6).

    Por cada posición de repisa: la posición y ``por_posicion // 2`` arriba y
    abajo, separadas ``paso`` mm, a ``distancia_borde`` mm del borde frontal del
    costado. La profundidad del barreno es **por revisar** contra el soporte real.
    """
    barrenos: list[Barreno] = []
    medio = por_posicion // 2
    for posicion in posiciones:
        for salto in range(-medio, medio + 1):
            y = posicion + salto * paso
            if y <= 0:
                continue
            barrenos.append(
                Barreno(
                    cara="i",
                    x=distancia_borde,
                    y=y,
                    profundidad=profundidad,
                    diametro=DIAMETRO_BARRENO_REPISA,
                    horizontal=False,
                )
            )
    return Mecanizado(barrenos=tuple(barrenos))


def exigir_positivo(**valores: float) -> None:
    """Falla temprano con un mensaje claro si una medida no es positiva."""
    for nombre, valor in valores.items():
        if valor <= 0:
            raise ValueError(f"{nombre} debe ser mayor que cero (recibido {valor})")
