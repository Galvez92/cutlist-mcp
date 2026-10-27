"""cutlist-mcp: motor de corte de tableros y módulos paramétricos.

Esta entrega cubre la capa de **módulos paramétricos**: convierte medidas e ideas
en piezas con cantos y veta, y las puede validar contra un perfil de
restricciones opcional (por ejemplo el perfil Cortecloud/Madijal de la MEMORIA).

    >>> from cutlist.spec import construir_desde_texto
    >>> modulo = construir_desde_texto("cajonera ancho=450 alto=800 fondo=500 cajones=4")
    >>> print(modulo.tabla())
"""

from cutlist.modulo import Accesorio, Modulo
from cutlist.parts import Barreno, Cantos, Mecanizado, Pieza, Ranura, resumen, tabla, totales
from cutlist.profiles import (
    PERFIL_CORTECLOUD_MADIJAL,
    PERFILES,
    Hallazgo,
    PerfilRestricciones,
    validar,
    validar_pieza,
)

__all__ = [
    "Accesorio",
    "Barreno",
    "Cantos",
    "Hallazgo",
    "Mecanizado",
    "Modulo",
    "PERFILES",
    "PERFIL_CORTECLOUD_MADIJAL",
    "PerfilRestricciones",
    "Pieza",
    "Ranura",
    "resumen",
    "tabla",
    "totales",
    "validar",
    "validar_pieza",
]
