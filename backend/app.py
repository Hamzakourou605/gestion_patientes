"""
API Flask - Gestion de file d'attente (7 guichets)
---------------------------------------------------
Résumé du fonctionnement :

- Le patient (étudiant) "scanne" un code -> choisit son statut (Master / Bachelier)
  puis un service (Inscription Master / AVP-Paiement / Service Numérique / Autres).
- Un ticket est créé, numéroté M-0001 / B-0001 (séquence par statut) et affecté
  automatiquement au guichet le moins chargé parmi les 7.
- Chaque guichet possède un compte (numero + mot de passe). Une fois connecté,
  le guichet voit :
    * son client en cours (s'il y en a un) et sa propre file d'attente,
    * la file d'attente globale des 7 guichets,
    * ses statistiques (jour / semaine / mois).
- Un guichet clique sur "Client suivant" pour appeler le prochain ticket de SA file.
- Une fois le client traité, le guichet clique sur :
    * "Visite terminée"       -> le ticket est clos définitivement,
    * "Service numérique"     -> le MÊME numéro repart en file, réaffecté au
                                  guichet le moins chargé, avec le service
                                  "Service Numérique",
    * "Paiement inscription"  -> pareil, avec le service "AVP / Paiement".
"""

import os
import socket
from collections import Counter
from datetime import datetime, timedelta

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient, ReturnDocument
from werkzeug.security import check_password_hash, generate_password_hash

load_dotenv()

app = Flask(__name__)
CORS(app)

MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://hamzakourou399_db_user:1pDRs3S4XB6XIOq4@cluster0.rd1heyi.mongodb.net/?appName=Cluster0")
DB_NAME = os.getenv("DB_NAME", "file_attente")

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

tickets_col = db["tickets"]
guichets_col = db["guichets"]
compteurs_col = db["compteurs"]

NB_GUICHETS = 7
MOT_DE_PASSE_DEFAUT = "guichet123"  # mot de passe initial de chaque guichet (à changer en prod)

SERVICES = {
    "inscription_rdv": "Inscription avec Rendez-vous",
    "inscription_master": "Inscription Master / AVP",
    "avp_paiement": "AVP / Paiement Inscription",
    "service_numerique": "Service Numérique",
    "inscription_bachelier": "Inscription Bachelier",
    "autres": "Autres",
}

TYPES = {
    "master": "Master",
    "bachelier": "Bachelier",
}

STATUTS_ACTIFS = ("en_attente", "en_cours")
ACTIONS_CLOTURE = ("termine", "service_numerique", "avp_paiement")

# ── Tunnel public URL (mis à jour par le script start-tunnel.js) ────────────
_tunnel_url = ""


