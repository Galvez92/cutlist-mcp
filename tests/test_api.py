"""Pruebas de la API y la demo web."""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_index_serves_demo_page():
    response = client.get("/")
    assert response.status_code == 200
    assert "cutlist-mcp" in response.text
    assert "/static/app.js" in response.text


def test_demo_optimizes_sample():
    response = client.get("/api/demo")
    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["parts"] == 30
    assert body["summary"]["sheets"] >= 2
    assert len(body["groups"]) == 2
    sheet = body["groups"][0]["sheets"][0]
    assert sheet["svg"].startswith("<svg")
    assert body["groups"][0]["csv"].startswith("referencia;pieza;material")
    assert 0 < body["summary"]["yield_pct"] <= 100


def test_kerf_reduces_capacity():
    wide = client.get("/api/demo", params={"kerf": 0}).json()
    narrow = client.get("/api/demo", params={"kerf": 20}).json()
    assert narrow["summary"]["yield_pct"] <= wide["summary"]["yield_pct"]


def test_optimize_endpoint_accepts_posted_json():
    data = {
        "parts": [
            {
                "quantity": 2,
                "c": 500,
                "l": 300,
                "function": "Estante",
                "complement": "M01 Mueble",
                "material": "MDF 18 mm (2500x1830)",
                "c1": None,
                "c2": None,
                "l1": None,
                "l2": None,
            }
        ]
    }
    response = client.post("/api/optimize", json={"data": data, "kerf": 4, "allow_rotation": True})
    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["parts"] == 2
    assert body["groups"][0]["material"] == "MDF 18 mm (2500x1830)"


@pytest.mark.parametrize("payload", [{}, {"parts": "no"}, {"parts": [{"quantity": 1}]}])
def test_optimize_endpoint_rejects_bad_input(payload):
    response = client.post("/api/optimize", json={"data": payload})
    assert response.status_code == 400
