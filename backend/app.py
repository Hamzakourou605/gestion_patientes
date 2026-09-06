"""
API Flask — Système Centralisé de Gestion de File d'Attente
------------------------------------------------------------
Architecture v2 :
  - 4 services : Inscription (7), Paiement (8), Numérique (3), Concours (2) = 20 postes
  - Ticket placé en file SANS guichet à la création
  - Guichet attribué UNIQUEMENT au moment de l'appel (atomique)
  - Login par email + mot de passe (un compte par poste)
  - États réels : ACTIF / DISPONIBLE / PAUSE / ABSENT
  - Position dynamique recalculée en temps réel
  - Grand écran public : 4 services simultanément
"""

import os
import socket
from collections import Counter
from datetime import datetime, timedelta

from bson import ObjectId
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient, ReturnDocument
from werkzeug.security import check_password_hash, generate_password_hash

load_dotenv()

app = Flask(__name__)
CORS(app)

MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb+srv://hamzakourou399_db_user:1pDRs3S4XB6XIOq4@cluster0.rd1heyi.mongodb.net/?appName=Cluster0"
)
DB_NAME = os.getenv("DB_NAME", "file_attente_v2")

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

users_col     = db["users"]
stations_col  = db["stations"]
tickets_col   = db["tickets"]
counters_col  = db["counters"]

# ─── Configuration des 4 Services ──────────────────────────────────────────────
SERVICES_CONFIG = {
    "inscription": {
        "nom": "Inscription",
        "nom_complet": "Accueil & Inscriptions",
        "prefix": "I",
        "nb_postes": 7,
        "label_poste": "Guichet",
        "color": "#6366f1",       # indigo
    },
    "paiement": {
        "nom": "Paiement",
        "nom_complet": "Caisses de Paiement",
        "prefix": "P",
        "nb_postes": 8,
        "label_poste": "Caisse",
        "color": "#10b981",       # emerald
    },
    "numerique": {
        "nom": "Numérique",
        "nom_complet": "Service Numérique",
        "prefix": "N",
        "nb_postes": 3,
        "label_poste": "Poste",
        "color": "#f59e0b",       # amber
    },
    "concours": {
        "nom": "Concours",
        "nom_complet": "Service Concours",
        "prefix": "C",
        "nb_postes": 2,
        "label_poste": "Poste",
        "color": "#ef4444",       # red
    },
}

DEFAULT_PASSWORD = "poste123"

# État des postes
ETATS_VALIDES = ("DISPONIBLE", "EN_COURS", "PAUSE", "ABSENT")

# Tunnel URL (mis à jour par start-tunnel.js)
_tunnel_url = ""


# ─── Utilitaires ───────────────────────────────────────────────────────────────

