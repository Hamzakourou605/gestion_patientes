import React, { useState, useEffect, useRef } from "react";
import { getTicketStatus } from "../api";

const SERVICE_COLORS = {
  inscription: "#6366f1",
  paiement:    "#10b981",
  numerique:   "#f59e0b",
  concours:    "#ef4444",
};

const SERVICE_ICONS = {
  inscription: "📋",
  paiement:    "💳",
  numerique:   "💻",
  concours:    "🏆",
};

function PositionRing({ position, total, color }) {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? Math.max(0, (total - position + 1) / total) : 1;
  const offset = circumference * (1 - pct);

  return (
    <div style={{ position: "relative", width: "160px", height: "160px" }}>
      <svg width="160" height="160" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="80" cy="80" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
        <circle
          cx="80" cy="80" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease", filter: `drop-shadow(0 0 8px ${color})` }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "36px", fontWeight: 900, lineHeight: 1, color,
        }}>
          {position}
        </div>
        <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>position</div>
      </div>
    </div>
  );
}

export default function MobileScanView() {
  const [ticketNum, setTicketNum] = useState("");
  const [inputVal, setInputVal] = useState("");
  const [ticketData, setTicketData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const pollRef = useRef(null);
  const prevStatusRef = useRef(null);

  // Auto-detect ticket from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("ticket");
    if (t) {
      setInputVal(t);
      setTicketNum(t);
    }
  }, []);

  const fetchTicket = async (num) => {
    if (!num) return;
    try {
      const data = await getTicketStatus(num);
      setTicketData(data);
      setLastUpdate(new Date());
      setError("");

      // Notify on status change
      if (prevStatusRef.current && prevStatusRef.current !== data.statut) {
        if (data.statut === "IN_PROGRESS") {
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            [523, 659, 784, 1047].forEach((f, i) => {
              const osc = ctx.createOscillator();
              const g = ctx.createGain();
              osc.frequency.value = f;
              g.gain.setValueAtTime(0.4, ctx.currentTime + i * 0.15);
              g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.3);
              osc.connect(g); g.connect(ctx.destination);
              osc.start(ctx.currentTime + i * 0.15);
              osc.stop(ctx.currentTime + i * 0.15 + 0.35);
            });
          } catch {}
        }
      }
      prevStatusRef.current = data.statut;
    } catch (err) {
      if (!ticketData) setError("Ticket introuvable");
    }
  };

  useEffect(() => {
    if (!ticketNum) {
      clearInterval(pollRef.current);
      return;
    }
    setLoading(true);
    fetchTicket(ticketNum).finally(() => setLoading(false));
    pollRef.current = setInterval(() => fetchTicket(ticketNum), 5000);
    return () => clearInterval(pollRef.current);
  }, [ticketNum]);

  const handleSearch = (e) => {
    e.preventDefault();
    const val = inputVal.trim().toUpperCase();
    if (!val) return;
    setTicketNum(val);
    setTicketData(null);
    setError("");
  };

  const handleReset = () => {
    clearInterval(pollRef.current);
    setTicketNum("");
    setTicketData(null);
    setInputVal("");
    setError("");
    prevStatusRef.current = null;
  };

  const color = SERVICE_COLORS[ticketData?.service] || "#6366f1";
  const svcIcon = SERVICE_ICONS[ticketData?.service] || "🎫";
  const statut = ticketData?.statut;
  const rang = ticketData?.rang;
  const avant = ticketData?.personnes_avant;

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #080d18 0%, #0f172a 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "32px 20px",
      fontFamily: "'Inter', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=JetBrains+Mono:wght@600;700;800&display=swap');
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes calledPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(6,182,212,0.4); }
          70% { box-shadow: 0 0 0 20px rgba(6,182,212,0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <div style={{ fontSize: "32px", marginBottom: "8px", animation: "float 3s ease infinite" }}>🎫</div>
        <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#f1f5f9", marginBottom: "4px" }}>
          Suivi de ticket
        </h1>
        <p style={{ color: "#64748b", fontSize: "13px" }}>UIR — File d'attente intelligente</p>
      </div>

      {/* Search */}
      {!ticketNum && (
        <form onSubmit={handleSearch} style={{ width: "100%", maxWidth: "340px", marginBottom: "24px" }}>
          <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
            Entrez votre numéro de ticket
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              id="ticket-input"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              placeholder="I-0001, P-0003..."
              style={{
                flex: 1,
                padding: "14px 16px",
                background: "rgba(30,42,58,0.9)",
                border: "1px solid rgba(99,102,241,0.3)",
                borderRadius: "12px",
                color: "#f1f5f9",
                fontSize: "16px",
                fontFamily: "'JetBrains Mono', monospace",
                outline: "none",
                textTransform: "uppercase",
              }}
            />
            <button
              type="submit"
              style={{
                padding: "14px 18px",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border: "none",
                borderRadius: "12px",
                color: "white",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: "16px",
              }}
            >
              🔍
            </button>
          </div>
          {error && (
            <div style={{ color: "#f87171", fontSize: "13px", marginTop: "8px", textAlign: "center" }}>
              ⚠️ {error}
            </div>
          )}
        </form>
      )}

      {/* Loading spinner */}
      {loading && !ticketData && (
        <div style={{ textAlign: "center", color: "#64748b" }}>
          <div style={{
            width: "40px", height: "40px",
            border: "3px solid rgba(99,102,241,0.2)",
            borderTop: "3px solid #6366f1",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 12px",
          }} />
          Recherche...
        </div>
      )}

      {/* Ticket Display */}
      {ticketData && (
        <div style={{
          width: "100%",
          maxWidth: "360px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}>
          {/* Main ticket card */}
          <div style={{
            background: statut === "IN_PROGRESS"
              ? "rgba(6,182,212,0.08)"
              : "rgba(30,42,58,0.9)",
            border: `2px solid ${statut === "IN_PROGRESS" ? "#06b6d4" : color}`,
            borderRadius: "20px",
            padding: "28px 24px",
            textAlign: "center",
            boxShadow: statut === "IN_PROGRESS"
              ? "0 0 30px rgba(6,182,212,0.2)"
              : `0 10px 40px ${color}20`,
            animation: statut === "IN_PROGRESS" ? "calledPulse 2s infinite" : "none",
            position: "relative",
            overflow: "hidden",
          }}>
            {/* Top gradient */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: "3px",
              background: `linear-gradient(90deg, ${statut === "IN_PROGRESS" ? "#06b6d4" : color}, #8b5cf6)`,
            }} />

            {/* Service badge */}
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: `${statut === "IN_PROGRESS" ? "#06b6d4" : color}22`,
              border: `1px solid ${statut === "IN_PROGRESS" ? "#06b6d4" : color}44`,
              borderRadius: "999px",
              padding: "4px 14px",
              fontSize: "12px",
              fontWeight: 700,
              color: statut === "IN_PROGRESS" ? "#22d3ee" : color,
              marginBottom: "16px",
            }}>
              {svcIcon} {ticketData.service_nom || ticketData.service}
            </div>

            {/* Ticket number */}
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "clamp(2.5rem, 15vw, 4rem)",
              fontWeight: 900,
              color: statut === "IN_PROGRESS" ? "#22d3ee" : color,
              lineHeight: 1,
              marginBottom: "20px",
              textShadow: `0 0 30px ${statut === "IN_PROGRESS" ? "rgba(6,182,212,0.5)" : `${color}50`}`,
            }}>
              {ticketData.numero}
            </div>

            {/* Status display */}
            {statut === "COMPLETED" && (
              <div style={{ color: "#10b981", fontWeight: 800, fontSize: "18px" }}>
                ✅ Visite terminée
              </div>
            )}

            {statut === "IN_PROGRESS" && (
              <div>
                <div style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#22d3ee",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: "8px",
                }}>
                  📢 C'est votre tour !
                </div>
                <div style={{
                  background: "rgba(6,182,212,0.12)",
                  border: "1px solid rgba(6,182,212,0.3)",
                  borderRadius: "12px",
                  padding: "12px 20px",
                  fontSize: "24px",
                  fontWeight: 900,
                  color: "#22d3ee",
                }}>
                  {ticketData.station_label || "Veuillez vous présenter"}
                </div>
              </div>
            )}

            {statut === "WAITING" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                {rang === 1 ? (
                  <div style={{
                    background: "rgba(16,185,129,0.12)",
                    border: "1px solid rgba(16,185,129,0.4)",
                    borderRadius: "12px",
                    padding: "12px 20px",
                    color: "#34d399",
                    fontWeight: 800,
                    fontSize: "16px",
                  }}>
                    🎯 Vous êtes le prochain !
                  </div>
                ) : (
                  <PositionRing position={rang} total={avant + rang} color={color} />
                )}

                <div style={{
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: "10px",
                  padding: "12px 20px",
                  width: "100%",
                }}>
                  <div style={{ fontSize: "28px", fontWeight: 900, color: "#f1f5f9" }}>
                    {avant}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>
                    personne{avant > 1 ? "s" : ""} avant vous
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Info bar */}
          {lastUpdate && (
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 14px",
              background: "rgba(30,42,58,0.5)",
              borderRadius: "8px",
              fontSize: "11px",
              color: "#475569",
            }}>
              <span>Mise à jour toutes les 5s</span>
              <span>{lastUpdate.toLocaleTimeString("fr-FR")}</span>
            </div>
          )}

          {/* Reset button */}
          <button
            onClick={handleReset}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "10px",
              padding: "10px",
              color: "#64748b",
              cursor: "pointer",
              fontSize: "13px",
              fontFamily: "inherit",
            }}
          >
            🔍 Chercher un autre ticket
          </button>
        </div>
      )}
    </div>
  );
}
