"""Reporte PDF de una optimización (sólo biblioteca estándar).

El PDF se arma a mano: objetos, páginas A4, un `stream` de texto por página y
la tabla `xref`. Se usan las fuentes base Helvetica (normal y negrita) y
Courier para las tablas, con codificación WinAnsi para que los acentos y las
medidas (`×`, `°`) se vean bien. Estructura según la especificación PDF 1.7
(ISO 32000-1), sin comprimir los streams para poder verificarlos en las pruebas.

El reporte incluye:

- resumen: aprovechamiento, tableros usados, piezas ubicadas y sin ubicar;
- tabla de tableros utilizados (material, medidas, espesor, kerf, piezas);
- piezas por tablero con sus **medidas finales** (después de girar la pieza),
  su posición de corte y su etiqueta;
- lista de corte agrupada y los avisos del perfil de restricciones.
"""

from __future__ import annotations

from .models import OptimizationResult

A4_WIDTH = 595.276
A4_HEIGHT = 841.89
MARGIN = 40.0
CONTENT_WIDTH = A4_WIDTH - 2 * MARGIN

REGULAR = "F1"
BOLD = "F2"
MONO = "F3"
FONTS = (
    (REGULAR, "Helvetica"),
    (BOLD, "Helvetica-Bold"),
    (MONO, "Courier"),
)
MONO_RATIO = 0.6  # ancho de un carácter de Courier, en em
REGULAR_RATIO = 0.5


def render_pdf(
    result: OptimizationResult,
    source: str = "",
    generated: str | None = None,
) -> bytes:
    """Un PDF con el resumen de tableros y las medidas finales de las piezas."""
    document = _Document()
    document.line("cutlist-mcp · reporte de corte", BOLD, 16, gap=24)
    subtitle = " · ".join(part for part in (f"Fuente: {source}" if source else "",) if part)
    if generated:
        subtitle = f"{subtitle} · {generated}" if subtitle else generated
    if subtitle:
        document.line(subtitle, REGULAR, 9, gap=14, gray=True)

    document.line("Resumen", BOLD, 12, gap=20)
    for label, value in _summary_rows(result):
        document.line(f"{label}: {value}", REGULAR, 10, gap=13)

    document.line("Tableros utilizados", BOLD, 12, gap=22)
    document.table_header(
        ["#", "Material", "Medidas (mm)", "Espesor", "Kerf", "Piezas", "Aprov."],
        [26, 150, 100, 50, 40, 44, 90],
    )
    if result.layouts:
        for layout in result.layouts:
            sheet = layout.sheet
            document.table_row(
                [
                    str(layout.index),
                    sheet.material or "comodín",
                    f"{sheet.width:g} x {sheet.height:g}",
                    f"{sheet.thickness:g} mm",
                    f"{sheet.kerf:g} mm",
                    str(len(layout.placements)),
                    f"{_decimal(layout.yield_percent)} %",
                ],
                [26, 150, 100, 50, 40, 44, 90],
            )
    else:
        document.line("No se usó ningún tablero.", REGULAR, 9, gap=13)

    if result.layouts:
        document.line("Piezas por tablero (medidas finales)", BOLD, 12, gap=22)
        for layout in result.layouts:
            sheet = layout.sheet
            document.line(
                f"Tablero {layout.index} · {sheet.material or 'comodín'} · "
                f"{sheet.width:g} x {sheet.height:g} x {sheet.thickness:g} mm "
                f"(kerf {sheet.kerf:g} mm)",
                BOLD,
                9,
                gap=15,
            )
            document.table_header(
                ["Pieza", "Etiqueta", "Medida final", "Posición", "Giro"],
                [46, 190, 100, 110, 60],
            )
            for placement in layout.placements:
                part = placement.piece.part
                document.table_row(
                    [
                        placement.piece.label,
                        part.label or "pieza",
                        f"{placement.width:g} x {placement.height:g} mm",
                        f"({placement.x:g}, {placement.y:g})",
                        "sí" if placement.rotated else "no",
                    ],
                    [46, 190, 100, 110, 60],
                )

    document.line("Lista de corte", BOLD, 12, gap=22)
    if result.cut_list:
        document.table_header(
            ["Medida (mm)", "Cant.", "Etiqueta", "Veta", "Cantos"],
            [110, 40, 190, 50, 110],
        )
        for row in result.cut_list:
            document.table_row(
                [
                    f"{row.width:g} x {row.height:g}",
                    str(row.quantity),
                    row.label or "pieza",
                    "sí" if row.grain else "no",
                    row.edges or "—",
                ],
                [110, 40, 190, 50, 110],
            )
    else:
        document.line("Sin piezas ubicadas.", REGULAR, 9, gap=13)

    if result.unplaced:
        document.line("Piezas sin ubicar", BOLD, 12, gap=22)
        document.paragraph(", ".join(piece.label for piece in result.unplaced))

    if result.invalid:
        document.line("Piezas no cortadas", BOLD, 12, gap=22)
        document.paragraph(
            "mecanizado fuera del área de la pieza: "
            + ", ".join(piece.label or "pieza" for piece in result.invalid)
        )

    if result.warnings:
        document.line("Avisos", BOLD, 12, gap=22)
        for warning in result.warnings:
            document.paragraph(f"- {warning}")

    return _serialize(document.pages)