def get_lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def prochain_numero(service):
    """Génère un numéro séquentiel par service : I-0001, P-0001, N-0001, C-0001."""
    doc = counters_col.find_one_and_update(
        {"_id": service},
        {"$inc": {"valeur": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    prefix = SERVICES_CONFIG.get(service, {}).get("prefix", "X")
    return f"{prefix}-{doc['valeur']:04d}"


def serialize_ticket(t, rang=None, personnes_avant=None):
    if not t:
        return None
    service_cfg = SERVICES_CONFIG.get(t.get("service", ""), {})
    date_c = t.get("date_creation")
    date_str = date_c.isoformat() if isinstance(date_c, datetime) else (str(date_c) if date_c else datetime.utcnow().isoformat())
    called_at = t.get("called_at")
    called_str = called_at.isoformat() if isinstance(called_at, datetime) else called_at

    return {
        "id": str(t["_id"]),
        "numero": t["numero"],
        "service": t.get("service"),
        "service_nom": service_cfg.get("nom", t.get("service", "")),
        "service_nom_complet": service_cfg.get("nom_complet", ""),
        "service_color": service_cfg.get("color", "#6366f1"),
        "station_id": t.get("station_id"),
        "station_label": t.get("station_label"),
        "statut": t.get("statut", "WAITING"),
        "date_creation": date_str,
        "called_at": called_str,
        "rang": rang,
        "personnes_avant": personnes_avant,
    }


def serialize_station(s):
    service_cfg = SERVICES_CONFIG.get(s.get("service", ""), {})
    etat = s.get("etat", "DISPONIBLE")
    return {
        "id": str(s["_id"]),
        "station_id": s.get("station_id"),
        "nom": s.get("nom"),
        "service": s.get("service"),
        "service_nom": service_cfg.get("nom", ""),
        "service_color": service_cfg.get("color", "#6366f1"),
        "label_poste": service_cfg.get("label_poste", "Poste"),
        "numero": s.get("numero"),
        "etat": etat,
        "email": s.get("email"),
        "ticket_en_cours": s.get("ticket_en_cours"),
    }


def calculer_position(ticket):
    """Calcule la position du ticket dans la file de son service."""
    statut = ticket.get("statut", "WAITING")
    if statut == "IN_PROGRESS":
        return 1, 0
    if statut in ("COMPLETED", "CANCELLED"):
        return 0, 0

    service = ticket.get("service")
    nb_avant = tickets_col.count_documents({
        "service": service,
        "statut": "WAITING",
        "date_creation": {"$lt": ticket["date_creation"]},
    })
    return nb_avant + 1, nb_avant


def build_service_display(service_key):
    """Construit les données d'affichage public pour un service."""
    cfg = SERVICES_CONFIG.get(service_key, {})

    # Toutes les stations du service
    stations = list(stations_col.find({"service": service_key}).sort("numero", 1))
    stations_data = []
    for s in stations:
        ticket_en_cours = None
        if s.get("ticket_en_cours"):
            t_obj = tickets_col.find_one({"_id": s["ticket_en_cours"]})
            if t_obj:
                ticket_en_cours = serialize_ticket(t_obj)
        etat = s.get("etat", "DISPONIBLE")
        if ticket_en_cours and etat == "DISPONIBLE":
            etat = "EN_COURS"
        stations_data.append({
            "id": str(s["_id"]),
            "station_id": s.get("station_id"),
            "nom": s.get("nom"),
            "numero": s.get("numero"),
            "etat": etat,
            "ticket_en_cours": ticket_en_cours,
        })

    # File d'attente du service
    file_waiting = list(
        tickets_col.find({"service": service_key, "statut": "WAITING"})
        .sort("date_creation", 1)
    )
    file_data = []
    for idx, t in enumerate(file_waiting):
        st = serialize_ticket(t, rang=idx + 1, personnes_avant=idx)
        file_data.append(st)

    # Derniers appelés (IN_PROGRESS)
    en_cours = [s for s in stations_data if s.get("ticket_en_cours")]

    return {
        "service": service_key,
        "nom": cfg.get("nom", ""),
        "nom_complet": cfg.get("nom_complet", ""),
        "prefix": cfg.get("prefix", ""),
        "color": cfg.get("color", "#6366f1"),
        "label_poste": cfg.get("label_poste", "Poste"),
        "nb_postes": cfg.get("nb_postes", 0),
        "stations": stations_data,
        "file_attente": file_data[:20],
        "total_attente": len(file_data),
        "total_en_cours": len(en_cours),
        "en_cours": en_cours,
    }


# ─── Initialisation ────────────────────────────────────────────────────────────

def init_data():
    """Crée (sans effacer) les stations et users manquants."""
    for service_key, cfg in SERVICES_CONFIG.items():
        label = cfg.get("label_poste", "Poste")
        for i in range(1, cfg["nb_postes"] + 1):
            station_id = f"{service_key}_{i}"
            email = f"{service_key}{i}@uir.ac.ma"
            nom = f"{label} {i}"

            # Station
            stations_col.update_one(
                {"station_id": station_id},
                {
                    "$setOnInsert": {
                        "etat": "DISPONIBLE",
                        "ticket_en_cours": None,
                    },
                    "$set": {
                        "service": service_key,
                        "nom": nom,
                        "numero": i,
                        "email": email,
                        "label_poste": label,
                    }
                },
                upsert=True,
            )

            # User (agent)
            users_col.update_one(
                {"email": email},
                {
                    "$setOnInsert": {
                        "password_hash": generate_password_hash(DEFAULT_PASSWORD),
                    },
                    "$set": {
                        "station_id": station_id,
                        "service": service_key,
                        "nom": nom,
                        "role": "agent",
                    }
                },
                upsert=True,
            )


# ─── Routes Santé & Config ──────────────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "service": "file-attente-v2",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "version": "2.0.0",
    }), 200


@app.route("/api/config", methods=["GET", "POST"])
def config_endpoint():
    global _tunnel_url
    if request.method == "POST":
        data = request.get_json(force=True, silent=True) or {}
        _tunnel_url = data.get("tunnel_url", "").strip()
        return jsonify({"ok": True, "tunnel_url": _tunnel_url})

    lan_ip = get_lan_ip()
    return jsonify({
        "lan_ip": lan_ip,
        "tunnel_url": _tunnel_url,
        "frontend_lan": f"http://{lan_ip}:3001",
        "mobile_lan": f"http://{lan_ip}:3001/#/mobile",
        "mobile_tunnel": f"{_tunnel_url}/#/mobile" if _tunnel_url else "",
    })


@app.route("/api/services", methods=["GET"])
def get_services():
    """Retourne la liste des 4 services avec leurs configs."""
    return jsonify({
        k: {
            "nom": v["nom"],
            "nom_complet": v["nom_complet"],
            "prefix": v["prefix"],
            "nb_postes": v["nb_postes"],
            "label_poste": v["label_poste"],
            "color": v["color"],
        }
        for k, v in SERVICES_CONFIG.items()
    })


# ─── Initialisation / Reset ────────────────────────────────────────────────────

@app.route("/api/init", methods=["POST"])
def reset_and_init():
    """
    SUPPRIME toutes les anciennes données et crée les 20 postes + 20 comptes.
    À appeler UNE FOIS au démarrage ou lors d'une réinitialisation.
    """
    # Suppression des anciennes collections
    db.drop_collection("tickets")
    db.drop_collection("guichets")
    db.drop_collection("compteurs")
    db.drop_collection("counters")
    db.drop_collection("stations")
    db.drop_collection("users")

    # Recréation
    init_data()

    # Résumé
    nb_stations = stations_col.count_documents({})
    nb_users = users_col.count_documents({})
    return jsonify({
        "ok": True,
        "message": f"{nb_stations} stations et {nb_users} comptes créés.",
        "nb_stations": nb_stations,
        "nb_users": nb_users,
        "comptes_exemple": [
            {"email": f"inscription1@uir.ac.ma", "mot_de_passe": DEFAULT_PASSWORD},
            {"email": f"paiement1@uir.ac.ma", "mot_de_passe": DEFAULT_PASSWORD},
            {"email": f"numerique1@uir.ac.ma", "mot_de_passe": DEFAULT_PASSWORD},
            {"email": f"concours1@uir.ac.ma", "mot_de_passe": DEFAULT_PASSWORD},
        ],
    })


# ─── Authentification ──────────────────────────────────────────────────────────

@app.route("/api/auth/login", methods=["POST"])
def login():
    """
    Connexion par email + mot de passe.
    Retourne les infos du poste associé.
    """
    init_data()  # Assure que les données existent
    data = request.get_json(force=True) or {}
    email = (data.get("email") or "").lower().strip()
    password = data.get("mot_de_passe") or data.get("password") or ""

    if not email:
        return jsonify({"erreur": "Email requis"}), 400

    user = users_col.find_one({"email": email})
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"erreur": "Email ou mot de passe incorrect"}), 401

    # Récupérer la station associée
    station = stations_col.find_one({"station_id": user["station_id"]})
    if not station:
        return jsonify({"erreur": "Station introuvable"}), 500

    # Ticket en cours (si existant)
    ticket_en_cours = None
    if station.get("ticket_en_cours"):
        t = tickets_col.find_one({"_id": station["ticket_en_cours"]})
        if t:
            ticket_en_cours = serialize_ticket(t)

    station_data = serialize_station(station)
    station_data["ticket_en_cours_data"] = ticket_en_cours

    return jsonify({
        "ok": True,
        "user": {
            "email": user["email"],
            "nom": user.get("nom"),
            "service": user.get("service"),
            "station_id": user.get("station_id"),
            "role": user.get("role", "agent"),
        },
        "station": station_data,
    })