def get_lan_ip():
    """Retourne l'IP locale de la machine sur le réseau LAN."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"



# ---------------------------------------------------------------------------
# Utilitaires
# ---------------------------------------------------------------------------

def init_guichets():
    """Crée les 7 guichets avec un compte par défaut s'ils n'existent pas déjà."""
    for i in range(1, NB_GUICHETS + 1):
        guichets_col.update_one(
            {"numero": i},
            {
                "$setOnInsert": {
                    "numero": i,
                    "nom": f"Guichet {i}",
                    "mot_de_passe_hash": generate_password_hash(MOT_DE_PASSE_DEFAUT),
                    "ticket_en_cours": None,
                    "actif": True,
                }
            },
            upsert=True,
        )


def prochain_numero(type_):
    """Génère un numéro de ticket séquentiel par type (M-0001, B-0001, ...)."""
    doc = compteurs_col.find_one_and_update(
        {"_id": type_},
        {"$inc": {"valeur": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    prefixe = "M" if type_ == "master" else "B"
    return f"{prefixe}-{doc['valeur']:04d}"


def guichet_le_moins_charge():
    """Numéro du guichet ayant le moins de tickets actifs (en_attente + en_cours)."""
    charges = {i: 0 for i in range(1, NB_GUICHETS + 1)}
    for row in tickets_col.aggregate(
        [
            {"$match": {"statut": {"$in": list(STATUTS_ACTIFS)}}},
            {"$group": {"_id": "$guichet", "n": {"$sum": 1}}},
        ]
    ):
        if row["_id"] in charges:
            charges[row["_id"]] = row["n"]
    return min(charges, key=lambda n: (charges[n], n))


def serialize_ticket(t):
    return {
        "id": str(t["_id"]),
        "numero": t["numero"],
        "type": t["type"],
        "type_label": TYPES.get(t["type"], t["type"]),
        "service": t["service"],
        "service_label": SERVICES.get(t["service"], t["service"]),
        "guichet": t.get("guichet"),
        "statut": t["statut"],
        "date_creation": t["date_creation"].isoformat(),
    }


def serialize_guichet(g):
    return {"numero": g["numero"], "nom": g.get("nom", f"Guichet {g['numero']}")}


def ajouter_historique(ticket_id, action, guichet, service=None):
    tickets_col.update_one(
        {"_id": ticket_id},
        {
            "$push": {
                "historique": {
                    "action": action,
                    "guichet": guichet,
                    "service": service,
                    "horodatage": datetime.utcnow(),
                }
            }
        },
    )


# ---------------------------------------------------------------------------
# Authentification (comptes guichets)
# ---------------------------------------------------------------------------

@app.route("/api/auth/login", methods=["POST"])
def login():
    """Connexion d'un guichet : {"numero": 3, "mot_de_passe": "..."}"""
    init_guichets()
    data = request.get_json(force=True) or {}
    try:
        numero = int(data.get("numero"))
    except (TypeError, ValueError):
        return jsonify({"erreur": "numéro de guichet invalide"}), 400

    g = guichets_col.find_one({"numero": numero})
    if not g or not check_password_hash(g["mot_de_passe_hash"], data.get("mot_de_passe", "")):
        return jsonify({"erreur": "numéro ou mot de passe incorrect"}), 401

    return jsonify({"ok": True, "guichet": serialize_guichet(g)})


@app.route("/api/auth/changer-mot-de-passe", methods=["POST"])
def changer_mot_de_passe():
    """{"numero":3, "ancien":"...", "nouveau":"..."}"""
    data = request.get_json(force=True) or {}
    numero = data.get("numero")
    g = guichets_col.find_one({"numero": numero})
    if not g or not check_password_hash(g["mot_de_passe_hash"], data.get("ancien", "")):
        return jsonify({"erreur": "ancien mot de passe incorrect"}), 401
    guichets_col.update_one(
        {"numero": numero},
        {"$set": {"mot_de_passe_hash": generate_password_hash(data.get("nouveau", ""))}},
    )
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# Scan / création de ticket
# ---------------------------------------------------------------------------

@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/api/services")
def services():
    return jsonify({"types": TYPES, "services": SERVICES})


@app.route("/api/tickets", methods=["POST"])
def creer_ticket():
    """Crée un ticket après le scan : {"type": "master"|"bachelier", "service": "..."}"""
    data = request.get_json(force=True) or {}
    type_ = data.get("type")
    service = data.get("service")

    if type_ not in TYPES:
        return jsonify({"erreur": "type invalide (master|bachelier)"}), 400
    if service not in SERVICES:
        return jsonify({"erreur": "service invalide"}), 400

    init_guichets()
    guichet_choisi = guichet_le_moins_charge()
    numero = prochain_numero(type_)

    ticket = {
        "numero": numero,
        "type": type_,
        "service": service,
        "guichet": guichet_choisi,
        "statut": "en_attente",
        "date_creation": datetime.utcnow(),
        "historique": [
            {
                "action": "creation",
                "guichet": guichet_choisi,
                "service": service,
                "horodatage": datetime.utcnow(),
            }
        ],
    }
    result = tickets_col.insert_one(ticket)
    ticket["_id"] = result.inserted_id

    # position dans la file de ce guichet (nombre de tickets en attente avant lui)
    position = tickets_col.count_documents(
        {"guichet": guichet_choisi, "statut": "en_attente", "date_creation": {"$lt": ticket["date_creation"]}}
    ) + 1

    reponse = serialize_ticket(ticket)
    reponse["position"] = position
    return jsonify(reponse), 201


@app.route("/api/tickets", methods=["GET"])
def lister_tickets():
    query = {}
    for champ in ("type", "statut"):
        val = request.args.get(champ)
        if val:
            query[champ] = val
    guichet = request.args.get("guichet")
    if guichet:
        query["guichet"] = int(guichet)

    tickets = list(tickets_col.find(query).sort("date_creation", 1))
    return jsonify([serialize_ticket(t) for t in tickets])


