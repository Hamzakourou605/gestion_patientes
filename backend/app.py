"""
API Flask - Gestion de file d'attente (16 guichets)
---------------------------------------------------
Résumé du fonctionnement :

- Le patient (étudiant) "scanne" un code -> choisit son statut (Master / Bachelier)
  puis un service (Inscription Master / AVP-Paiement / Service Numérique / Autres).
- Un ticket est créé, numéroté M-0001 / B-0001 (séquence par statut) et affecté
  automatiquement au guichet le moins chargé parmi les 7.
- Chaque guichet possède un compte (numero + mot de passe). Une fois connecté,
  le guichet voit :
    * son client en cours (s'il y en a un) et sa propre file d'attente,
    * la file d'attente globale des 16 guichets,
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
    if not t:
        return None
    g_num = t.get("guichet")
    g_info = get_guichet_meta(g_num) if g_num else {}
    date_c = t.get("date_creation")
    if isinstance(date_c, datetime):
        date_str = date_c.isoformat()
    elif date_c:
        date_str = str(date_c)
    else:
        date_str = datetime.utcnow().isoformat()

    statut = t.get("statut", "WAITING")
    # Harmonisation des statuts
    if statut == "en_attente":
        statut = "WAITING"
    elif statut == "en_cours":
        statut = "IN_PROGRESS"
    elif statut == "termine":
        statut = "COMPLETED"

    return {
        "id": str(t["_id"]),
        "numero": t["numero"],
        "type": t.get("type", "bachelier"),
        "type_label": TYPES.get(t.get("type"), t.get("type", "Bachelier")),
        "service": t.get("service"),
        "service_label": SERVICES.get(t.get("service"), t.get("service")),
        "guichet": g_num,
        "guichet_nom": g_info.get("nom") if g_num else "Non attribué (En attente)",
        "pole": g_info.get("pole") if g_num else SERVICE_TO_POLE.get(t.get("service"), "inscription"),
        "statut": statut,
        "date_creation": date_str,
        "called_at": t.get("called_at").isoformat() if isinstance(t.get("called_at"), datetime) else t.get("called_at"),
    }


def serialize_guichet(g):
    g_info = get_guichet_meta(g.get("numero"))
    etat = g.get("etat", "DISPONIBLE")
    if g.get("ticket_en_cours") and etat == "DISPONIBLE":
        etat = "EN_COURS"

    return {
        "numero": g["numero"],
        "nom": g.get("nom", g_info.get("nom", f"Guichet {g['numero']}")),
        "pole": g.get("pole", g_info.get("pole", "inscription")),
        "etat": etat,
        "actif": etat != "ABSENT",
        "ticket_en_cours": g.get("ticket_en_cours"),
    }


def calculer_position_ticket(t):
    """
    Calcule la position dynamique réelle d'un ticket dans la file :
    - Nombre de personnes en attente créées avant lui dans le même pôle
    - + 1 si lui-même est en attente
    """
    statut = t.get("statut", "WAITING")
    if statut in ("IN_PROGRESS", "en_cours", "CALLED"):
        return 1, 0
    if statut in ("COMPLETED", "termine", "CANCELLED"):
        return 0, 0

    pole = SERVICE_TO_POLE.get(t.get("service"), "inscription")
    services_du_pole = [s for s, p in SERVICE_TO_POLE.items() if p == pole]

    # Nombre de tickets WAITING créés strictement avant lui
    nb_avant = tickets_col.count_documents({
        "service": {"$in": services_du_pole},
        "statut": {"$in": ["WAITING", "en_attente"]},
        "date_creation": {"$lt": t["date_creation"]}
    })

    position = nb_avant + 1
    personnes_avant = nb_avant

    return position, personnes_avant


def ajouter_historique(ticket_id, action, guichet=None, service=None):
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
# Authentification & Gestion des Guichets
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
# Scan / Création & Suivi du Ticket
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
    """
    Crée un ticket après le scan :
    RÈGLE CENTRALE : guichet = None au départ !
    Le ticket entre dans la file globale de son service. Aucun guichet n'est attribué.
    """
    data = request.get_json(force=True) or {}
    type_ = data.get("type", "bachelier")
    service = data.get("service")

    if type_ not in TYPES:
        type_ = "bachelier"
    if service not in SERVICES:
        return jsonify({"erreur": "service invalide"}), 400

    init_guichets()
    numero = prochain_numero(type_)

    ticket = {
        "numero": numero,
        "type": type_,
        "service": service,
        "guichet": None,  # <- FILE GLOBALE : Aucun guichet attribué immédiatement !
        "statut": "WAITING",
        "date_creation": datetime.utcnow(),
        "called_at": None,
        "completed_at": None,
        "historique": [
            {
                "action": "creation",
                "guichet": None,
                "service": service,
                "horodatage": datetime.utcnow(),
            }
        ],
    }
    result = tickets_col.insert_one(ticket)
    ticket["_id"] = result.inserted_id

    pos, avant = calculer_position_ticket(ticket)
    reponse = serialize_ticket(ticket)
    reponse["position"] = pos
    reponse["personnes_avant"] = avant
    reponse["rang"] = pos
    return jsonify(reponse), 201


@app.route("/api/tickets/<identifiant>", methods=["GET"])
def obtenir_ticket(identifiant):
    """
    Récupère l'état et la position dynamique d'un ticket.
    Permet au smartphone de l'utilisateur de se synchroniser en direct :
    - Avant appel : guichet = null, position = X, personnes_avant = X-1
    - Après appel : guichet = 2, statut = IN_PROGRESS, message = 'VOTRE TOUR !'
    """
    t = tickets_col.find_one({"numero": identifiant})
    if not t:
        try:
            from bson import ObjectId
            t = tickets_col.find_one({"_id": ObjectId(identifiant)})
        except Exception:
            pass

    if not t:
        return jsonify({"erreur": "ticket introuvable"}), 404

    rep = serialize_ticket(t)
    pos, avant = calculer_position_ticket(t)
    rep["position"] = pos
    rep["personnes_avant"] = avant
    rep["rang"] = pos
    return jsonify(rep)


@app.route("/api/tickets", methods=["GET"])
def lister_tickets():
    query = {}
    for champ in ("type", "statut", "service"):
        val = request.args.get(champ)
        if val:
            query[champ] = val
    guichet = request.args.get("guichet")
    if guichet:
        query["guichet"] = int(guichet)

    tickets = list(tickets_col.find(query).sort("date_creation", 1))
    return jsonify([serialize_ticket(t) for t in tickets])


# ---------------------------------------------------------------------------
# Gestion des Guichets (États, Appel Suivant, Pause, Absence)
# ---------------------------------------------------------------------------

@app.route("/api/guichets")
def lister_guichets():
    """Vue complète des 16 guichets avec leur état réel et leur file de pôle."""
    init_guichets()
    resultat = []
    for g in guichets_col.find().sort("numero", 1):
        g_meta = get_guichet_meta(g["numero"])
        ticket_en_cours = None
        if g.get("ticket_en_cours"):
            t = tickets_col.find_one({"_id": g["ticket_en_cours"]})
            if t:
                ticket_en_cours = serialize_ticket(t)

        pole = g.get("pole", g_meta["pole"])
        services_du_pole = [s for s, p in SERVICE_TO_POLE.items() if p == pole]

        # File d'attente globale des tickets WAITING de ce pôle
        file_attente = list(
            tickets_col.find({
                "service": {"$in": services_du_pole},
                "statut": {"$in": ["WAITING", "en_attente"]}
            }).sort("date_creation", 1)
        )
        serialized_queue = []
        for idx, item in enumerate(file_attente):
            st = serialize_ticket(item)
            st["rang"] = idx + 1
            st["personnes_avant"] = idx
            serialized_queue.append(st)

        etat = g.get("etat", "DISPONIBLE")
        if ticket_en_cours and etat == "DISPONIBLE":
            etat = "EN_COURS"

        resultat.append(
            {
                "numero": g["numero"],
                "nom": g.get("nom", g_meta["nom"]),
                "pole": pole,
                "etat": etat,
                "actif": etat != "ABSENT",
                "ticket_en_cours": ticket_en_cours,
                "file_attente": serialized_queue,
            }
        )
    return jsonify(resultat)


@app.route("/api/guichets/<int:numero>/suivant", methods=["POST"])
def client_suivant(numero):
    """
    APPELER LE SUIVANT :
    Le guichet décide explicitement de prendre le prochain ticket.
    Sélection ATOMIQUE du plus ancien ticket WAITING de son pôle.
    Aucune double attribution possible entre guichets simultanés.
    """
    init_guichets()
    g = guichets_col.find_one({"numero": numero})
    if not g:
        return jsonify({"erreur": "guichet introuvable"}), 404

    etat = g.get("etat", "DISPONIBLE")
    if etat == "PAUSE":
        return jsonify({"erreur": "Ce guichet est EN PAUSE. Veuillez reprendre le service avant d'appeler."}), 400
    if etat == "ABSENT":
        return jsonify({"erreur": "Ce guichet est marqué ABSENT. Veuillez l'activer avant d'appeler."}), 400
    if g.get("ticket_en_cours"):
        return jsonify({"erreur": "Un candidat est déjà en cours de traitement. Terminez-le d'abord."}), 400

    pole = g.get("pole", get_guichet_meta(numero)["pole"])
    services_eligibles = [s for s, p in SERVICE_TO_POLE.items() if p == pole]

    # Attribution atomique avec find_one_and_update
    suivant = tickets_col.find_one_and_update(
        {
            "statut": {"$in": ["WAITING", "en_attente"]},
            "service": {"$in": services_eligibles},
        },
        {
            "$set": {
                "statut": "IN_PROGRESS",
                "guichet": numero,
                "called_at": datetime.utcnow(),
            },
            "$push": {
                "historique": {
                    "action": "appel",
                    "guichet": numero,
                    "service": pole,
                    "horodatage": datetime.utcnow(),
                }
            }
        },
        sort=[("date_creation", 1)],
        return_document=ReturnDocument.AFTER
    )

    if not suivant:
        guichets_col.update_one({"numero": numero}, {"$set": {"etat": "DISPONIBLE", "ticket_en_cours": None}})
        return jsonify({"message": "Aucun candidat en attente pour ce service.", "ticket": None, "ticket_en_cours": None})

    guichets_col.update_one(
        {"numero": numero},
        {"$set": {"etat": "EN_COURS", "ticket_en_cours": suivant["_id"]}}
    )

    ticket_ser = serialize_ticket(suivant)
    return jsonify({
        "ok": True,
        "ticket": ticket_ser,
        "ticket_en_cours": ticket_ser,
    })


@app.route("/api/guichets/<int:numero>/pause", methods=["POST"])
def guichet_pause(numero):
    """Met le guichet en pause : ne peut plus appeler le suivant."""
    guichets_col.update_one({"numero": numero}, {"$set": {"etat": "PAUSE"}})
    return jsonify({"ok": True, "etat": "PAUSE", "numero": numero})


@app.route("/api/guichets/<int:numero>/reprendre", methods=["POST"])
@app.route("/api/guichets/<int:numero>/resume", methods=["POST"])
def guichet_reprendre(numero):
    """Sort de la pause et redevient DISPONIBLE (ou EN_COURS si ticket actif)."""
    g = guichets_col.find_one({"numero": numero})
    ticket_actif = False
    if g and g.get("ticket_en_cours"):
        t = tickets_col.find_one({"_id": g["ticket_en_cours"], "statut": {"$in": ["IN_PROGRESS", "en_cours"]}})
        if t:
            ticket_actif = True
        else:
            guichets_col.update_one({"numero": numero}, {"$set": {"ticket_en_cours": None}})

    nouvel_etat = "EN_COURS" if ticket_actif else "DISPONIBLE"
    guichets_col.update_one({"numero": numero}, {"$set": {"etat": nouvel_etat}})
    return jsonify({"ok": True, "etat": nouvel_etat, "numero": numero})


@app.route("/api/guichets/<int:numero>/absent", methods=["POST"])
def guichet_absent(numero):
    """Marque le guichet comme absent (fermé temporairement)."""
    guichets_col.update_one({"numero": numero}, {"$set": {"etat": "ABSENT"}})
    return jsonify({"ok": True, "etat": "ABSENT", "numero": numero})


@app.route("/api/guichets/<int:numero>/activer", methods=["POST"])
@app.route("/api/guichets/<int:numero>/activate", methods=["POST"])
def guichet_activer(numero):
    """Réactive un guichet qui était absent."""
    guichets_col.update_one({"numero": numero}, {"$set": {"etat": "DISPONIBLE"}})
    return jsonify({"ok": True, "etat": "DISPONIBLE", "numero": numero})


@app.route("/api/guichets/<int:numero>/next", methods=["POST"])
def guichet_next(numero):
    return client_suivant(numero)


@app.route("/api/tickets/<string:ticket_id>/complete", methods=["POST"])
def ticket_complete(ticket_id):
    query = {"$or": [{"numero": ticket_id}]}
    if ObjectId.is_valid(ticket_id):
        query["$or"].append({"_id": ObjectId(ticket_id)})
    t = tickets_col.find_one(query)
    if not t:
        return jsonify({"erreur": "ticket introuvable"}), 404
    tickets_col.update_one(
        {"_id": t["_id"]},
        {"$set": {"statut": "COMPLETED", "completed_at": datetime.utcnow()}}
    )
    if t.get("guichet"):
        guichets_col.update_one(
            {"numero": t["guichet"]},
            {"$set": {"ticket_en_cours": None, "etat": "DISPONIBLE"}}
        )
    return jsonify({"ok": True, "statut": "COMPLETED"})


@app.route("/api/guichets/<int:numero>/terminer", methods=["POST"])
def terminer(numero):
    """
    Clôture ou réorientation du client en cours.
    - termine: status = COMPLETED, guichet redevient DISPONIBLE.
    - avp_paiement: MÊME numéro envoyé dans la file Paiement (guichet = null).
    - service_numerique: MÊME numéro envoyé dans la file Numérique (guichet = null).
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
        tickets_col.update_one(
            {"_id": ticket_id},
            {
                "$set": {
                    "statut": "COMPLETED",
                    "completed_at": datetime.utcnow(),
                }
            }
        )
        ajouter_historique(ticket_id, "termine", numero)
        guichets_col.update_one(
            {"numero": numero},
            {"$set": {"ticket_en_cours": None, "etat": "DISPONIBLE"}}
        )
        return jsonify({"message": "visite terminée", "statut": "COMPLETED"})

    # Transfert : Le MÊME numéro repart dans la file globale du nouveau pôle avec guichet = None !
    guichets_col.update_one(
        {"numero": numero},
        {"$set": {"ticket_en_cours": None, "etat": "DISPONIBLE"}}
    )
    ajouter_historique(ticket_id, "redirection", numero, service=action)

    tickets_col.update_one(
        {"_id": ticket_id},
        {
            "$set": {
                "statut": "WAITING",
                "service": action,
                "guichet": None,  # Repart en attente d'un guichet libre dans ce pôle
                "date_creation": datetime.utcnow(),
                "called_at": None,
            }
        },
    )
    ticket = tickets_col.find_one({"_id": ticket_id})
    return jsonify({"message": "ticket redirigé vers file d'attente", "ticket": serialize_ticket(ticket)})


