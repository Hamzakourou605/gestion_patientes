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

# ─── Configuration des Pôles et Guichets ──────────────────────────────────
# Inscription: 4 guichets (1 à 4)
# Concours:    2 guichets (5, 6)
# Paiement:    8 caisses (7 à 14)
# Numérique:   2 guichets (15, 16 - Dernière étape)
GUICHETS_CONFIG = [
    {"numero": 1, "nom": "Guichet Inscription 1", "pole": "inscription"},
    {"numero": 2, "nom": "Guichet Inscription 2", "pole": "inscription"},
    {"numero": 3, "nom": "Guichet Inscription 3", "pole": "inscription"},
    {"numero": 4, "nom": "Guichet Inscription 4", "pole": "inscription"},
    {"numero": 5, "nom": "Guichet Concours 1", "pole": "concours"},
    {"numero": 6, "nom": "Guichet Concours 2", "pole": "concours"},
    {"numero": 7, "nom": "Caisse Paiement 1", "pole": "paiement"},
    {"numero": 8, "nom": "Caisse Paiement 2", "pole": "paiement"},
    {"numero": 9, "nom": "Caisse Paiement 3", "pole": "paiement"},
    {"numero": 10, "nom": "Caisse Paiement 4", "pole": "paiement"},
    {"numero": 11, "nom": "Caisse Paiement 5", "pole": "paiement"},
    {"numero": 12, "nom": "Caisse Paiement 6", "pole": "paiement"},
    {"numero": 13, "nom": "Caisse Paiement 7", "pole": "paiement"},
    {"numero": 14, "nom": "Caisse Paiement 8", "pole": "paiement"},
    {"numero": 15, "nom": "Service Numérique 1", "pole": "numerique"},
    {"numero": 16, "nom": "Service Numérique 2", "pole": "numerique"},
]

NB_GUICHETS = len(GUICHETS_CONFIG)
MOT_DE_PASSE_DEFAUT = "guichet123"

SERVICES = {
    "inscription_rdv": "Inscription avec Rendez-vous",
    "inscription_master": "Inscription Master / AVP",
    "inscription_bachelier": "Inscription Bachelier",
    "concours": "Service Concours",
    "avp_paiement": "Caisse Paiement (8 Caisses)",
    "service_numerique": "Service Numérique (Dernière étape)",
    "autres": "Autres démarches",
}

# Mapping de chaque service vers son pôle de guichets
SERVICE_TO_POLE = {
    "inscription_rdv": "inscription",
    "inscription_master": "inscription",
    "inscription_bachelier": "inscription",
    "autres": "inscription",
    "concours": "concours",
    "avp_paiement": "paiement",
    "service_numerique": "numerique",
}