# ---------------------------------------------------------------------------
# Vue des guichets (file propre à chaque guichet + file globale)
# ---------------------------------------------------------------------------

@app.route("/api/guichets")
def lister_guichets():
    """Vue complète des 7 guichets : ticket en cours + file d'attente de chacun.
    Utilisée à la fois pour l'écran de chaque guichet et pour la 'file d'attente globale'."""
    init_guichets()
    resultat = []
    for g in guichets_col.find().sort("numero", 1):
        ticket_en_cours = None
        if g.get("ticket_en_cours"):
            t = tickets_col.find_one({"_id": g["ticket_en_cours"]})
            if t:
                ticket_en_cours = serialize_ticket(t)

        file_attente = list(
            tickets_col.find({"guichet": g["numero"], "statut": "en_attente"}).sort("date_creation", 1)
        )
        resultat.append(
            {
                "numero": g["numero"],
                "nom": g.get("nom", f"Guichet {g['numero']}"),
                "actif": g.get("actif", True),
                "ticket_en_cours": ticket_en_cours,
                "file_attente": [serialize_ticket(t) for t in file_attente],
            }
        )
    return jsonify(resultat)


@app.route("/api/guichets/<int:numero>/suivant", methods=["POST"])
def client_suivant(numero):
    """Appelle le prochain ticket de LA FILE DE CE GUICHET.
    Refusé si un client est déjà en cours de traitement à ce guichet."""
    g = guichets_col.find_one({"numero": numero})
    if not g:
        return jsonify({"erreur": "guichet introuvable"}), 404
    if g.get("ticket_en_cours"):
        return jsonify({"erreur": "un client est déjà en cours, terminez-le d'abord"}), 400

    suivant = tickets_col.find_one(
        {"guichet": numero, "statut": "en_attente"}, sort=[("date_creation", 1)]
    )
    if not suivant:
        return jsonify({"message": "aucun client en attente", "ticket_en_cours": None})

    tickets_col.update_one({"_id": suivant["_id"]}, {"$set": {"statut": "en_cours"}})
    guichets_col.update_one({"numero": numero}, {"$set": {"ticket_en_cours": suivant["_id"]}})
    ajouter_historique(suivant["_id"], "appel", numero)

    suivant["statut"] = "en_cours"
    return jsonify({"ticket_en_cours": serialize_ticket(suivant)})


@app.route("/api/guichets/<int:numero>/terminer", methods=["POST"])
def terminer(numero):
    """Clôture le client en cours du guichet.
    {"action": "termine" | "service_numerique" | "avp_paiement"}

    - termine            -> le ticket est définitivement clos.
    - service_numerique  -> le MÊME ticket repart en file, réaffecté au guichet
                             le moins chargé, avec le service "Service Numérique".
    - avp_paiement       -> pareil, avec le service "AVP / Paiement Inscription".
    """
    data = request.get_json(force=True) or {}
    action = data.get("action")
    if action not in ACTIONS_CLOTURE:
        return jsonify({"erreur": "action invalide (termine|service_numerique|avp_paiement)"}), 400

    g = guichets_col.find_one({"numero": numero})
    if not g or not g.get("ticket_en_cours"):
        return jsonify({"erreur": "aucun ticket en cours sur ce guichet"}), 400

    ticket_id = g["ticket_en_cours"]

    if action == "termine":
        tickets_col.update_one({"_id": ticket_id}, {"$set": {"statut": "termine"}})
        ajouter_historique(ticket_id, "termine", numero)
        guichets_col.update_one({"numero": numero}, {"$set": {"ticket_en_cours": None}})
        return jsonify({"message": "visite terminée"})

    # Redirection : même numéro, nouveau service, ré-affectation au guichet le moins chargé
    guichets_col.update_one({"numero": numero}, {"$set": {"ticket_en_cours": None}})
    ajouter_historique(ticket_id, "redirection", numero, service=action)

    nouveau_guichet = guichet_le_moins_charge()
    tickets_col.update_one(
        {"_id": ticket_id},
        {
            "$set": {
                "statut": "en_attente",
                "service": action,
                "guichet": nouveau_guichet,
                "date_creation": datetime.utcnow(),  # remet le ticket en bout de la nouvelle file
            }
        },
    )
    ticket = tickets_col.find_one({"_id": ticket_id})
    return jsonify({"message": "ticket redirigé", "ticket": serialize_ticket(ticket)})