@app.route("/api/affichage")
def affichage():
    """
    Données complètes pour le grand écran public :
    - ÉTAT DE TOUS LES GUICHETS (ACTIF, DISPONIBLE, EN PAUSE, ABSENT)
    - Tickets actuellement appelés
    - Prochains tickets en attente dans la file avec leur RANG exact
    - Compteurs globaux
    """
    init_guichets()

    # 1. Tous les 16 guichets avec leur état réel
    guichets_list = []
    for g in guichets_col.find().sort("numero", 1):
        g_meta = get_guichet_meta(g["numero"])
        t_en_cours = None
        if g.get("ticket_en_cours"):
            t_obj = tickets_col.find_one({"_id": g["ticket_en_cours"]})
            if t_obj:
                t_en_cours = serialize_ticket(t_obj)

        etat = g.get("etat", "DISPONIBLE")
        if t_en_cours and etat == "DISPONIBLE":
            etat = "EN_COURS"

        guichets_list.append({
            "numero": g["numero"],
            "nom": g.get("nom", g_meta["nom"]),
            "pole": g.get("pole", g_meta["pole"]),
            "etat": etat,
            "ticket_en_cours": t_en_cours,
        })

    # 2. Tickets appelés / en cours (triés par heure d'appel la plus récente)
    appeles = [g["ticket_en_cours"] for g in guichets_list if g["ticket_en_cours"]]
    appeles = sorted(appeles, key=lambda x: x.get("called_at") or x.get("date_creation") or "", reverse=True)

    # 3. File d'attente globale (statut WAITING uniquement)
    attente_cursor = list(tickets_col.find({"statut": {"$in": ["WAITING", "en_attente"]}}).sort("date_creation", 1))
    prochains_tickets = []
    for idx, t in enumerate(attente_cursor):
        st = serialize_ticket(t)
        st["rang"] = idx + 1
        st["personnes_avant"] = idx
        prochains_tickets.append(st)

    return jsonify({
        "guichets": guichets_list,
        "derniers_appeles": appeles,
        "en_cours": appeles,
        "attente": prochains_tickets,
        "prochains_tickets": prochains_tickets[:16],
        "total_attente": len(prochains_tickets),
        "total_en_cours": len(appeles),
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
