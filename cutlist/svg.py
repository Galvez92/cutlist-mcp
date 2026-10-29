"""Render de un layout a SVG (sólo biblioteca estándar)."""

from __future__ import annotations

from xml.sax.saxutils import escape

from .models import OptimizationResult

COLORS = ("#dbeafe", "#fde68a", "#bbf7d0", "#f5d0fe", "#fecdd3", "#c7d2fe")
HEADER = 100.0
GAP = 140.0


def render_svg(result: OptimizationResult) -> str:
    """Un SVG con todos los tableros, en coordenadas milimétricas."""
    if not result.layouts:
        return (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 120" width="100%">'
            '<text x="16" y="48" font-size="28" fill="#334155" '
            'font-family="system-ui, sans-serif">Sin tableros utilizados</text></svg>'
        )

    width = max(layout.sheet.width for layout in result.layouts)
    total_height = sum(HEADER + layout.sheet.height for layout in result.layouts) + GAP * (
        len(result.layouts) - 1
    )

    body: list[str] = []
    offset = 0.0
    for layout in result.layouts:
        sheet = layout.sheet
        body.append(
            f'<text x="0" y="{offset + HEADER * 0.62:.1f}" font-size="58" fill="#334155" '
            f'font-family="system-ui, sans-serif">Tablero {layout.index} · '
            f"{sheet.width:g}×{sheet.height:g}×{sheet.thickness:g} mm · "
            f"{layout.yield_percent:.1f}% aprovechado · {len(layout.placements)} pieza(s)</text>"
        )
        body.append(
            f'<g transform="translate(0 {offset + HEADER:.1f})">'
            f'<rect x="0" y="0" width="{sheet.width:g}" height="{sheet.height:g}" '
            f'fill="#f8fafc" stroke="#334155" stroke-width="4"/>'
        )
        for placement in layout.placements:
            part = placement.piece.part
            color = COLORS[(placement.piece.number - 1) % len(COLORS)]
            title = escape(
                f"{placement.piece.label} {part.label or 'pieza'} "
                f"{placement.width:g}×{placement.height:g} mm"
                + (" (girada)" if placement.rotated else "")
                + (f" · cantos: {part.edges_text}" if part.edges_text else "")
            )
            body.append(
                f'<g><title>{title}</title>'
                f'<rect class="piece" x="{placement.x:g}" y="{placement.y:g}" '
                f'width="{placement.width:g}" height="{placement.height:g}" '
                f'fill="{color}" stroke="#0f172a" stroke-width="2"/>'
            )
            if placement.width > 180 and placement.height > 90:
                font = max(38.0, min(placement.width, placement.height) * 0.17)
                cx = placement.x + placement.width / 2
                cy = placement.y + placement.height / 2
                body.append(
                    f'<text x="{cx:g}" y="{cy - font * 0.15:g}" font-size="{font:.1f}" '
                    f'text-anchor="middle" fill="#0f172a" '
                    f'font-family="system-ui, sans-serif">{escape(placement.piece.label)}</text>'
                    f'<text x="{cx:g}" y="{cy + font * 0.85:g}" font-size="{font * 0.8:.1f}" '
                    f'text-anchor="middle" fill="#334155" '
                    f'font-family="system-ui, sans-serif">'
                    f"{placement.width:g}×{placement.height:g}</text>"
                )
            body.append("</g>")
        body.append("</g>")
        offset += HEADER + sheet.height + GAP

    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:g} {total_height:g}" '
        f'width="100%" font-family="system-ui, sans-serif">' + "".join(body) + "</svg>"
    )
