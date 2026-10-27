"""DXF (ASCII) — exportación de layouts de corte y lectura de contornos.

Documentación pública consultada (DXF Reference de Autodesk):

- Sección ENTITIES: https://help.autodesk.com/view/ACD/2023/ENU/?guid=GUID-7D07C886-FD1D-4A0C-A7AB-B4D21F18E484
- Entidad POLYLINE (códigos 66 «vertices follow» y 70 bit 1 «closed»):
  https://help.autodesk.com/view/ACD/2023/ENU/?guid=GUID-ABF6B778-BE20-4B49-9B58-A94E64CEFFF3
- Entidad LINE: https://help.autodesk.com/view/ACD/2023/ENU/?guid=GUID-FCEF5726-53AE-4C43-B4EA-C84EB8686A66
- Entidad LWPOLYLINE (sólo lectura):
  https://help.autodesk.com/view/ACD/2023/ENU/?guid=GUID-748FC305-F3F2-4F74-825A-61F04D757A50

Se escribe DXF R12 (``$ACADVER = AC1009``) con pares código/valor, entidades
POLYLINE/VERTEX/SEQEND y TEXT para las etiquetas; ``$INSUNITS = 4`` (milímetros).
Unidades del dibujo: mm.
"""

from __future__ import annotations

from typing import Any

from ..model import ErrorDato, Fuente, Layout, ListaCorte, PARCIAL, Pieza
from .base import DIRECCION_AMBOS, DescriptorFormato, ErrorFormato, propagar_avisos

CLAVE = "dxf"

CAPA_HOJA = "HOJA"
CAPA_PIEZAS = "PIEZAS"
CAPA_ETIQUETAS = "ETIQUETAS"
# Capas propias que no representan piezas (contorno de tablero y etiquetas).
CAPAS_NO_PIEZA = (CAPA_HOJA, CAPA_ETIQUETAS)
COLORES = {CAPA_HOJA: 7, CAPA_PIEZAS: 3, CAPA_ETIQUETAS: 2}
SEPARACION_HOJAS = 50.0
TOLERANCIA = 1e-6

DESCRIPTOR = DescriptorFormato(
    clave=CLAVE,
    nombre="DXF (ASCII, AutoCAD R12)",
    direccion=DIRECCION_AMBOS,
    estado=PARCIAL,
    fuentes=(
        Fuente(
            "https://help.autodesk.com/view/ACD/2023/ENU/?guid=GUID-7D07C886-FD1D-4A0C-A7AB-B4D21F18E484",
            "Autodesk DXF Reference: sección ENTITIES.",
        ),
        Fuente(
            "https://help.autodesk.com/view/ACD/2023/ENU/?guid=GUID-ABF6B778-BE20-4B49-9B58-A94E64CEFFF3",
            "Autodesk DXF Reference: POLYLINE (código 66 y flag 1 = cerrada).",
        ),
        Fuente(
            "https://help.autodesk.com/view/ACD/2023/ENU/?guid=GUID-FCEF5726-53AE-4C43-B4EA-C84EB8686A66",
            "Autodesk DXF Reference: LINE.",
        ),
        Fuente(
            "https://help.autodesk.com/view/ACD/2023/ENU/?guid=GUID-748FC305-F3F2-4F74-825A-61F04D757A50",
            "Autodesk DXF Reference: LWPOLYLINE (sólo se lee).",
        ),
    ),
    por_revisar=(
        "La escritura se limita a R12 (AC1009) con POLYLINE/VERTEX/SEQEND y TEXT; "
        "no se emiten bloques, arcos ni entidades de versiones posteriores.",
        "La lectura sólo reconoce rectángulos alineados a los ejes (polilíneas "
        "cerradas de 4 vértices o 4 LINE que los forman); otros contornos se "
        "ignoran y no se convierten en piezas.",
        "Las capas se usan como grupo de la pieza; no está verificado ningún "
        "convenio de capas de otros programas (PolyBoard, software de CNC).",
        "Al leer se excluyen por defecto las capas propias HOJA y ETIQUETAS; con "
        "DXF de otros programas hay que indicar `solo_capa` o `excluir_capas=()`.",
    ),
    extensiones=(".dxf",),
)


# --------------------------------------------------------------------------- #
# Escritura
# --------------------------------------------------------------------------- #

def _num(valor: float, decimales: int = 3) -> str:
    texto = f"{float(valor):.{decimales}f}"
    if "." in texto:
        texto = texto.rstrip("0").rstrip(".")
    return texto or "0"


