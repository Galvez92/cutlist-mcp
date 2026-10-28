"""Dibujo SVG de una hoja con sus piezas."""

from __future__ import annotations

from ..models import SheetLayout

PALETTE = [
    "#c98b4b",
    "#7d9b76",
    "#b5695f",
    "#7f8fa6",
    "#b9a05c",
    "#8a7aa0",
    "#5f9b9b",
    "#a97f52",
]


def _escape(text: str) -> str:
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _fmt(value: float) -> str:
    return f"{value:g}"


def sheet_svg(sheet: SheetLayout, target_px: int = 900, padding: int = 6) -> str:
    """SVG de la hoja a escala, con referencia y medidas por pieza."""
    stock = sheet.stock
    scale = (target_px - padding * 2) / max(stock.length, stock.width)
    width = stock.length * scale + padding * 2
    height = stock.width * scale + padding * 2

    parts: list[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width:.0f}" height="{height:.0f}" '
        f'viewBox="0 0 {width:.1f} {height:.1f}" role="img" '
        f'aria-label="{_escape(stock.material)} hoja {sheet.index}">',
        '<rect width="100%" height="100%" fill="#f4efe7"/>',
        f'<g transform="translate({padding},{padding})">',
        f'<rect width="{stock.length * scale:.2f}" height="{stock.width * scale:.2f}" '
        'fill="#fbf8f2" stroke="#8c7f6c" stroke-width="1.5"/>',
    ]

    for position, placed in enumerate(sheet.placements):
        x = placed.x * scale
        y = placed.y * scale
        w = placed.length * scale
        h = placed.width * scale
        color = PALETTE[position % len(PALETTE)]
        parts.append(
            f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" '
            f'fill="{color}" fill-opacity="0.85" stroke="#3f3a33" stroke-width="0.8"/>'
        )
        label = f"{placed.ref}{' ↻' if placed.rotated else ''}"
        dims = f"{_fmt(placed.length)}×{_fmt(placed.width)}"
        size = max(7.0, min(15.0, min(w, h) * 0.22))
        cx = x + w / 2
        cy = y + h / 2
        parts.append(
            f'<text x="{cx:.2f}" y="{cy:.2f}" font-family="system-ui, sans-serif" '
            f'font-size="{size:.1f}" font-weight="600" fill="#1f1b16" '
            f'text-anchor="middle" dominant-baseline="middle">{_escape(label)}</text>'
        )
        if h > size * 2.2 and w > size * 3:
            parts.append(
                f'<text x="{cx:.2f}" y="{cy + size * 1.2:.2f}" font-family="system-ui, sans-serif" '
                f'font-size="{size * 0.85:.1f}" fill="#1f1b16" fill-opacity="0.75" '
                f'text-anchor="middle" dominant-baseline="middle">{dims}</text>'
            )

    parts.append("</g>")
    parts.append("</svg>")
    return "".join(parts)
