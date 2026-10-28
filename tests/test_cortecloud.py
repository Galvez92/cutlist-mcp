"""Pruebas del importador de Cortecloud contra la muestra real."""

import json
from pathlib import Path

import pytest

from cutlist.importers.cortecloud import (
    CortecloudImportError,
    parse_cortecloud,
    stock_from_material,
)

FIXTURE = Path(__file__).parent / "fixtures" / "cortecloud" / "escritorio_D_simple.json"


@pytest.fixture
def document():
    return parse_cortecloud(json.loads(FIXTURE.read_text(encoding="utf-8")))


def test_reads_real_fixture(document):
    assert len(document.parts) == 21
    assert sum(part.qty for part in document.parts) == 30
    assert len(document.stocks) == 2


def test_stock_comes_from_material_name(document):
    stocks = {stock.material: stock for stock in document.stocks}
    roble = stocks["Roble Americano 2 C 18 mm 719L ARAUCO (2500x1830)"]
    assert (roble.length, roble.width, roble.thickness) == (2500, 1830, 18)


def test_parts_keep_measures_and_edges(document):
    first = document.parts[0]
    assert (first.length, first.width) == (732, 600)
    assert first.qty == 1
    assert first.edges["c1"].startswith("PVC 719L")
    assert "c2" not in first.edges
    assert first.ref.startswith("D01-")


def test_warns_about_unverified_grain(document):
    assert any("veta" in warning for warning in document.warnings)


def test_rejects_file_without_parts():
    with pytest.raises(CortecloudImportError):
        parse_cortecloud({"items": []})


def test_rejects_material_without_sheet_size():
    with pytest.raises(CortecloudImportError):
        stock_from_material("MDF blanco 18 mm")


def test_rejects_non_numeric_measure():
    with pytest.raises(CortecloudImportError):
        parse_cortecloud(
            {
                "parts": [
                    {
                        "quantity": 1,
                        "c": "ancho",
                        "l": 600,
                        "material": "MDF 18 mm (2500x1830)",
                    }
                ]
            }
        )
