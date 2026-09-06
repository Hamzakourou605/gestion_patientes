import React from "react";
import { Link } from "react-router-dom";

export default function Accueil() {
  return (
    <div>
      <h1 style={{ marginBottom: 6 }}>Gestion de la file d'attente</h1>
      <p style={{ color: "var(--muted)", marginBottom: 26 }}>
        7 guichets, deux files (Master / Bachelier), 4 types de services.
      </p>
      <div className="home-grid">
        <Link to="/kiosk" className="home-card">
          <div className="home-card__title">🎫 Borne (scan)</div>
          <div className="home-card__desc">
            Écran destiné à l'étudiant : scan du code, choix du statut et du
            service, puis remise du ticket.
          </div>
        </Link>
        <Link to="/affichage" className="home-card">
          <div className="home-card__title">📺 Écran d'affichage</div>
          <div className="home-card__desc">
            Écran public affichant, pour Master et Bachelier, le numéro
            appelé à chaque guichet et la file d'attente.
          </div>
        </Link>
        <Link to="/guichet" className="home-card">
          <div className="home-card__title">🧑‍💼 Panneau guichet</div>
          <div className="home-card__desc">
            Utilisé par l'agent d'un guichet pour appeler le numéro suivant
            ou terminer le ticket en cours.
          </div>
        </Link>
      </div>
    </div>
  );
}
