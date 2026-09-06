# Gestion de File d'Attente Intelligente — UIR (React + Flask + MongoDB)

[![CI/CD Pipeline](https://github.com/Hamzakourou605/gestion_patientes/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/Hamzakourou605/gestion_patientes/actions/workflows/ci-cd.yml)

Application complète de gestion de file d'attente pour la scolarité et l'accueil des étudiants à l'**Université Internationale de Rabat (UIR)** :
- Scan QR code sans contact depuis smartphone sur n'importe quel réseau (3G, 4G, 5G, Wi-Fi).
- **16 Postes organisés en 4 Pôles** :
  1. 🎓 **Accueil & Inscriptions** (4 Guichets : Guichets 1 à 4)
  2. 🏆 **Pôle Concours** (2 Postes : Concours 1 & 2)
  3. 💳 **Caisses de Paiement** (8 Caisses : Caisses 1 à 8)
  4. 💻 **Service Numérique** (2 Postes : Numérique 1 & 2 — Dernière étape)
- **Parcours Continu de l'Étudiant** : le **MÊME numéro** suit l'étudiant lors des transferts (ex: Inscription ➜ Paiement ➜ Service Numérique).
- **Grand Écran Public** : format plein écran sans défilement (`h-screen overflow-hidden`) affichant le dernier appel, les postes actifs, et la file d'attente complète avec le **RANG PRÉCIS** de chaque candidat.
- **Pipeline CI/CD Automatisé** via GitHub Actions (Tests Pytest, Linting flake8, Build React, et Déploiement Render).

## 🚀 Pipeline CI/CD (GitHub Actions)

Le workflow `.github/workflows/ci-cd.yml` s'exécute automatiquement à chaque `push` ou `pull request` sur la branche `main` :
1. **Backend CI** :
   - Setup Python 3.11 avec cache `pip`
   - Vérification syntaxique & linting `flake8`
   - Exécution de la suite de tests unitaires `pytest backend/tests/test_api.py`
2. **Frontend CI** :
   - Setup Node.js 20 avec cache `npm`
   - Installation des dépendances et exécution des tests
   - Compilation du bundle de production optimisé (`npm run build`)
3. **CD Render** :
   - Déclenchement automatique du déploiement via Render GitHub Integration et Webhooks.

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
