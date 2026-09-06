"""
Backend API Unit Tests for CI/CD Pipeline
"""
import pytest
import os
import sys

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import app, SERVICES, NB_GUICHETS


@pytest.fixture
def client():
    """Create Flask test client."""
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_health_check(client):
    """Test the /api/health endpoint used for health checks."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "healthy"
    assert data["service"] == "gestion-patientes-api"
    assert "timestamp" in data


def test_config_endpoint_get(client):
    """Test GET /api/config returns LAN and tunnel endpoints."""
    response = client.get("/api/config")
    assert response.status_code == 200
    data = response.get_json()
    assert "lan_ip" in data
    assert "frontend_lan" in data
    assert "mobile_lan" in data


def test_config_endpoint_post(client):
    """Test POST /api/config updates tunnel URL."""
    test_url = "https://uir-test-tunnel.loca.lt"
    response = client.post("/api/config", json={"tunnel_url": test_url})
    assert response.status_code == 200
    data = response.get_json()
    assert data["ok"] is True
    assert data["tunnel_url"] == test_url

    # Verify subsequent GET returns the updated tunnel URL
    get_res = client.get("/api/config")
    assert get_res.get_json()["tunnel_url"] == test_url


def test_services_catalog():
    """Verify all required services exist in the catalog."""
    expected_services = [
        "inscription_rdv",
        "inscription_master",
        "avp_paiement",
        "service_numerique",
        "inscription_bachelier",
        "concours",
        "autres"
    ]
    for s in expected_services:
        assert s in SERVICES, f"Service {s} is missing from SERVICES catalog"


def test_nb_guichets_configuration():
    """Verify 16 counters are configured across the 4 departments."""
    assert NB_GUICHETS == 16


def test_ticket_creation_in_global_queue_without_guichet(client):
    """Verify ticket is created in WAITING status with NO assigned guichet initially."""
    res = client.post("/api/tickets", json={
        "type": "master",
        "service": "inscription_master"
    })
    assert res.status_code == 201
    data = res.get_json()
    assert data["numero"].startswith("M-")
    assert data["statut"] == "WAITING"
    assert data["guichet"] is None
    assert data["position"] >= 1
    assert data["personnes_avant"] >= 0


def test_guichet_states_pause_and_resume(client):
    """Verify guichet pause, resume, absent and activate endpoints."""
    from app import guichets_col
    guichets_col.update_one({"numero": 4}, {"$set": {"ticket_en_cours": None, "etat": "DISPONIBLE"}})

    # Put guichet 4 on pause
    res_pause = client.post("/api/guichets/4/pause")
    assert res_pause.status_code == 200
    assert res_pause.get_json()["etat"] == "PAUSE"

    # Resume guichet 4
    res_resume = client.post("/api/guichets/4/resume")
    assert res_resume.status_code == 200
    assert res_resume.get_json()["etat"] == "DISPONIBLE"

    # Put guichet 4 absent
    res_absent = client.post("/api/guichets/4/absent")
    assert res_absent.status_code == 200
    assert res_absent.get_json()["etat"] == "ABSENT"

    # Activate guichet 4
    res_act = client.post("/api/guichets/4/activate")
    assert res_act.status_code == 200
    assert res_act.get_json()["etat"] == "DISPONIBLE"