def _summary_rows(result: OptimizationResult) -> list[tuple[str, str]]:
    materials = _materials(result)
    rows = [
        ("Aprovechamiento", f"{_decimal(result.yield_percent)} %"),
        ("Tableros usados", str(len(result.layouts))),
        ("Piezas ubicadas", str(result.piece_count)),
        ("Piezas sin ubicar", str(len(result.unplaced))),
        ("Algoritmo", result.algorithm),
    ]
    if result.invalid:
        rows.insert(-1, ("Piezas no cortadas", str(len(result.invalid))))
    if materials:
        rows.append(("Materiales", materials))
    return rows


def _materials(result: OptimizationResult) -> str:
    names: list[str] = []
    for layout in result.layouts:
        name = layout.sheet.material or "comodín"
        if name not in names:
            names.append(name)
    return ", ".join(names)


def _decimal(value: float) -> str:
    return f"{value:.1f}".replace(".", ",")


def _escape(text: str) -> str:
    data = str(text).encode("cp1252", "replace").decode("latin-1")
    return data.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _fit(text: str, width_pt: float, size: float, ratio: float) -> str:
    text = " ".join(str(text).split())
    limit = max(3, int(width_pt / (size * ratio)) - 1)
    return text if len(text) <= limit else text[: limit - 2] + ".."


class _Page:
    """Una página: operaciones del stream de contenido."""

    def __init__(self) -> None:
        self.operations: list[str] = []

    def text(self, x: float, y: float, text: str, font: str, size: float, gray: bool) -> None:
        color = "0.35 0.4 0.47 rg" if gray else "0 g"
        self.operations.append(
            f"{color} BT /{font} {size:g} Tf 1 0 0 1 {x:.2f} {y:.2f} Tm "
            f"({_escape(text)}) Tj ET"
        )

    def rule(self, x1: float, y: float, x2: float) -> None:
        self.operations.append(
            f"0.35 0.4 0.47 RG 0.4 w {x1:.2f} {y:.2f} m {x2:.2f} {y:.2f} l S"
        )


