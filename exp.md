# Gestion de file d’attente – Explication du projet

## 1. Objectif de l’application

Cette application est un système de gestion de file d’attente pour un service public ou une structure de soins. Elle permet de :

- créer un ticket pour un patient ou un client,
- attribuer ce ticket à un service,
- affecter automatiquement ou manuellement un guichet,
- afficher la file d’attente pour les agents,
- afficher la file globale sur un grand écran public,
- suivre les tickets en cours, en attente et clôturés.

Le but principal est de fluidifier l’accueil, éviter la confusion et améliorer le suivi de chaque personne dans la file.

---

## 2. Architecture globale

Le projet est divisé en deux grandes parties :

### Backend
Le backend est développé avec Python et Flask dans le dossier [backend/app.py](backend/app.py).

Il s’occupe de :

- recevoir les demandes du frontend,
- gérer la logique des tickets,
- attribuer les guichets,
- stocker les données dans MongoDB,
- exposer les API nécessaires au frontend.

### Frontend
Le frontend est développé avec React dans le dossier [frontend/src](frontend/src).

Il affiche :

- la page d’accueil,
- le choix des services,
- la création des tickets,
- le tableau des guichets,
- le grand écran public.

---

## 3. Les composants principaux

### 3.1 Accueil
Le fichier [frontend/src/components/Accueil.js](frontend/src/components/Accueil.js) représente la page d’accueil de l’application.

Ici, l’utilisateur choisit le service concerné, par exemple :

- consultation,
- pharmacie,
- accueil administratif,
- autre service.

### 3.2 MobileScanView
Le fichier [frontend/src/components/MobileScanView.js](frontend/src/components/MobileScanView.js) est utilisé pour créer un ticket.

Cette vue permet de :

- sélectionner le service,
- scanner ou choisir une demande,
- générer un ticket,
- envoyer la demande au backend.

### 3.3 GuichetPanel
Le fichier [frontend/src/components/GuichetPanel.js](frontend/src/components/GuichetPanel.js) correspond à l’interface de travail d’un guichet.

Cette page permet à l’agent de voir :

- les tickets dans la file d’attente,
- le ticket actuellement traité,
- les tickets appelés,
- les actions suivantes (suivant, clôturer, etc.).

### 3.4 DisplayBoard
Le fichier [frontend/src/components/DisplayBoard.js](frontend/src/components/DisplayBoard.js) représente l’écran public affiché sur un grand écran.

Il montre :

- la file d’attente globale,
- les tickets en cours,
- les informations par guichet,
- les statistiques globales.

### 3.5 Header
Le fichier [frontend/src/components/Header.js](frontend/src/components/Header.js) contient l’en-tête de l’application.

Il affiche généralement :

- le nom du système,
- les informations de l’établissement,
- les statistiques de guichets et de services.

### 3.6 API frontend
Le fichier [frontend/src/api.js](frontend/src/api.js) contient toutes les fonctions qui communiquent avec le backend via Axios.

Il permet d’appeler les endpoints suivants :

- création d’un ticket,
- récupération des guichets,
- récupération de l’affichage public,
- appel du ticket suivant,
- clôture d’un ticket.

---

## 4. Le flux complet d’un ticket

### Étape 1 : sélection du service
Un agent ou un usager commence par choisir le service souhaité depuis l’accueil.

Exemple :

- Consultation générale
- Service administratif
- Pharmacie

### Étape 2 : création du ticket
Le système envoie une demande au backend avec le service choisi.

Le backend crée alors un ticket avec un numéro automatique, par exemple :

- C-001
- C-002
- P-015

### Étape 3 : attribution au guichet
Le backend analyse le service demandé et détermine le guichet adapté.

Le ticket est ensuite placé dans la file d’attente de ce guichet.

### Étape 4 : affichage côté guichet
L’agent du guichet ouvre son panneau et voit la liste des personnes en attente.

Il peut alors :

- appeler le prochain ticket,
- traiter le dossier,
- clôturer le ticket après service.

### Étape 5 : affichage public
Sur le grand écran, la liste d’attente globale est rafraîchie automatiquement. Les clients peuvent voir :

- le prochain ticket attendu,
- les guichets actifs,
- l’état de la file d’attente.