def _par(codigo: int, valor: Any, decimales: int = 3) -> str:
    if isinstance(valor, float):
        valor = _num(valor, decimales)
    return f"{codigo}\n{valor}\n"


def _polilinea(capa: str, puntos: list[tuple[float, float]], decimales: int) -> str:
    salida = _par(0, "POLYLINE") + _par(8, capa) + _par(66, 1) + _par(70, 1)
    salida += _par(10, 0.0) + _par(20, 0.0) + _par(30, 0.0)
    for x, y in puntos:
        salida += _par(0, "VERTEX") + _par(8, capa)
        salida += _par(10, x) + _par(20, y) + _par(30, 0.0)
    return salida + _par(0, "SEQEND") + _par(8, capa)


def _rectangulo(capa: str, x: float, y: float, largo: float, ancho: float,
                decimales: int) -> str:
    return _polilinea(
        capa,
        [(x, y), (x + largo, y), (x + largo, y + ancho), (x, y + ancho)],
        decimales,
    )


def _texto(capa: str, x: float, y: float, contenido: str, alto: float,
           decimales: int) -> str:
    return (_par(0, "TEXT") + _par(8, capa) + _par(10, x) + _par(20, y)
            + _par(30, 0.0) + _par(40, alto) + _par(1, contenido))


def exportar_layout(
    layout: Layout,
    *,
    incluir_etiquetas: bool = True,
    incluir_medidas: bool = True,
    alto_texto: float = 40.0,
    decimales: int = 3,
    **_: object,
) -> str:
    """Escribe el layout (hojas con piezas colocadas) como DXF R12 ASCII."""
    if not layout.hojas:
        raise ErrorFormato("el layout no tiene hojas: nada que exportar a DXF")

    salida = _par(0, "SECTION") + _par(2, "HEADER")
    salida += _par(9, "$ACADVER") + _par(1, "AC1009")
    salida += _par(9, "$INSUNITS") + _par(70, 4)
    salida += _par(0, "ENDSEC")

    salida += _par(0, "SECTION") + _par(2, "TABLES")
    salida += _par(0, "TABLE") + _par(2, "LAYER") + _par(70, len(COLORES))
    for capa, color in COLORES.items():
        salida += _par(0, "LAYER") + _par(2, capa) + _par(70, 0) + _par(62, color)
    salida += _par(0, "ENDTAB") + _par(0, "ENDSEC")

    salida += _par(0, "SECTION") + _par(2, "ENTITIES")
    desplazamiento = 0.0
    for hoja in layout.hojas:
        origen_x = desplazamiento
        salida += _rectangulo(CAPA_HOJA, origen_x, 0.0, hoja.largo, hoja.ancho, decimales)
        for indice, colocacion in enumerate(hoja.colocaciones, start=1):
            x = origen_x + colocacion.x
            y = colocacion.y
            salida += _rectangulo(CAPA_PIEZAS, x, y, colocacion.largo, colocacion.ancho,
                                  decimales)
            if incluir_etiquetas:
                identificador = colocacion.identificador or f"{hoja.nombre}-{indice}"
                salida += _texto(CAPA_ETIQUETAS, x + 5.0, y + 5.0, identificador,
                                 alto_texto, decimales)
                if incluir_medidas:
                    medidas = (f"{_num(colocacion.largo, decimales)} x "
                               f"{_num(colocacion.ancho, decimales)}")
                    salida += _texto(CAPA_ETIQUETAS, x + 5.0,
                                     y + 5.0 + alto_texto * 1.2, medidas,
                                     alto_texto, decimales)
        desplazamiento = origen_x + hoja.largo + SEPARACION_HOJAS

    salida += _par(0, "ENDSEC") + _par(0, "EOF")
    return salida


def exportar(objeto: Layout, **opciones: object) -> str:
    """Punto de entrada del registro: el DXF se exporta desde un :class:`Layout`."""
    if not isinstance(objeto, Layout):
        raise ErrorFormato(
            "el DXF se exporta desde un Layout (hojas con piezas colocadas), "
            f"no desde {type(objeto).__name__}"
        )
    return exportar_layout(objeto, **opciones)


# --------------------------------------------------------------------------- #
# Lectura
# --------------------------------------------------------------------------- #

def _pares(texto: str) -> list[tuple[int, str]]:
    lineas = texto.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    while lineas and not lineas[-1].strip():
        lineas.pop()
    pares: list[tuple[int, str]] = []
    for indice in range(0, len(lineas) - 1, 2):
        crudo = lineas[indice].strip()
        if not crudo:
            continue
        try:
            codigo = int(crudo)
        except ValueError as exc:
            raise ErrorFormato(f"código de grupo DXF inválido: {crudo!r}") from exc
        pares.append((codigo, lineas[indice + 1].strip()))
    return pares