@app.route("/api/auth/changer-mot-de-passe", methods=["POST"])
def changer_mot_de_passe():
    data = request.get_json(force=True) or {}
    email = (data.get("email") or "").lower().strip()
    user = users_col.find_one({"email": email})
    if not user or not check_password_hash(user["password_hash"], data.get("ancien", "")):
        return jsonify({"erreur": "Ancien mot de passe incorrect"}), 401
    users_col.update_one(
        {"email": email},
        {"$set": {"password_hash": generate_password_hash(data.get("nouveau", ""))}}
    )
    return jsonify({"ok": True})


# ─── Tickets ───────────────────────────────────────────────────────────────────

@app.route("/api/tickets", methods=["POST"])
def creer_ticket():
    """
    Crée un ticket et le place dans la file du service.
    RÈGLE : guichet/station = None — aucune attribution immédiate.
    """
    init_data()
    data = request.get_json(force=True) or {}
    service = data.get("service")

    if service not in SERVICES_CONFIG:
        return jsonify({"erreur": f"Service invalide. Valeurs: {list(SERVICES_CONFIG.keys())}"}), 400

    numero = prochain_numero(service)
    now = datetime.utcnow()

    ticket = {
        "numero": numero,
        "service": service,
        "station_id": None,      # Aucune attribution immédiate !
        "station_label": None,
        "statut": "WAITING",
        "date_creation": now,
        "called_at": None,
        "completed_at": None,
        "historique": [{
            "action": "creation",
            "station_id": None,
            "service": service,
            "horodatage": now,
        }],
    }
    result = tickets_col.insert_one(ticket)
    ticket["_id"] = result.inserted_id

    pos, avant = calculer_position(ticket)
    rep = serialize_ticket(ticket, rang=pos, personnes_avant=avant)
    return jsonify(rep), 201


