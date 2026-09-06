import React, { useState, useEffect, useRef } from "react";
import { getAffichage } from "../api";

const STATE_CONFIG = {
  DISPONIBLE: { label: "Disponible", color: "#6366f1", dot: "#6366f1" },
  EN_COURS:   { label: "En cours",   color: "#06b6d4", dot: "#06b6d4" },
  PAUSE:      { label: "En pause",   color: "#f59e0b", dot: "#f59e0b" },
  ABSENT:     { label: "Absent",     color: "#ef4444", dot: "#ef4444" },
};

function StateDot({ etat, size = 10 }) {
  const cfg = STATE_CONFIG[etat] || STATE_CONFIG.DISPONIBLE;
  return (
    <span style={{
      display: "inline-block",
      width: size,
      height: size,
      borderRadius: "50%",
      background: cfg.dot,
      boxShadow: `0 0 ${size}px ${cfg.dot}`,
      flexShrink: 0,
      animation: etat === "EN_COURS" ? "pulseDot 2s infinite" : "none",
    }} />
  );
}

function StationRow({ station }) {
  const etat = station.etat || "DISPONIBLE";
  const cfg = STATE_CONFIG[etat] || STATE_CONFIG.DISPONIBLE;
  const ticket = station.ticket_en_cours;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "8px 12px",
      borderRadius: "8px",
      background: etat === "EN_COURS"
        ? "rgba(6,182,212,0.08)"
        : etat === "PAUSE"
        ? "rgba(245,158,11,0.06)"
        : etat === "ABSENT"
        ? "rgba(239,68,68,0.06)"
        : "rgba(255,255,255,0.03)",
      border: `1px solid ${etat === "EN_COURS" ? "rgba(6,182,212,0.2)" : "rgba(255,255,255,0.04)"}`,
      transition: "all 0.3s ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <StateDot etat={etat} size={8} />
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#94a3b8" }}>
          {station.nom}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {ticket ? (
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "15px",
            fontWeight: 800,
            color: "#06b6d4",
            background: "rgba(6,182,212,0.15)",
            padding: "2px 10px",
            borderRadius: "6px",
          }}>
            {ticket.numero}
          </span>
        ) : (
          <span style={{ fontSize: "11px", color: cfg.color, fontWeight: 600 }}>
            {cfg.label}
          </span>
        )}
      </div>
    </div>
  );
}

function WaitingTicketRow({ ticket, rank }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "6px 10px",
      borderRadius: "6px",
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.04)",
    }}>
      <span style={{
        width: "22px", height: "22px",
        borderRadius: "50%",
        background: "rgba(148,163,184,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "10px", fontWeight: 700, color: "#64748b",
        flexShrink: 0,
      }}>
        {rank}
      </span>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "14px",
        fontWeight: 700,
        color: "#94a3b8",
      }}>
        {ticket.numero}
      </span>
    </div>
  );
}

