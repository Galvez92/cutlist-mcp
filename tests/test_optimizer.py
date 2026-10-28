"""Pruebas del motor de nesting."""

from cutlist import Part, StockSheet, optimize

STOCK = StockSheet(material="MDF 18", length=1000, width=600, thickness=18, kerf=4)


def part(ref: str, length: float, width: float, qty: int = 1, grain: bool = False) -> Part:
    return Part(ref=ref, name=ref, length=length, width=width, material="MDF 18", qty=qty, grain=grain)


def overlaps(a, b) -> bool:
    eps = 1e-6
    return (
        a.x < b.x + b.length - eps
        and b.x < a.x + a.length - eps
        and a.y < b.y + b.width - eps
        and b.y < a.y + a.width - eps
    )


def test_places_parts_inside_sheet():
    # Dos piezas de 400x300 caben en una hoja de 1000x600; la tercera no.
    result = optimize([part("A", 400, 300, qty=2)], [STOCK], kerf=4)
    assert len(result.sheets) == 1
    assert result.part_count == 2
    sheet = result.sheets[0]
    for placed in sheet.placements:
        assert 0 <= placed.x
        assert 0 <= placed.y
        assert placed.x + placed.length <= sheet.stock.length + 1e-6
        assert placed.y + placed.width <= sheet.stock.width + 1e-6


def test_no_overlaps_and_kerf_gap():
    parts = [part("A", 300, 200, qty=3), part("B", 450, 180, qty=2)]
    result = optimize(parts, [STOCK], kerf=5)
    placements = [p for sheet in result.sheets for p in sheet.placements]
    assert len(placements) == 5
    for i, first in enumerate(placements):
        for second in placements[i + 1 :]:
            assert not overlaps(first, second)


def test_opens_extra_sheet_when_needed():
    result = optimize([part("A", 900, 500, qty=4)], [STOCK], kerf=4)
    assert result.part_count == 4
    assert len(result.sheets) == 4


def test_rotation_disabled_keeps_orientation():
    result = optimize([part("A", 900, 300)], [STOCK], kerf=4, allow_rotation=False)
    placed = result.sheets[0].placements[0]
    assert placed.length == 900
    assert placed.width == 300


def test_rotation_enabled_can_turn_parts():
    # 550x1000 sólo entra girada en una hoja de 1000x600.
    result = optimize([part("A", 550, 1000)], [STOCK], kerf=4, allow_rotation=True)
    assert result.part_count == 1
    assert result.sheets[0].placements[0].rotated


def test_grain_blocks_rotation():
    result = optimize([part("A", 550, 1000, grain=True)], [STOCK], kerf=4, allow_rotation=True)
    assert result.part_count == 0
    assert len(result.unplaced) == 1


def test_part_larger_than_sheet_is_reported():
    result = optimize([part("A", 1200, 700)], [STOCK], kerf=4)
    assert result.part_count == 0
    assert len(result.unplaced) == 1
    assert "no cabe" in result.unplaced[0]["reason"]


def test_material_without_stock_is_reported():
    orphan = Part(ref="A", name="A", length=100, width=100, material="Otro")
    result = optimize([orphan], [STOCK], kerf=4)
    assert result.part_count == 0
    assert result.unplaced[0]["material"] == "Otro"


def test_yield_and_used_percentage():
    result = optimize([part("A", 500, 300, qty=2)], [STOCK], kerf=0)
    assert result.sheets[0].used_area == 300000
    assert result.sheets[0].used_pct == 50.0
    assert result.yield_pct == 50.0