@app.route("/api/tickets/<identifiant>", methods=["GET"])
def obtenir_ticket(identifiant):
    """
    Récupère l'état et la position dynamique d'un ticket.
    - WAITING  : guichet = null, position = X
    - IN_PROGRESS : station_id = '...', statut = IN_PROGRESS → afficher le guichet
    """
    t = tickets_col.find_one({"numero": identifiant})
    if not t and ObjectId.is_valid(identifiant):
        t = tickets_col.find_one({"_id": ObjectId(identifiant)})
    if not t:
        return jsonify({"erreur": "Ticket introuvable"}), 404

    pos, avant = calculer_position(t)
    return jsonify(serialize_ticket(t, rang=pos, personnes_avant=avant))


@app.route("/api/tickets", methods=["GET"])
def lister_tickets():
    query = {}
    for champ in ("service", "statut"):
        val = request.args.get(champ)
        if val:
            query[champ] = val
    station_id = request.args.get("station_id")
    if station_id:
        query["station_id"] = station_id

    tickets = list(tickets_col.find(query).sort("date_creation", 1))
    result = []
    for idx, t in enumerate(tickets):
        pos, avant = calculer_position(t)
        result.append(serialize_ticket(t, rang=pos, personnes_avant=avant))
    return jsonify(result)


# ─── Stations (Guichets / Caisses / Postes) ─────────────────────────────────────

@app.route("/api/stations", methods=["GET"])
def lister_stations():
    """Liste toutes les stations avec leur état et ticket en cours."""
    init_data()
    service_filter = request.args.get("service")
    query = {}
    if service_filter:
        query["service"] = service_filter

    resultat = []
    for s in stations_col.find(query).sort([("service", 1), ("numero", 1)]):
        ticket_en_cours = None
        if s.get("ticket_en_cours"):
            t = tickets_col.find_one({"_id": s["ticket_en_cours"]})
            if t:
                ticket_en_cours = serialize_ticket(t)

        etat = s.get("etat", "DISPONIBLE")
        if ticket_en_cours and etat == "DISPONIBLE":
            etat = "EN_COURS"

        data = serialize_station(s)
        data["ticket_en_cours_data"] = ticket_en_cours

        # File d'attente du service
        file_waiting = list(
            tickets_col.find({"service": s["service"], "statut": "WAITING"})
            .sort("date_creation", 1)
            .limit(10)
        )
        data["file_attente"] = [
            serialize_ticket(t, rang=idx + 1, personnes_avant=idx)
            for idx, t in enumerate(file_waiting)
        ]
        data["total_attente"] = tickets_col.count_documents({"service": s["service"], "statut": "WAITING"})
        resultat.append(data)

    return jsonify(resultat)