@app.route("/api/affichage")
def affichage():
    """Données pour l'écran public : regroupées par statut (Master / Bachelier)."""
    init_guichets()
    resultat = {}
    for type_ in TYPES:
        en_cours = list(tickets_col.find({"type": type_, "statut": "en_cours"}).sort("guichet", 1))
        en_attente = list(tickets_col.find({"type": type_, "statut": "en_attente"}).sort("date_creation", 1))
        resultat[type_] = {
            "label": TYPES[type_],
            "en_cours": [serialize_ticket(t) for t in en_cours],
            "en_attente": [serialize_ticket(t) for t in en_attente],
        }
    return jsonify(resultat)


# ---------------------------------------------------------------------------
# Statistiques (jour / semaine / mois)
# ---------------------------------------------------------------------------

def bornes_periode(periode):
    maintenant = datetime.utcnow()
    aujourdhui_minuit = maintenant.replace(hour=0, minute=0, second=0, microsecond=0)
    if periode == "jour":
        return aujourdhui_minuit, maintenant
    if periode == "semaine":
        return aujourdhui_minuit - timedelta(days=6), maintenant
    if periode == "mois":
        return aujourdhui_minuit - timedelta(days=29), maintenant
    return None, None


@app.route("/api/statistiques")
def statistiques():
    """?periode=jour|semaine|mois&guichet=<numero optionnel>
    Compte les visites CLÔTURÉES par un guichet (visite terminée ou redirigée)
    sur la période demandée."""
    periode = request.args.get("periode", "jour")
    if periode not in ("jour", "semaine", "mois"):
        return jsonify({"erreur": "periode invalide (jour|semaine|mois)"}), 400

    guichet_param = request.args.get("guichet")
    guichet_filtre = int(guichet_param) if guichet_param else None

    debut, fin = bornes_periode(periode)

    elem_match = {
        "action": {"$in": ["termine", "redirection"]},
        "horodatage": {"$gte": debut, "$lte": fin},
    }
    if guichet_filtre is not None:
        elem_match["guichet"] = guichet_filtre

    docs = tickets_col.find({"historique": {"$elemMatch": elem_match}})

    evenements = []
    for t in docs:
        for h in t.get("historique", []):
            if h.get("action") not in ("termine", "redirection"):
                continue
            if not (debut <= h["horodatage"] <= fin):
                continue
            if guichet_filtre is not None and h.get("guichet") != guichet_filtre:
                continue
            evenements.append(
                {
                    "date": h["horodatage"],
                    "type": t.get("type"),
                    "guichet": h.get("guichet"),
                    "service": h.get("service") or t.get("service"),
                }
            )

    par_type = Counter(e["type"] for e in evenements)
    par_service = Counter(e["service"] for e in evenements)
    par_guichet = Counter(e["guichet"] for e in evenements)

    par_jour = Counter(e["date"].date().isoformat() for e in evenements)
    nb_jours = 1 if periode == "jour" else (7 if periode == "semaine" else 30)
    serie = []
    for i in range(nb_jours - 1, -1, -1):
        jour = (fin.date() - timedelta(days=i)).isoformat()
        serie.append({"date": jour, "total": par_jour.get(jour, 0)})

    return jsonify(
        {
            "periode": periode,
            "guichet": guichet_filtre,
            "total": len(evenements),
            "par_type": {k: par_type.get(k, 0) for k in TYPES},
            "par_service": {k: par_service.get(k, 0) for k in SERVICES},
            "par_guichet": {str(i): par_guichet.get(i, 0) for i in range(1, NB_GUICHETS + 1)},
            "serie": serie,
        }
    )



# ---------------------------------------------------------------------------
# Config & Tunnel URL
# ---------------------------------------------------------------------------

@app.route("/api/config", methods=["GET", "POST"])
def config_endpoint():
    """
    GET  /api/config  → renvoie l'IP LAN et l'URL du tunnel public (si actif).
    POST /api/config  → met à jour l'URL du tunnel public (appelé par start-tunnel.js).
    """
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


if __name__ == "__main__":
    init_guichets()
    app.run(debug=True, host="0.0.0.0", port=int(os.getenv("PORT", 5000)))