---

## 5. Comment fonctionne le backend

Le backend Flask dans [backend/app.py](backend/app.py) contient les routes principales suivantes :

### 5.1 POST /api/tickets
Cette route permet de créer un ticket.

Elle reçoit normalement :

- le service demandé,
- éventuellement d’autres informations liées à la demande.

Elle renvoie ensuite :

- le ticket créé,
- son numéro,
- son guichet d’affectation,
- son état initial.

### 5.2 GET /api/guichets
Cette route renvoie la liste des guichets et leur file d’attente.

Elle permet au frontend d’afficher :

- quels guichets sont ouverts,
- la file de chaque guichet,
- le ticket en cours,
- l’état de la file.

### 5.3 GET /api/affichage
Cette route sert au grand écran public.

Elle retourne des informations globales, comme :

- les tickets en cours,
- la file d’attente,
- les statistiques par statut,
- les statistiques par pôle,
- le nombre total en attente,
- le nombre total en cours.

---

## 6. Rôle de MongoDB

MongoDB est utilisé pour stocker les données du système, notamment :

- les tickets,
- leurs statuts,
- les guichets,
- les services,
- les informations liées à l’affectation.

Cela permet :

- de garder une trace des files,
- de retrouver les tickets passés,
- de savoir qui est en cours,
- de gérer les statistiques.

---

## 7. Comment la mise à jour en temps réel fonctionne

Le frontend n’a pas besoin d’actualiser manuellement toute la page.

Il exécute régulièrement des requêtes HTTP pour récupérer les dernières données :

- la file du guichet est mise à jour toutes les quelques secondes,
- le grand écran est aussi rafraîchi automatiquement,
- l’interface reflète le vrai état du backend.

Cela rend l’application dynamique et adaptée à un environnement réel avec plusieurs agents et plusieurs personnes dans la file.

---

## 8. Exemple de scénario complet

Voici un exemple concret pour comprendre le fonctionnement :

1. Un patient arrive au service administratif.
2. Il sélectionne le service “administratif”.
3. L’application crée un ticket “A-008”.
4. Le backend attribue le guichet 4.
5. Le guichet 4 voit le ticket dans la file d’attente.
6. L’agent appelle le ticket “A-008”.
7. Le ticket passe en “en cours”.
8. L’écran public affiche que le ticket “A-008” est appelé.
9. L’agent traite le dossier.
10. Lorsque le dossier est terminé, il clôture le ticket.
11. Le système supprime ou marque le ticket comme terminé.
12. Le guichet suivant est alors appelé automatiquement.

---

## 9. Ce que l’application apporte

Cette application apporte plusieurs avantages :

- meilleure organisation de la file d’attente,
- réduction du temps d’attente,
- meilleure visibilité pour les agents,
- meilleure transparence pour les clients,
- suivi plus rapide des dossiers,
- gestion plus claire des services et guichets.

---

## 10. Résumé simple

En résumé, l’application fonctionne comme un système intelligent de gestion des files d’attente :

- l’usager crée un ticket,
- le backend l’assigne à un guichet,
- les agents traitent les demandes,
- le public voit l’état de la file en temps réel,
- tout est géré automatiquement et de manière centralisée.

C’est une solution pratique pour les services d’accueil, les cliniques, les guichets et les établissements qui gèrent beaucoup de demandes.

---

## 11. Fichiers importants à retenir

- [backend/app.py](backend/app.py)
- [frontend/src/api.js](frontend/src/api.js)
- [frontend/src/components/MobileScanView.js](frontend/src/components/MobileScanView.js)
- [frontend/src/components/GuichetPanel.js](frontend/src/components/GuichetPanel.js)
- [frontend/src/components/DisplayBoard.js](frontend/src/components/DisplayBoard.js)
- [frontend/src/components/Accueil.js](frontend/src/components/Accueil.js)

---

## 12. Conclusion

Ce projet est une application complète de gestion de file d’attente avec un frontend interactif et un backend robuste. Il allie simplicité d’utilisation, suivi des tickets, gestion des guichets et visibilité pour tout le monde.

Il est conçu pour fonctionner dans un environnement réel où plusieurs personnes doivent être servies rapidement, clairement et de manière organisée.