@app.route("/api/stations/<station_id>", methods=["GET"])
def get_station(station_id):
    """Récupère une station par son ID."""
    s = stations_col.find_one({"station_id": station_id})
    if not s:
        return jsonify({"erreur": "Station introuvable"}), 404

    ticket_en_cours = None
    if s.get("ticket_en_cours"):
        t = tickets_col.find_one({"_id": s["ticket_en_cours"]})
        if t:
            ticket_en_cours = serialize_ticket(t)

    data = serialize_station(s)
    data["ticket_en_cours_data"] = ticket_en_cours

    file_waiting = list(
        tickets_col.find({"service": s["service"], "statut": "WAITING"})
        .sort("date_creation", 1)
        .limit(10)
    )
    data["file_attente"] = [
        serialize_ticket(t, rang=idx + 1, personnes_avant=idx)
        for idx, t in enumerate(file_waiting)
    ]
    data["total_attente"] = tickets_col.count_documents({"service": s["service"], "statut": "WAITING"})
    return jsonify(data)


@app.route("/api/stations/<station_id>/suivant", methods=["POST"])
def appeler_suivant(station_id):
    """
    L'agent décide d'appeler le ticket suivant.
    Attribution ATOMIQUE : le plus ancien ticket WAITING du service.
    """
    init_data()
    s = stations_col.find_one({"station_id": station_id})
    if not s:
        return jsonify({"erreur": "Station introuvable"}), 404

    etat = s.get("etat", "DISPONIBLE")
    if etat == "PAUSE":
        return jsonify({"erreur": "Station EN PAUSE. Reprenez le service avant d'appeler."}), 400
    if etat == "ABSENT":
        return jsonify({"erreur": "Station ABSENTE. Activez-la avant d'appeler."}), 400
    if s.get("ticket_en_cours"):
        return jsonify({"erreur": "Un ticket est déjà en cours. Terminez-le d'abord."}), 400

    service = s["service"]
    cfg = SERVICES_CONFIG.get(service, {})
    label_poste = cfg.get("label_poste", "Poste")
    station_label = f"{label_poste} {s['numero']}"

    # Attribution atomique
    now = datetime.utcnow()
    suivant = tickets_col.find_one_and_update(
        {"service": service, "statut": "WAITING"},
        {
            "$set": {
                "statut": "IN_PROGRESS",
                "station_id": station_id,
                "station_label": station_label,
                "called_at": now,
            },
            "$push": {
                "historique": {
                    "action": "appel",
                    "station_id": station_id,
                    "station_label": station_label,
                    "service": service,
                    "horodatage": now,
                }
            }
        },
        sort=[("date_creation", 1)],
        return_document=ReturnDocument.AFTER,
    )

    if not suivant:
        stations_col.update_one(
            {"station_id": station_id},
            {"$set": {"etat": "DISPONIBLE", "ticket_en_cours": None}}
        )
        return jsonify({
            "message": "Aucun candidat en attente pour ce service.",
            "ticket": None,
        })

    stations_col.update_one(
        {"station_id": station_id},
        {"$set": {"etat": "EN_COURS", "ticket_en_cours": suivant["_id"]}}
    )

    ticket_ser = serialize_ticket(suivant)
    return jsonify({"ok": True, "ticket": ticket_ser})