def _leer_entidad(pares: list[tuple[int, str]], indice: int) -> tuple[dict[str, Any], int]:
    """Lee los códigos de una entidad hasta el próximo código 0."""
    tipo = pares[indice][1].upper()
    datos: dict[str, Any] = {"tipo": tipo, "capa": None, "flags": 0, "puntos": [],
                             "x2": None, "y2": None, "texto": None}
    j = indice + 1
    while j < len(pares) and pares[j][0] != 0:
        codigo, valor = pares[j]
        try:
            if codigo == 8:
                datos["capa"] = valor
            elif codigo == 70:
                datos["flags"] = int(float(valor))
            elif codigo == 10:
                datos["puntos"].append([float(valor), 0.0])
            elif codigo == 20 and datos["puntos"]:
                datos["puntos"][-1][1] = float(valor)
            elif codigo == 11:
                datos["x2"] = float(valor)
            elif codigo == 21:
                datos["y2"] = float(valor)
            elif codigo == 1:
                datos["texto"] = valor
        except ValueError as exc:
            raise ErrorFormato(
                f"{tipo}: valor no numérico en el código {codigo}: {valor!r}"
            ) from exc
        j += 1
    return datos, j


def _entidades(pares: list[tuple[int, str]]) -> list[dict[str, Any]]:
    entidades: list[dict[str, Any]] = []
    seccion: str | None = None
    indice = 0
    while indice < len(pares):
        codigo, valor = pares[indice]
        if codigo == 2 and seccion is None:
            seccion = valor.upper()
            indice += 1
            continue
        if codigo == 0:
            tipo = valor.upper()
            if tipo == "ENDSEC":
                if seccion == "ENTITIES":
                    break
                seccion = None
                indice += 1
                continue
            if seccion == "ENTITIES" and tipo not in ("SECTION",):
                entidad, indice = _leer_entidad(pares, indice)
                entidades.append(entidad)
                continue
        indice += 1
    return entidades


def _igual(a: list[float], b: list[float], tolerancia: float = TOLERANCIA) -> bool:
    return abs(a[0] - b[0]) <= tolerancia and abs(a[1] - b[1]) <= tolerancia


def _rectangulo_desde_puntos(
    puntos: list[list[float]], tolerancia: float = TOLERANCIA
) -> tuple[float, float, float, float] | None:
    xs = sorted({round(p[0], 6) for p in puntos})
    ys = sorted({round(p[1], 6) for p in puntos})
    if len(xs) != 2 or len(ys) != 2:
        return None
    largo = xs[1] - xs[0]
    ancho = ys[1] - ys[0]
    if largo <= tolerancia or ancho <= tolerancia:
        return None
    return xs[0], ys[0], largo, ancho


def _buscar_vertical(verticales: list[tuple[Any, ...]], x: float, y1: float, y2: float,
                     tolerancia: float = TOLERANCIA) -> tuple[Any, ...] | None:
    for vertical in verticales:
        if (abs(vertical[2] - x) <= tolerancia
                and abs(vertical[3] - min(y1, y2)) <= tolerancia
                and abs(vertical[4] - max(y1, y2)) <= tolerancia):
            return vertical
    return None


def _rectangulos_desde_lineas(
    segmentos: list[tuple[tuple[float, float], tuple[float, float], str | None]],
    tolerancia: float = TOLERANCIA,
) -> list[tuple[str | None, float, float, float, float]]:
    """Arma rectángulos a partir de 4 LINE que comparten extremos."""
    horizontales: list[tuple[int, str | None, float, float, float]] = []
    verticales: list[tuple[int, str | None, float, float, float]] = []
    for indice, (p1, p2, capa) in enumerate(segmentos):
        if abs(p1[1] - p2[1]) <= tolerancia:
            horizontales.append((indice, capa, min(p1[0], p2[0]), max(p1[0], p2[0]), p1[1]))
        elif abs(p1[0] - p2[0]) <= tolerancia:
            verticales.append((indice, capa, p1[0], min(p1[1], p2[1]), max(p1[1], p2[1])))

    usados: set[int] = set()
    rectangulos: list[tuple[str | None, float, float, float, float]] = []
    for a in range(len(horizontales)):
        for b in range(a + 1, len(horizontales)):
            ia, capa_a, x1a, x2a, ya = horizontales[a]
            ib, capa_b, x1b, x2b, yb = horizontales[b]
            if abs(x1a - x1b) > tolerancia or abs(x2a - x2b) > tolerancia:
                continue
            if abs(ya - yb) <= tolerancia:
                continue
            izquierda = _buscar_vertical(verticales, x1a, ya, yb)
            derecha = _buscar_vertical(verticales, x2a, ya, yb)
            if izquierda is None or derecha is None:
                continue
            ids = {ia, ib, izquierda[0], derecha[0]}
            if ids & usados:
                continue
            usados |= ids
            rectangulos.append((capa_a or capa_b, x1a, min(ya, yb), x2a - x1a,
                                abs(ya - yb)))
    return rectangulos