class _Document:
    """Flujo de texto paginado sobre hojas A4."""

    def __init__(self) -> None:
        self.pages: list[_Page] = []
        self.page = _Page()
        self.pages.append(self.page)
        self.y = A4_HEIGHT - MARGIN

    def _ensure(self, height: float) -> None:
        if self.y - height < MARGIN:
            self.page = _Page()
            self.pages.append(self.page)
            self.y = A4_HEIGHT - MARGIN

    def line(
        self,
        text: str,
        font: str = REGULAR,
        size: float = 10,
        gap: float = 13,
        gray: bool = False,
        indent: float = 0.0,
    ) -> None:
        self._ensure(gap)
        self.y -= gap
        self.page.text(MARGIN + indent, self.y, text, font, size, gray)

    def table_header(self, cells: list[str], widths: list[float]) -> None:
        self._ensure(13)
        self._row(cells, widths, BOLD, 8)
        self.page.rule(MARGIN, self.y - 3, MARGIN + sum(widths))

    def table_row(self, cells: list[str], widths: list[float], font: str = MONO) -> None:
        self._row(cells, widths, font, 8)

    def _row(self, cells: list[str], widths: list[float], font: str, size: float) -> None:
        self._ensure(11)
        self.y -= 12
        x = MARGIN
        for cell, width in zip(cells, widths):
            if cell:
                self.page.text(x, self.y, _fit(cell, width - 4, size, MONO_RATIO), font, size, False)
            x += width

    def paragraph(self, text: str, size: float = 9) -> None:
        limit = max(20, int(CONTENT_WIDTH / (size * REGULAR_RATIO)))
        words = str(text).split()
        line = ""
        for word in words:
            candidate = f"{line} {word}".strip()
            if len(candidate) > limit and line:
                self.line(line, REGULAR, size, gap=13)
                line = word
            else:
                line = candidate
        if line:
            self.line(line, REGULAR, size, gap=13)


def _serialize(pages: list[_Page]) -> bytes:
    """Arma los objetos, el `xref` y el `trailer` de un PDF 1.4."""
    objects: list[bytes] = []

    def add(body: bytes) -> int:
        objects.append(body)
        return len(objects)

    catalog_id = add(b"")
    pages_id = add(b"")
    font_ids = {}
    for name, base in FONTS:
        font_ids[name] = add(
            f"<< /Type /Font /Subtype /Type1 /BaseFont /{base} "
            f"/Encoding /WinAnsiEncoding >>".encode("ascii")
        )

    page_ids: list[int] = []
    for page in pages:
        content = "\n".join(page.operations).encode("latin-1")
        content_id = add(
            b"<< /Length "
            + str(len(content)).encode("ascii")
            + b" >>\nstream\n"
            + content
            + b"\nendstream"
        )
        fonts = " ".join(f"/{name} {ident} 0 R" for name, ident in font_ids.items())
        page_ids.append(
            add(
                f"<< /Type /Page /Parent {pages_id} 0 R "
                f"/MediaBox [0 0 {A4_WIDTH:.2f} {A4_HEIGHT:.2f}] "
                f"/Resources << /Font << {fonts} >> >> "
                f"/Contents {content_id} 0 R >>".encode("ascii")
            )
        )

    objects[catalog_id - 1] = f"<< /Type /Catalog /Pages {pages_id} 0 R >>".encode("ascii")
    kids = " ".join(f"{page_id} 0 R" for page_id in page_ids)
    objects[pages_id - 1] = (
        f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>".encode("ascii")
    )

    out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0] * (len(objects) + 1)
    for number, body in enumerate(objects, start=1):
        offsets[number] = len(out)
        out += f"{number} 0 obj\n".encode("ascii") + body + b"\nendobj\n"

    xref_at = len(out)
    out += f"xref\n0 {len(objects) + 1}\n".encode("ascii")
    out += b"0000000000 65535 f \n"
    for number in range(1, len(objects) + 1):
        out += f"{offsets[number]:010d} 00000 n \n".encode("ascii")
    out += (
        f"trailer\n<< /Size {len(objects) + 1} /Root {catalog_id} 0 R >>\n"
        f"startxref\n{xref_at}\n%%EOF\n"
    ).encode("ascii")
    return bytes(out)