@app.route("/api/stations/<station_id>/terminer", methods=["POST"])
def terminer(station_id):
    """
    Clôture le ticket en cours ou le réoriente vers un autre service.
    action: 'termine' | 'numerique' | 'paiement' | 'concours'
    """
    data = request.get_json(force=True) or {}
    action = data.get("action", "termine")

    s = stations_col.find_one({"station_id": station_id})
    if not s or not s.get("ticket_en_cours"):
        return jsonify({"erreur": "Aucun ticket en cours sur cette station"}), 400

    ticket_oid = s["ticket_en_cours"]
    now = datetime.utcnow()

    if action == "termine":
        tickets_col.update_one(
            {"_id": ticket_oid},
            {
                "$set": {"statut": "COMPLETED", "completed_at": now},
                "$push": {
                    "historique": {
                        "action": "termine",
                        "station_id": station_id,
                        "horodatage": now,
                    }
                }
            }
        )
        stations_col.update_one(
            {"station_id": station_id},
            {"$set": {"ticket_en_cours": None, "etat": "DISPONIBLE"}}
        )
        return jsonify({"ok": True, "statut": "COMPLETED", "message": "Visite terminée"})

    # Réorientation vers un autre service
    service_dest = action  # ex: "paiement", "numerique", "concours"
    if service_dest not in SERVICES_CONFIG:
        return jsonify({"erreur": f"Service de destination invalide: {service_dest}"}), 400

    # Générer un nouveau numéro pour le service destination
    nouveau_numero = prochain_numero(service_dest)

    stations_col.update_one(
        {"station_id": station_id},
        {"$set": {"ticket_en_cours": None, "etat": "DISPONIBLE"}}
    )
    tickets_col.update_one(
        {"_id": ticket_oid},
        {
            "$set": {
                "statut": "WAITING",
                "service": service_dest,
                "numero": nouveau_numero,
                "station_id": None,
                "station_label": None,
                "date_creation": now,
                "called_at": None,
            },
            "$push": {
                "historique": {
                    "action": "redirection",
                    "vers": service_dest,
                    "station_id": station_id,
                    "horodatage": now,
                }
            }
        }
    )
    ticket_updated = tickets_col.find_one({"_id": ticket_oid})
    pos, avant = calculer_position(ticket_updated)
    return jsonify({
        "ok": True,
        "message": f"Redirigé vers {SERVICES_CONFIG[service_dest]['nom']}",
        "ticket": serialize_ticket(ticket_updated, rang=pos, personnes_avant=avant),
    })


@app.route("/api/stations/<station_id>/pause", methods=["POST"])
def station_pause(station_id):
    """Met la station en PAUSE : ne peut plus appeler le suivant."""
    s = stations_col.find_one({"station_id": station_id})
    if not s:
        return jsonify({"erreur": "Station introuvable"}), 404
    stations_col.update_one({"station_id": station_id}, {"$set": {"etat": "PAUSE"}})
    return jsonify({"ok": True, "etat": "PAUSE", "station_id": station_id})


@app.route("/api/stations/<station_id>/reprendre", methods=["POST"])
@app.route("/api/stations/<station_id>/resume", methods=["POST"])
def station_reprendre(station_id):
    """Reprend le service depuis PAUSE → DISPONIBLE (ou EN_COURS si ticket actif)."""
    s = stations_col.find_one({"station_id": station_id})
    if not s:
        return jsonify({"erreur": "Station introuvable"}), 404
    ticket_actif = False
    if s.get("ticket_en_cours"):
        t = tickets_col.find_one({"_id": s["ticket_en_cours"], "statut": "IN_PROGRESS"})
        if t:
            ticket_actif = True
        else:
            stations_col.update_one({"station_id": station_id}, {"$set": {"ticket_en_cours": None}})
    nouvel_etat = "EN_COURS" if ticket_actif else "DISPONIBLE"
    stations_col.update_one({"station_id": station_id}, {"$set": {"etat": nouvel_etat}})
    return jsonify({"ok": True, "etat": nouvel_etat, "station_id": station_id})


@app.route("/api/stations/<station_id>/absent", methods=["POST"])
def station_absent(station_id):
    """Marque la station ABSENT."""
    s = stations_col.find_one({"station_id": station_id})
    if not s:
        return jsonify({"erreur": "Station introuvable"}), 404
    stations_col.update_one({"station_id": station_id}, {"$set": {"etat": "ABSENT"}})
    return jsonify({"ok": True, "etat": "ABSENT", "station_id": station_id})


