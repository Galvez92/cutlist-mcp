"""cutlist-mcp — piezas y listas de corte.

Paquete base del optimizador de corte de tableros: modelo de datos y
importadores/exportadores de formatos. El motor de nesting y el servidor MCP
llegan en otras ramas del proyecto.
"""

from .model import (
    Aviso,
    Colocacion,
    ErrorDato,
    Fuente,
    Hoja,
    Layout,
    ListaCorte,
    PARCIAL,
    Pieza,
    POR_REVISAR,
    VERIFICADO,
)

__version__ = "0.1.0"

__all__ = [
    "Aviso",
    "Colocacion",
    "ErrorDato",
    "Fuente",
    "Hoja",
    "Layout",
    "ListaCorte",
    "PARCIAL",
    "POR_REVISAR",
    "Pieza",
    "VERIFICADO",
    "__version__",
]
