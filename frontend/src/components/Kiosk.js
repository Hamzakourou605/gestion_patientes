import React, { useState, useEffect, useRef } from "react";
import { creerTicket, getServices, getConfig } from "../api";

const SERVICE_ICONS = {
  inscription: "📋",
  paiement: "💳",
  numerique: "💻",
  concours: "🏆",
};

const SERVICE_DESCRIPTIONS = {
  inscription: "Inscription, dossiers, rendez-vous",
  paiement: "Paiement des frais de scolarité",
  numerique: "Activation compte, services digitaux",
  concours: "Résultats, dossiers concours",
};

function QRCodeDisplay({ ticketNumero, qrData }) {
  // Simple QR-like visual (URL displayed)
  return (
    <div style={{
      background: "white",
      borderRadius: "12px",
      padding: "12px",
      display: "inline-block",
      margin: "0 auto",
    }}>
      <img
        src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrData)}`}
        alt="QR Code"
        width="160"
        height="160"
        style={{ display: "block", borderRadius: "8px" }}
        onError={(e) => { e.target.style.display = "none"; }}
      />
    </div>
  );
}

export default function Kiosk() {
  const [services, setServices] = useState({});
  const [step, setStep] = useState("select"); // select | ticket
  const [selectedService, setSelectedService] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mobileUrl, setMobileUrl] = useState("");
  const [time, setTime] = useState(new Date());
  const timerRef = useRef(null);
  const autoResetRef = useRef(null);

  useEffect(() => {
    getServices()
      .then(setServices)
      .catch(() => {});
    getConfig()
      .then((cfg) => {
        const base = cfg.tunnel_url || cfg.frontend_lan || window.location.origin;
        setMobileUrl(base + "/#/mobile");
      })
      .catch(() => {});

    const clockInterval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(clockInterval);
  }, []);

  useEffect(() => {
    if (step === "ticket") {
      // Auto reset after 30s
      autoResetRef.current = setTimeout(() => handleReset(), 30000);
    }
    return () => clearTimeout(autoResetRef.current);
  }, [step]);

  const handleSelectService = (key) => {
    setSelectedService(key);
  };

  const handleConfirm = async () => {
    if (!selectedService) return;
    setLoading(true);
    setError("");
    try {
      const data = await creerTicket(selectedService);
      setTicket(data);
      setStep("ticket");
      // Play a success beep
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [523, 659, 784].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + i * 0.12);
          osc.stop(ctx.currentTime + i * 0.12 + 0.25);
        });
      } catch {}
    } catch (err) {
      setError(err.response?.data?.erreur || "Erreur lors de la création du ticket");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep("select");
    setSelectedService(null);
    setTicket(null);
    setError("");
    clearTimeout(autoResetRef.current);
  };

  const formatTime = (d) =>
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const formatDate = (d) =>
    d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const svc = ticket ? (services[ticket.service] || {}) : null;
  const svcColor = svc?.color || "#6366f1";

  return (
    <div style={{
      minHeight: "calc(100vh - 64px)",
      background: "linear-gradient(135deg, #0a0e1a 0%, #0f172a 50%, #0a0e1a 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "24px 16px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background decoration */}
      <div style={{
        position: "absolute", top: "-20%", left: "-10%",
        width: "500px", height: "500px",
        background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: "-20%", right: "-10%",
        width: "500px", height: "500px",
        background: "radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Clock */}
      <div style={{
        textAlign: "center", marginBottom: "24px",
        position: "relative", zIndex: 1,
      }}>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "clamp(2rem, 5vw, 3.5rem)",
          fontWeight: 700,
          color: "#f1f5f9",
          letterSpacing: "0.05em",
        }}>
          {formatTime(time)}
        </div>
        <div style={{ color: "#64748b", fontSize: "14px", marginTop: "4px", textTransform: "capitalize" }}>
          {formatDate(time)}
        </div>
      </div>

      {/* ─── STEP: SELECT ─── */}
      {step === "select" && (
        <div style={{ width: "100%", maxWidth: "700px", position: "relative", zIndex: 1 }} className="animate-fade-in">
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2.2rem)", fontWeight: 800, color: "#f1f5f9" }}>
              Bienvenue à <span style={{ color: "#818cf8" }}>l'UIR</span>
            </h1>
            <p style={{ color: "#94a3b8", marginTop: "8px", fontSize: "16px" }}>
              Sélectionnez votre service pour obtenir un ticket
            </p>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "16px",
          }}>
            {Object.entries(services).map(([key, cfg]) => {
              const isSelected = selectedService === key;
              const color = cfg.color || "#6366f1";
              return (
                <button
                  key={key}
                  id={`service-btn-${key}`}
                  onClick={() => handleSelectService(key)}
                  style={{
                    background: isSelected
                      ? `linear-gradient(135deg, ${color}22, ${color}11)`
                      : "rgba(30,42,58,0.8)",
                    border: `2px solid ${isSelected ? color : "rgba(255,255,255,0.06)"}`,
                    borderRadius: "16px",
                    padding: "28px 20px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "12px",
                    transform: isSelected ? "scale(1.02)" : "scale(1)",
                    boxShadow: isSelected ? `0 8px 30px ${color}30` : "none",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {isSelected && (
                    <div style={{
                      position: "absolute", top: "12px", right: "12px",
                      background: color,
                      borderRadius: "50%",
                      width: "22px", height: "22px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "12px",
                    }}>✓</div>
                  )}
                  <div style={{ fontSize: "3rem" }}>{SERVICE_ICONS[key] || "📋"}</div>
                  <div>
                    <div style={{
                      fontSize: "18px", fontWeight: 700, color: isSelected ? color : "#f1f5f9",
                      marginBottom: "4px",
                    }}>
                      {cfg.nom}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>
                      {SERVICE_DESCRIPTIONS[key] || cfg.nom_complet}
                    </div>
                    <div style={{
                      marginTop: "8px",
                      display: "inline-block",
                      background: `${color}22`,
                      color: color,
                      borderRadius: "999px",
                      padding: "2px 10px",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}>
                      {cfg.nb_postes} {cfg.label_poste}{cfg.nb_postes > 1 ? "s" : ""}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {error && (
            <div style={{
              marginTop: "16px",
              padding: "12px 16px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "10px",
              color: "#f87171",
              fontSize: "14px",
              textAlign: "center",
            }}>
              ⚠️ {error}
            </div>
          )}

          <button
            id="confirm-service-btn"
            onClick={handleConfirm}
            disabled={!selectedService || loading}
            className="btn btn-primary btn-lg"
            style={{ width: "100%", marginTop: "24px", fontSize: "17px", padding: "16px" }}
          >
            {loading ? (
              <>⏳ Création du ticket...</>
            ) : selectedService ? (
              <>🎟️ Obtenir mon ticket — {services[selectedService]?.nom}</>
            ) : (
              <>Sélectionnez un service</>
            )}
          </button>
        </div>
      )}

      {/* ─── STEP: TICKET ─── */}
      {step === "ticket" && ticket && (
        <div style={{
          width: "100%", maxWidth: "420px",
          position: "relative", zIndex: 1,
          display: "flex", flexDirection: "column", alignItems: "center", gap: "20px",
        }} className="animate-scale-in">
          {/* Ticket Card */}
          <div style={{
            width: "100%",
            background: "rgba(30,42,58,0.9)",
            border: `2px solid ${svcColor}`,
            borderRadius: "24px",
            padding: "32px 28px",
            textAlign: "center",
            boxShadow: `0 20px 60px ${svcColor}30`,
            position: "relative",
            overflow: "hidden",
          }}>
            {/* Top gradient bar */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: "4px",
              background: `linear-gradient(90deg, ${svcColor}, #8b5cf6)`,
            }} />

            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: `${svcColor}22`,
              border: `1px solid ${svcColor}44`,
              borderRadius: "999px",
              padding: "6px 16px",
              marginBottom: "20px",
              fontSize: "13px",
              fontWeight: 600,
              color: svcColor,
            }}>
              {SERVICE_ICONS[ticket.service]} {svc?.nom || ticket.service}
            </div>

            <div style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Votre numéro
            </div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "clamp(3rem, 12vw, 5rem)",
              fontWeight: 900,
              color: svcColor,
              letterSpacing: "0.05em",
              lineHeight: 1,
              marginBottom: "20px",
              textShadow: `0 0 40px ${svcColor}60`,
            }}>
              {ticket.numero}
            </div>

            {/* Position */}
            {ticket.rang !== undefined && (
              <div style={{
                background: "rgba(255,255,255,0.04)",
                borderRadius: "12px",
                padding: "14px",
                marginBottom: "20px",
              }}>
                {ticket.rang === 1 && ticket.statut === "WAITING" ? (
                  <div style={{ color: "#10b981", fontWeight: 700, fontSize: "16px" }}>
                    🎯 Vous êtes le prochain !
                  </div>
                ) : ticket.statut === "IN_PROGRESS" ? (
                  <div style={{ color: svcColor, fontWeight: 700, fontSize: "16px" }}>
                    📢 Rendez-vous au {ticket.station_label}
                  </div>
                ) : (
                  <>
                    <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: "22px" }}>
                      Position {ticket.rang}
                    </div>
                    <div style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>
                      {ticket.personnes_avant} personne{ticket.personnes_avant > 1 ? "s" : ""} avant vous
                    </div>
                  </>
                )}
              </div>
            )}

            {/* QR code */}
            <div style={{ marginBottom: "16px" }}>
              <QRCodeDisplay
                ticketNumero={ticket.numero}
                qrData={`${mobileUrl}?ticket=${ticket.numero}`}
              />
              <div style={{ color: "#64748b", fontSize: "11px", marginTop: "8px" }}>
                Scannez pour suivre votre position en temps réel
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div style={{
            background: "rgba(30,42,58,0.6)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "12px",
            padding: "16px",
            fontSize: "13px",
            color: "#94a3b8",
            textAlign: "center",
            lineHeight: 1.6,
          }}>
            ℹ️ Gardez ce ticket. Votre numéro sera appelé sur l'écran et annoncé.
          </div>

          <div style={{ display: "flex", gap: "12px", width: "100%" }}>
            <button
              id="new-ticket-btn"
              onClick={handleReset}
              className="btn btn-ghost"
              style={{ flex: 1 }}
            >
              ← Nouveau ticket
            </button>
          </div>

          <div style={{ color: "#475569", fontSize: "12px" }}>
            Réinitialisation automatique dans 30 secondes
          </div>
        </div>
      )}
    </div>
  );
}