@app.route("/api/stations/<station_id>/activer", methods=["POST"])
@app.route("/api/stations/<station_id>/activate", methods=["POST"])
def station_activer(station_id):
    """Réactive une station ABSENTE → DISPONIBLE."""
    s = stations_col.find_one({"station_id": station_id})
    if not s:
        return jsonify({"erreur": "Station introuvable"}), 404
    stations_col.update_one({"station_id": station_id}, {"$set": {"etat": "DISPONIBLE"}})
    return jsonify({"ok": True, "etat": "DISPONIBLE", "station_id": station_id})


# ─── Grand Écran Public ────────────────────────────────────────────────────────

@app.route("/api/affichage", methods=["GET"])
def affichage():
    """
    Données complètes pour le grand écran public.
    Retourne les 4 services simultanément pour l'affichage 2×2.
    """
    init_data()
    services_data = {}
    for service_key in SERVICES_CONFIG:
        services_data[service_key] = build_service_display(service_key)

    total_attente = sum(s["total_attente"] for s in services_data.values())
    total_en_cours = sum(s["total_en_cours"] for s in services_data.values())

    return jsonify({
        "services": services_data,
        "total_attente": total_attente,
        "total_en_cours": total_en_cours,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    })


# ─── Compatibilité ancienne API (guichets) ────────────────────────────────────

@app.route("/api/guichets", methods=["GET"])
def lister_guichets_compat():
    """Compatibilité ancienne API → redirige vers /api/stations."""
    return lister_stations()


# ─── Statistiques ─────────────────────────────────────────────────────────────

def bornes_periode(periode):
    maintenant = datetime.utcnow()
    minuit = maintenant.replace(hour=0, minute=0, second=0, microsecond=0)
    if periode == "jour":
        return minuit, maintenant
    if periode == "semaine":
        return minuit - timedelta(days=6), maintenant
    if periode == "mois":
        return minuit - timedelta(days=29), maintenant
    return None, None


@app.route("/api/statistiques", methods=["GET"])
def statistiques():
    """?periode=jour|semaine|mois&service=<service>&station_id=<id>"""
    periode = request.args.get("periode", "jour")
    if periode not in ("jour", "semaine", "mois"):
        return jsonify({"erreur": "periode invalide (jour|semaine|mois)"}), 400

    service_filter = request.args.get("service")
    station_filter = request.args.get("station_id")

    debut, fin = bornes_periode(periode)

    elem_match = {
        "action": {"$in": ["termine", "redirection"]},
        "horodatage": {"$gte": debut, "$lte": fin},
    }
    if station_filter:
        elem_match["station_id"] = station_filter

    query = {"historique": {"$elemMatch": elem_match}}
    if service_filter:
        query["service"] = service_filter

    docs = list(tickets_col.find(query))
    evenements = []
    for t in docs:
        for h in t.get("historique", []):
            if h.get("action") not in ("termine", "redirection"):
                continue
            if not (debut <= h.get("horodatage", datetime.min) <= fin):
                continue
            if station_filter and h.get("station_id") != station_filter:
                continue
            evenements.append({
                "date": h["horodatage"],
                "service": t.get("service"),
                "station_id": h.get("station_id"),
            })

    par_service = Counter(e["service"] for e in evenements)
    par_station = Counter(e["station_id"] for e in evenements)

    nb_jours = 1 if periode == "jour" else (7 if periode == "semaine" else 30)
    par_jour_cnt = Counter(e["date"].date().isoformat() for e in evenements)
    serie = []
    for i in range(nb_jours - 1, -1, -1):
        jour = (fin.date() - timedelta(days=i)).isoformat()
        serie.append({"date": jour, "total": par_jour_cnt.get(jour, 0)})

    return jsonify({
        "periode": periode,
        "total": len(evenements),
        "par_service": {k: par_service.get(k, 0) for k in SERVICES_CONFIG},
        "par_station": dict(par_station),
        "serie": serie,
    })


# ─── Démarrage ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    init_data()
    app.run(debug=True, host="0.0.0.0", port=int(os.getenv("PORT", 5000)))