def _texto_dentro(textos: list[tuple[float, float, str]], x: float, y: float,
                  largo: float, ancho: float) -> str | None:
    for tx, ty, contenido in textos:
        if x <= tx <= x + largo and y <= ty <= y + ancho and contenido:
            return contenido
    return None


def importar(
    texto: str,
    *,
    solo_capa: str | None = None,
    excluir_capas: tuple[str, ...] | list[str] = CAPAS_NO_PIEZA,
    **_: object,
) -> ListaCorte:
    """Lee contornos rectangulares (polilíneas cerradas o 4 LINE) de un DXF."""
    entidades = _entidades(_pares(texto))
    if not entidades:
        raise ErrorFormato("el DXF no tiene entidades en la sección ENTITIES")

    textos: list[tuple[float, float, str]] = []
    polilineas: list[dict[str, Any]] = []
    segmentos: list[tuple[tuple[float, float], tuple[float, float], str | None]] = []

    indice = 0
    while indice < len(entidades):
        entidad = entidades[indice]
        tipo = entidad["tipo"]
        if tipo == "TEXT" and entidad["texto"] and entidad["puntos"]:
            punto = entidad["puntos"][0]
            textos.append((punto[0], punto[1], entidad["texto"]))
            indice += 1
            continue
        if tipo in ("LWPOLYLINE", "POLYLINE"):
            if tipo == "POLYLINE":
                puntos: list[list[float]] = []
                cerrada = bool(entidad["flags"] & 1)
                j = indice + 1
                while j < len(entidades) and entidades[j]["tipo"] in ("VERTEX", "SEQEND"):
                    if entidades[j]["tipo"] == "VERTEX" and entidades[j]["puntos"]:
                        puntos.append(entidades[j]["puntos"][0])
                    if entidades[j]["tipo"] == "SEQEND":
                        j += 1
                        break
                    j += 1
                polilineas.append({"capa": entidad["capa"], "cerrada": cerrada,
                                   "puntos": puntos})
                indice = j
                continue
            polilineas.append({
                "capa": entidad["capa"],
                "cerrada": bool(entidad["flags"] & 1),
                "puntos": list(entidad["puntos"]),
            })
            indice += 1
            continue
        if tipo == "LINE" and entidad["puntos"] and entidad["x2"] is not None:
            inicio = entidad["puntos"][0]
            segmentos.append(((inicio[0], inicio[1]), (entidad["x2"], entidad["y2"]),
                              entidad["capa"]))
        indice += 1

    contornos: list[tuple[str | None, float, float, float, float]] = []
    for polilinea in polilineas:
        puntos = list(polilinea["puntos"])
        if len(puntos) > 1 and _igual(puntos[0], puntos[-1]):
            puntos.pop()
        if not polilinea["cerrada"] and len(puntos) < 4:
            continue
        rectangulo = _rectangulo_desde_puntos(puntos)
        if rectangulo is None:
            continue
        x, y, largo, ancho = rectangulo
        contornos.append((polilinea["capa"], x, y, largo, ancho))
    contornos.extend(_rectangulos_desde_lineas(segmentos))

    excluidas = {c.upper() for c in (excluir_capas or ())}
    lista = ListaCorte(metadatos={"formato": CLAVE})
    for numero, (capa, x, y, largo, ancho) in enumerate(contornos, start=1):
        if (capa or "").upper() in excluidas:
            continue
        if solo_capa and (capa or "").upper() != solo_capa.upper():
            continue
        etiqueta = _texto_dentro(textos, x, y, largo, ancho)
        try:
            lista.agregar(Pieza(
                nombre=etiqueta or f"contorno {numero}",
                largo=largo,
                ancho=ancho,
                grupo=capa,
                etiqueta=capa,
                extra={"x": x, "y": y},
            ))
        except ErrorDato as exc:
            raise ErrorFormato(f"contorno {numero}: {exc}") from exc
    if not lista.piezas:
        raise ErrorFormato("no se reconocieron contornos rectangulares en el DXF")
    return propagar_avisos(DESCRIPTOR, lista)