function ServicePanel({ serviceKey, data, style = {} }) {
  if (!data) return null;
  const { nom, nom_complet, color, label_poste, stations = [], file_attente = [], total_attente, total_en_cours, en_cours = [] } = data;

  // Current tickets being served
  const currentTickets = stations.filter(s => s.ticket_en_cours).map(s => ({
    station: s,
    ticket: s.ticket_en_cours,
  }));

  return (
    <div style={{
      background: "rgba(17,24,39,0.8)",
      border: `1px solid ${color}30`,
      borderRadius: "0",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      ...style,
    }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${color}22, ${color}11)`,
        borderBottom: `2px solid ${color}40`,
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: "11px", color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "2px" }}>
            {nom_complet}
          </div>
          <div style={{ fontSize: "22px", fontWeight: 900, color: "#f1f5f9" }}>
            {nom}
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "24px", fontWeight: 900, color, lineHeight: 1 }}>{total_attente}</div>
            <div style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase" }}>En attente</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "24px", fontWeight: 900, color: "#06b6d4", lineHeight: 1 }}>{total_en_cours}</div>
            <div style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase" }}>En cours</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "16px", gap: "14px", overflow: "hidden" }}>
        {/* Currently called */}
        {currentTickets.length > 0 && (
          <div>
            <div style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
              📢 Actuellement appelés
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {currentTickets.slice(0, 4).map(({ station, ticket }) => (
                <div key={station.station_id} style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: "rgba(6,182,212,0.08)",
                  border: "1px solid rgba(6,182,212,0.25)",
                  borderRadius: "10px",
                  animation: "glowPulse 3s infinite",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{
                      width: "8px", height: "8px", borderRadius: "50%",
                      background: "#06b6d4", boxShadow: "0 0 8px #06b6d4",
                      flexShrink: 0,
                    }} />
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>{station.nom}</span>
                  </div>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "20px",
                    fontWeight: 900,
                    color: "#22d3ee",
                    textShadow: "0 0 20px rgba(6,182,212,0.6)",
                  }}>
                    {ticket.numero}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Waiting queue */}
        {file_attente.length > 0 && (
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
              ⏳ Prochains
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {file_attente.slice(0, 5).map((t, i) => (
                <WaitingTicketRow key={t.id} ticket={t} rank={i + 1} />
              ))}
              {total_attente > 5 && (
                <div style={{ fontSize: "11px", color: "#475569", textAlign: "center", paddingTop: "4px" }}>
                  + {total_attente - 5} autre{total_attente - 5 > 1 ? "s" : ""}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stations grid */}
        <div>
          <div style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
            🏢 {label_poste}s
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {stations.slice(0, 8).map(s => (
              <StationRow key={s.station_id} station={s} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DisplayBoard() {
  const [data, setData] = useState(null);
  const [time, setTime] = useState(new Date());
  const [lastUpdate, setLastUpdate] = useState(null);
  const intervalRef = useRef(null);

  const fetchData = async () => {
    try {
      const result = await getAffichage();
      setData(result);
      setLastUpdate(new Date());
    } catch (err) {
      console.error("Erreur affichage:", err);
    }
  };

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 3000);
    const clockInterval = setInterval(() => setTime(new Date()), 1000);
    return () => {
      clearInterval(intervalRef.current);
      clearInterval(clockInterval);
    };
  }, []);

  const services = data?.services || {};

  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      background: "#080d18",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      fontFamily: "'Inter', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=JetBrains+Mono:wght@600;700;800&display=swap');
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 0 rgba(6,182,212,0); }
          50% { box-shadow: 0 0 20px rgba(6,182,212,0.15); }
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        @keyframes ticker {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>

      {/* ── Top Bar ── */}
      <div style={{
        background: "rgba(10,14,26,0.98)",
        borderBottom: "1px solid rgba(99,102,241,0.2)",
        padding: "0 24px",
        height: "60px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "36px", height: "36px",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            borderRadius: "10px",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "20px",
          }}>🎫</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "16px", color: "#f1f5f9" }}>
              UIR — Système de File d'Attente
            </div>
            <div style={{ fontSize: "11px", color: "#64748b" }}>
              Affichage public • Mise à jour toutes les 3s
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
          {data && (
            <>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "22px", fontWeight: 900, color: "#f59e0b" }}>
                  {data.total_attente}
                </div>
                <div style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase" }}>Total attente</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "22px", fontWeight: 900, color: "#06b6d4" }}>
                  {data.total_en_cours}
                </div>
                <div style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase" }}>En cours</div>
              </div>
            </>
          )}
          <div style={{ textAlign: "right" }}>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "22px",
              fontWeight: 800,
              color: "#f1f5f9",
            }}>
              {time.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </div>
            <div style={{ fontSize: "11px", color: "#64748b" }}>
              {time.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
            </div>
          </div>
        </div>
      </div>

      {/* ── 2×2 Grid ── */}
      <div style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr",
        gap: "1px",
        background: "rgba(99,102,241,0.1)",
        overflow: "hidden",
      }}>
        <ServicePanel serviceKey="inscription" data={services.inscription} />
        <ServicePanel serviceKey="paiement"    data={services.paiement} />
        <ServicePanel serviceKey="numerique"   data={services.numerique} />
        <ServicePanel serviceKey="concours"    data={services.concours} />
      </div>

      {/* ── Status bar ── */}
      <div style={{
        height: "28px",
        background: "rgba(10,14,26,0.98)",
        borderTop: "1px solid rgba(255,255,255,0.04)",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: "16px",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: "10px", color: "#475569" }}>
          {lastUpdate ? `Dernière mise à jour: ${lastUpdate.toLocaleTimeString("fr-FR")}` : "Chargement..."}
        </span>
        {[
          { label: "Disponible", color: "#6366f1" },
          { label: "En cours", color: "#06b6d4" },
          { label: "En pause", color: "#f59e0b" },
          { label: "Absent", color: "#ef4444" },
        ].map(({ label, color }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
            <span style={{ fontSize: "10px", color: "#475569" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
