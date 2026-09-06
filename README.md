# Gestion de file d'attente — 7 guichets (React + Flask + MongoDB)

Application de gestion de file d'attente pour un service de scolarité :
un étudiant scanne un code, choisit son statut (Master / Bachelier) puis son
service, et reçoit un ticket numéroté automatiquement affecté au guichet le
moins chargé parmi 7.

## Fonctionnalités

- **Ticket automatique** : numéroté `M-0001` / `B-0001` (séquence propre à
  chaque statut), affecté au guichet le moins chargé parmi les 7 guichets.
- **Bornes / scan** (`/kiosk`) : l'étudiant choisit Master ou Bachelier, puis
  un service : *Inscription Master*, *AVP / Paiement Inscription*,
  *Service Numérique*, *Autres*. Il reçoit son ticket avec son numéro et le
  guichet à rejoindre.
- **Écran d'affichage public** (`/affichage`) : numéro en cours à chaque
  guichet, pour Master et Bachelier.
- **Compte guichet** (`/guichet`) : chaque guichet (1 à 7) a son propre
  compte (mot de passe par défaut `guichet123`, modifiable via l'API). Une
  fois connecté, le guichet voit :
  - son **client en cours** et sa **propre file d'attente**,
  - la **file d'attente globale** des 7 guichets (numéro en cours + nombre
    en attente à chacun),
  - ses **statistiques** du jour / des 7 derniers jours / des 30 derniers
    jours (globales ou pour son guichet uniquement).
- **Appel du client suivant** : bouton *Client suivant*, désactivé tant
  qu'un client est déjà en cours à ce guichet.
- **Clôture du client en cours**, avec 3 choix :
  - *Visite terminée* → le ticket est définitivement clos ;
  - *Service numérique* → le **même numéro** repart en file, réaffecté au
    guichet le moins chargé, avec le service "Service Numérique" ;
  - *Paiement inscription* → pareil, avec le service "AVP / Paiement".

## Structure du projet

```
gestion-file-attente/
├── backend/            # API Flask + MongoDB
│   ├── app.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/           # Application React (Create React App)
    ├── package.json
    └── src/
        ├── App.js
        ├── api.js
        ├── index.css
        └── components/
            ├── Accueil.js
            ├── Kiosk.js
            ├── DisplayBoard.js
            └── GuichetPanel.js
```

## Installation

### 1. MongoDB

Utilisez une instance locale (`mongodb://localhost:27017`) ou un cluster
MongoDB Atlas gratuit. Pas besoin de créer les collections à l'avance,
elles sont créées automatiquement au premier démarrage de l'API (les 7
guichets sont créés avec leur compte par défaut).

### 2. Backend (Flask)

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows : venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env          # puis éditez MONGO_URI si besoin

python app.py                 # démarre l'API sur http://localhost:5000
```

### 3. Frontend (React)

```bash
cd frontend
npm install
npm start                     # démarre sur http://localhost:3000
```

Le fichier `package.json` contient déjà `"proxy": "http://localhost:5000"`,
donc les appels à `/api/...` sont automatiquement redirigés vers Flask en
développement.

## Comptes guichets par défaut

| Guichet | Mot de passe |
|---------|--------------|
| 1 à 7   | `guichet123` |

Changez-les via `POST /api/auth/changer-mot-de-passe`
(`{"numero": 3, "ancien": "guichet123", "nouveau": "..."}`).

## Principales routes API

| Méthode | Route | Description |
|---|---|---|
| POST | `/api/tickets` | Crée un ticket après le scan (`type`, `service`) |
| GET | `/api/guichets` | Les 7 guichets : client en cours + file de chacun |
| POST | `/api/auth/login` | Connexion d'un guichet (`numero`, `mot_de_passe`) |
| POST | `/api/guichets/<n>/suivant` | Appelle le prochain client de la file du guichet `n` |
| POST | `/api/guichets/<n>/terminer` | Clôture le client en cours (`action`: `termine` / `service_numerique` / `avp_paiement`) |
| GET | `/api/statistiques?periode=jour\|semaine\|mois&guichet=<n>` | Statistiques (globales si `guichet` absent) |
| GET | `/api/affichage` | Données pour l'écran public |

## Pistes d'amélioration (hors périmètre de ce prototype)

- Mises à jour en temps réel via WebSocket (actuellement : rafraîchissement
  par sondage toutes les 4 secondes).
- Authentification par jeton (JWT) plutôt que session locale simple.
- Génération d'un vrai QR code par ticket et lecture caméra côté borne.
- Export des statistiques (PDF / Excel).