POLES_META = {
    "inscription": {"nom": "Accueil & Inscriptions", "guichets": [1, 2, 3, 4]},
    "concours": {"nom": "Pôle Concours", "guichets": [5, 6]},
    "paiement": {"nom": "Caisses de Paiement (8 Caisses)", "guichets": list(range(7, 15))},
    "numerique": {"nom": "Service Numérique (Dernière étape)", "guichets": [15, 16]},
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


def get_guichet_meta(num):
    for g in GUICHETS_CONFIG:
        if g["numero"] == num:
            return g
    return {"numero": num, "nom": f"Guichet {num}", "pole": "autre"}


# ---------------------------------------------------------------------------
# Utilitaires
# ---------------------------------------------------------------------------

def init_guichets():
    """Crée ou met à jour les 16 guichets avec leurs noms et pôles."""
    for cfg in GUICHETS_CONFIG:
        guichets_col.update_one(
            {"numero": cfg["numero"]},
            {
                "$setOnInsert": {
                    "mot_de_passe_hash": generate_password_hash(MOT_DE_PASSE_DEFAUT),
                    "ticket_en_cours": None,
                    "actif": True,
                },
                "$set": {
                    "nom": cfg["nom"],
                    "pole": cfg["pole"],
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


def guichet_le_moins_charge(service=None, pole=None):
    """Numéro du guichet ayant le moins de tickets actifs dans le pôle approprié."""
    if not pole and service:
        pole = SERVICE_TO_POLE.get(service, "inscription")

    candidats = POLES_META.get(pole, {}).get("guichets", [1, 2, 3, 4])
    charges = {i: 0 for i in candidats}

    for row in tickets_col.aggregate(
        [
            {"$match": {"statut": {"$in": list(STATUTS_ACTIFS)}, "guichet": {"$in": candidats}}},
            {"$group": {"_id": "$guichet", "n": {"$sum": 1}}},
        ]
    ):
        if row["_id"] in charges:
            charges[row["_id"]] = row["n"]

    return min(charges, key=lambda n: (charges[n], n))


def serialize_ticket(t):
    g_info = get_guichet_meta(t.get("guichet"))
    date_c = t.get("date_creation")
    if isinstance(date_c, datetime):
        date_str = date_c.isoformat()
    elif date_c:
        date_str = str(date_c)
    else:
        date_str = datetime.utcnow().isoformat()

    return {
        "id": str(t["_id"]),
        "numero": t["numero"],
        "type": t["type"],
        "type_label": TYPES.get(t["type"], t["type"]),
        "service": t["service"],
        "service_label": SERVICES.get(t["service"], t["service"]),
        "guichet": t.get("guichet"),
        "guichet_nom": g_info.get("nom", f"Guichet {t.get('guichet')}"),
        "pole": g_info.get("pole", "autre"),
        "statut": t["statut"],
        "date_creation": date_str,
    }


def serialize_guichet(g):
    g_info = get_guichet_meta(g.get("numero"))
    return {
        "numero": g["numero"],
        "nom": g.get("nom", g_info.get("nom", f"Guichet {g['numero']}")),
        "pole": g.get("pole", g_info.get("pole", "inscription")),
        "actif": g.get("actif", True),
    }


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
    return jsonify({
        "status": "healthy",
        "service": "gestion-patientes-api",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }), 200


@app.route("/api/services")
def services():
    return jsonify({"types": TYPES, "services": SERVICES, "poles": POLES_META})


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
    guichet_choisi = guichet_le_moins_charge(service=service)
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

    # Rangs dans la file :
    # 1. Rang global parmi tous les tickets en attente
    rang_global = tickets_col.count_documents(
        {"statut": "en_attente", "date_creation": {"$lte": ticket["date_creation"]}}
    )
    # 2. Position spécifique sur ce guichet
    position_guichet = tickets_col.count_documents(
        {"guichet": guichet_choisi, "statut": "en_attente", "date_creation": {"$lte": ticket["date_creation"]}}
    )

    reponse = serialize_ticket(ticket)
    reponse["position"] = position_guichet
    reponse["rang"] = rang_global
    reponse["rang_pole"] = position_guichet
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
    """Vue complète des 16 guichets organisés par pôle."""
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
        serialized_queue = []
        for idx, item in enumerate(file_attente):
            st = serialize_ticket(item)
            st["rang_guichet"] = idx + 1
            serialized_queue.append(st)

        g_meta = get_guichet_meta(g["numero"])
        resultat.append(
            {
                "numero": g["numero"],
                "nom": g.get("nom", g_meta["nom"]),
                "pole": g.get("pole", g_meta["pole"]),
                "actif": g.get("actif", True),
                "ticket_en_cours": ticket_en_cours,
                "file_attente": serialized_queue,
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
    return jsonify({"ticket_en_cours": serialize_ticket(suivant), "ticket": serialize_ticket(suivant)})


@app.route("/api/guichets/<int:numero>/terminer", methods=["POST"])
def terminer(numero):
    """Clôture ou réorientation du client en cours.
    Le MÊME numéro suit l'étudiant tout au long de son parcours !
    
    Actions possibles :
    - termine            -> Fin définitive de la visite.
    - avp_paiement       -> Réaffecté au guichet paiement le moins chargé (Caisses 7 à 14).
    - service_numerique  -> Réaffecté au poste numérique le moins chargé (Postes 15 & 16, Dernière étape).
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

    # Redirection : Le MÊME numéro repart vers le nouveau service dans le pôle approprié
    guichets_col.update_one({"numero": numero}, {"$set": {"ticket_en_cours": None}})
    ajouter_historique(ticket_id, "redirection", numero, service=action)

    nouveau_guichet = guichet_le_moins_charge(service=action)
    tickets_col.update_one(
        {"_id": ticket_id},
        {
            "$set": {
                "statut": "en_attente",
                "service": action,
                "guichet": nouveau_guichet,
                "date_creation": datetime.utcnow(),
            }
        },
    )
    ticket = tickets_col.find_one({"_id": ticket_id})
    return jsonify({"message": "ticket redirigé", "ticket": serialize_ticket(ticket)})


@app.route("/api/affichage")
def affichage():
    """Données complètes pour l'écran public du hall :
    - En cours à chaque guichet
    - File d'attente avec RANG (Rang 1, 2, 3...) pour chaque candidat
    - Regroupement par Pôle (Inscription, Concours, Paiement 8 caisses, Numérique 2 postes)
    """
    init_guichets()
    
    tous_en_cours = list(tickets_col.find({"statut": "en_cours"}).sort("date_creation", 1))
    tous_en_attente = list(tickets_col.find({"statut": "en_attente"}).sort("date_creation", 1))

    serialized_en_cours = [serialize_ticket(t) for t in tous_en_cours]
    
    serialized_attente = []
    for idx, t in enumerate(tous_en_attente):
        st = serialize_ticket(t)
        st["rang"] = idx + 1
        serialized_attente.append(st)

    # Regroupement par statut (pour compatibilité)
    par_statut = {}
    for type_ in TYPES:
        par_statut[type_] = {
            "label": TYPES[type_],
            "en_cours": [t for t in serialized_en_cours if t.get("type") == type_],
            "en_attente": [t for t in serialized_attente if t.get("type") == type_],
        }

    # Regroupement par pôle
    par_pole = {}
    for pole_key, meta in POLES_META.items():
        par_pole[pole_key] = {
            "nom": meta["nom"],
            "guichets": meta["guichets"],
            "en_cours": [t for t in serialized_en_cours if t.get("pole") == pole_key],
            "en_attente": [t for t in serialized_attente if t.get("pole") == pole_key],
        }

    return jsonify({
        "en_cours": serialized_en_cours,
        "attente": serialized_attente,
        "par_statut": par_statut,
        "par_pole": par_pole,
        "total_attente": len(serialized_attente),
        "total_en_cours": len(serialized_en_cours),
    })


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
# Health Check & Config
# ---------------------------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check endpoint used by CI/CD, Render, and monitoring."""
    return jsonify({
        "status": "healthy",
        "service": "gestion-patientes-api",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }), 200


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
