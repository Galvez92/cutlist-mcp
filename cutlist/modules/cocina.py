"""Mueble bajo de cocina (bajo mesada) paramétrico.

Medidas de referencia: ARAUCO, *Cómo Diseñar y Construir Correctamente una
Cocina* (serie Cómo Hacer 17)
(https://arauco.com/archivos_bim/17_16486_pdf_sch_foll-web_muebleria_como_disenar_cocina_chile_11may_16-pdf_374_so1.pdf).
De ahí se toman los valores por omisión: 900 mm del piso a la cubierta,
600 mm de profundidad total del módulo (= 580 mm de costado + 18 mm de puerta),
zócalo retranqueado con 100 a 150 mm libres bajo el módulo, retranqueo del
zócalo de 75 mm respecto del borde de las puertas, trasera de 3 mm y puertas de
18 mm.

Geometría (mm)
--------------
- ``alto`` es del piso a la cara superior de la cubierta; ``cubierta_espesor``
  se descuenta y el mesón no es una pieza de melamina del módulo (0 = sin mesón).
- ``fondo`` es la profundidad total: ``fondo - espesor_puerta`` es el costado.
- Cuerpo: 2 costados, base entre costados, travesaño frontal y trasero de
  100 mm de alto arriba (como los travesaños del fixture Cortecloud), trasera de
  3 mm y zócalo (frente y dos laterales).
- Frente: puertas cubrientes o, si ``cajones > 0``, frentes de cajón (no se
  combinan puertas y cajones en el mismo módulo).
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
    "alto": "Alto del piso a la cara superior de la cubierta (mm)",
    "fondo": "Profundidad total del módulo, costado + puerta (mm)",
    "zocalo": "Altura libre bajo el módulo / zócalo (mm)",
    "retranqueo_zocalo": "Retranqueo del zócalo respecto del borde de las puertas (mm)",
    "cubierta_espesor": "Espesor del mesón sobre el módulo (mm); 0 = sin mesón",
    "puertas": "Cantidad de puertas cubrientes (0 si lleva cajones)",
    "cajones": "Cantidad de cajones (0 si lleva puertas)",
    "espesor": "Espesor del tablero del cuerpo (mm)",
    "espesor_puerta": "Espesor del tablero de puertas (mm)",
    "trasera_espesor": "Espesor de la trasera (mm); 0 = sin trasera",
    "juego": "Holgura entre puertas o frentes (mm) — por revisar",
    "juego_corredera": "Juego lateral total de la corredera (mm) — por revisar",
    "margen_alto_cajon": "Diferencia de alto entre frente y caja del cajón (mm) — por revisar",
    "juego_fondo": "Holgura entre el fondo de la caja y la trasera (mm)",
    "material": "Texto del material del cuerpo (como en el despiece)",
    "material_frente": "Texto del material de puertas; vacío = igual al cuerpo",
    "material_trasera": "Texto del material de la trasera",
    "canto": "Texto del canto de las aristas vistas del cuerpo",
    "canto_frente": "Texto del canto de las puertas; vacío = igual al del cuerpo",
    "nombre": "Nombre del módulo para el despiece",
}


@dataclass
class ParamsCocina:
    ancho: float = 600.0
    alto: float = 900.0
    fondo: float = 600.0
    zocalo: float = 100.0
    retranqueo_zocalo: float = 75.0
    cubierta_espesor: float = 0.0
    puertas: int = 2
    cajones: int = 0
    espesor: float = 18.0
    espesor_puerta: float = 18.0
    trasera_espesor: float = 3.0
    juego: float = JUEGO_DEFAULT
    juego_corredera: float = 25.0
    margen_alto_cajon: float = 20.0
    juego_fondo: float = 10.0
    material: str = MATERIAL_DEFAULT
    material_frente: str = ""
    material_trasera: str = MATERIAL_TRASERA_DEFAULT
    canto: str = CANTO_DEFAULT
    canto_frente: str = ""
    nombre: str = ""


def generar(params: ParamsCocina) -> Modulo:
    exigir_positivo(
        ancho=params.ancho,
        alto=params.alto,
        fondo=params.fondo,
        espesor=params.espesor,
        espesor_puerta=params.espesor_puerta,
    )
    if params.zocalo < 0 or params.retranqueo_zocalo < 0:
        raise ValueError("el zócalo y su retranqueo no pueden ser negativos")
    if params.cajones > 0 and params.puertas > 0:
        raise ValueError("este módulo lleva puertas o cajones, no ambos a la vez")
    if params.cajones < 0 or params.puertas < 0:
        raise ValueError("puertas y cajones no pueden ser negativos")

    material, material_frente, canto, canto_frente = frentes(
        params.material, params.material_frente, params.canto, params.canto_frente
    )
    nombre = params.nombre or f"Mueble bajo cocina {params.ancho:.0f}x{params.alto:.0f}"
    alto_carcasa = params.alto - params.zocalo - params.cubierta_espesor
    fondo_costado = params.fondo - params.espesor_puerta
    ancho_interior = params.ancho - 2 * params.espesor
    if alto_carcasa <= 0:
        raise ValueError("el zócalo y la cubierta dejan alto de carcasa no positivo")
    if fondo_costado <= 0:
        raise ValueError("el espesor de puerta no deja profundidad de costado")
    if ancho_interior <= 0:
        raise ValueError("el ancho exterior no deja interior entre costados")
    if params.trasera_espesor >= fondo_costado:
        raise ValueError("la trasera no puede ocupar toda la profundidad del costado")

    comun = {"espesor": params.espesor, "material": material, "modulo": nombre}
    piezas: list[Pieza] = [
        Pieza(
            nombre="Costado",
            largo=alto_carcasa,
            ancho=fondo_costado,
            cantidad=2,
            rol="costado",
            cantos=Cantos(largo_a=canto),
            funcion="Costado — canto en la arista frontal",
            **comun,
        ),
        Pieza(
            nombre="Base",
            largo=fondo_costado,
            ancho=ancho_interior,
            rol="base",
            cantos=Cantos(ancho_a=canto),
            funcion="Base entre costados — canto en la arista frontal",
            **comun,
        ),
        Pieza(
            nombre="Travesaño frontal",
            largo=ancho_interior,
            ancho=ALTO_TRAVESAÑO_DEFAULT,
            rol="travesaño",
            funcion="Barra de armar frontal, arriba entre costados",
            **comun,
        ),
        Pieza(
            nombre="Travesaño trasero",
            largo=ancho_interior,
            ancho=ALTO_TRAVESAÑO_DEFAULT,
            rol="travesaño",
            funcion="Barra de armar trasera, arriba entre costados",
            **comun,
        ),
    ]

    if params.zocalo > 0:
        largo_lateral = fondo_costado - params.retranqueo_zocalo
        if largo_lateral <= 0:
            raise ValueError("el retranqueo del zócalo es mayor que el fondo del costado")
        piezas.extend(
            [
                Pieza(
                    nombre="Zócalo frontal",
                    largo=params.ancho,
                    ancho=params.zocalo,
                    rol="zocalo",
                    cantos=Cantos(largo_a=canto),
                    funcion="Zócalo frontal — canto en la arista superior",
                    **comun,
                ),
                Pieza(
                    nombre="Zócalo lateral",
                    largo=largo_lateral,
                    ancho=params.zocalo,
                    cantidad=2,
                    rol="zocalo",
                    funcion="Zócalo lateral, retranqueado al frente",
                    **comun,
                ),
            ]
        )

    if params.trasera_espesor > 0:
        piezas.append(
            Pieza(
                nombre="Trasera",
                largo=alto_carcasa,
                ancho=params.ancho,
                espesor=params.trasera_espesor,
                material=params.material_trasera,
                rol="trasera",
                veta="indiferente",
                funcion="Trasera clavada al dorso del módulo",
                modulo=nombre,
            )
        )

    notas = [
        f"Alto de carcasa {alto_carcasa:.0f} mm: {params.zocalo:.0f} mm de zócalo y "
        f"{params.cubierta_espesor:.0f} mm de mesón.",
        f"Profundidad de costado {fondo_costado:.0f} mm y {params.espesor_puerta:.0f} mm "
        "de puerta (criterio de 600 mm totales de ARAUCO #17).",
        f"Zócalo retranqueado {params.retranqueo_zocalo:.0f} mm del borde de las puertas "
        "(ARAUCO #17 pide mínimo 75 mm).",
        "El mesón y los artefactos no son piezas de este módulo.",
    ]
    accesorios: list[Accesorio] = [
        Accesorio(nombre="Pata regulable", cantidad=4, nota="Cerradas por el zócalo"),
        Accesorio(nombre="Tornillo 4 x 50 mm", nota="Armado de costados, base y travesaños"),
    ]

    if params.cajones > 0:
        ancho_caja = ancho_interior - params.juego_corredera
        if ancho_caja <= 2 * params.espesor:
            raise ValueError("el juego de corredera no deja ancho útil en la caja del cajón")
        fondo_util = fondo_costado - params.trasera_espesor - params.juego_fondo
        largo_corredera, estandar = elegir_corredera(fondo_util)
        if not estandar:
            notas.append(
                f"Cajón de {largo_corredera:.0f} mm de fondo: no calza ninguna corredera "
                "de 400/450/500 mm (ARAUCO #17); por revisar el catálogo."
            )
        for numero, alto_frente in enumerate(
            repartir(alto_carcasa, params.cajones, params.juego), start=1
        ):
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
                    espesor=params.espesor_puerta,
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
        accesorios.append(
            Accesorio(
                nombre="Corredera",
                cantidad=params.cajones,
                nota=f"Un par por cajón, largo {largo_corredera:.0f} mm",
            )
        )
        accesorios.append(Accesorio(nombre="Tirador o manija", cantidad=params.cajones))
    elif params.puertas > 0:
        alto_puerta = alto_carcasa - params.juego
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
                funcion="Puerta cubriente — canto en las 4 aristas",
                modulo=nombre,
            )
        )
        bisagras = 2 if alto_puerta <= 900 else 3
        accesorios.append(
            Accesorio(
                nombre="Bisagra",
                cantidad=bisagras * params.puertas,
                nota="Cantidad por alto de puerta — por revisar con el herraje",
            )
        )
        accesorios.append(Accesorio(nombre="Tirador o manija", cantidad=params.puertas))
        notas.append(
            f"Puertas cubrientes de {ancho_puerta:.1f} mm con {params.juego:.0f} mm de "
            "holgura entre ellas (por revisar)."
        )

    return Modulo(
        tipo="cocina",
        nombre=nombre,
        medidas={
            "ancho": params.ancho,
            "alto": params.alto,
            "fondo": params.fondo,
            "zocalo": params.zocalo,
            "alto_carcasa": alto_carcasa,
            "fondo_costado": fondo_costado,
            "ancho_interior": ancho_interior,
        },
        piezas=piezas,
        accesorios=accesorios,
        notas=notas,
    )
