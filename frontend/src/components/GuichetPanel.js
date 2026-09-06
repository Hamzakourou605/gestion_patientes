import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  login,
  getStation,
  appellerSuivant,
  terminerTicket,
  pauseStation,
  reprendreStation,
  absentStation,
  activerStation,
  getStatistiques,
} from "../api";

const SERVICE_ICONS = {
  inscription: "📋",
  paiement: "💳",
  numerique: "💻",
  concours: "🏆",
};

const STATE_CONFIG = {
  DISPONIBLE: { label: "Disponible", color: "#6366f1", bg: "rgba(99,102,241,0.12)", icon: "🟢" },
  EN_COURS:   { label: "En cours",   color: "#06b6d4", bg: "rgba(6,182,212,0.12)",  icon: "🔵" },
  PAUSE:      { label: "En pause",   color: "#f59e0b", bg: "rgba(245,158,11,0.12)", icon: "🟠" },
  ABSENT:     { label: "Absent",     color: "#ef4444", bg: "rgba(239,68,68,0.12)",  icon: "🔴" },
};

// ── Toast ──────────────────────────────────────────────────────────────────────
function ToastContainer({ toasts }) {
  return (
    <div style={{
      position: "fixed", top: "80px", right: "20px", zIndex: 9999,
      display: "flex", flexDirection: "column", gap: "8px",
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: "rgba(30,42,58,0.98)",
          border: `1px solid ${t.color || "rgba(255,255,255,0.1)"}`,
          borderLeft: `4px solid ${t.color || "#6366f1"}`,
          borderRadius: "10px",
          padding: "12px 16px",
          minWidth: "280px",
          boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
          animation: "fadeIn 0.2s ease",
          display: "flex", gap: "10px", alignItems: "flex-start",
        }}>
          <span style={{ fontSize: "18px" }}>{t.icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: "13px", color: "#f1f5f9" }}>{t.title}</div>
            {t.message && <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>{t.message}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Login form ─────────────────────────────────────────────────────────────────
function LoginForm({ onLogin }) {
  const [email, setEmail] = useState(localStorage.getItem("agent_email") || "");
  const [password, setPassword] = useState("poste123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await login(email.trim(), password);
      localStorage.setItem("agent_email", email.trim());
      onLogin(data);
    } catch (err) {
      setError(err.response?.data?.erreur || "Identifiants incorrects");
    } finally {
      setLoading(false);
    }
  };

  // Quick login presets
  const QUICK_LOGINS = [
    { label: "Inscription 1", email: "inscription1@uir.ac.ma", icon: "📋" },
    { label: "Paiement 1",    email: "paiement1@uir.ac.ma",    icon: "💳" },
    { label: "Numérique 1",   email: "numerique1@uir.ac.ma",   icon: "💻" },
    { label: "Concours 1",    email: "concours1@uir.ac.ma",    icon: "🏆" },
  ];

  return (
    <div style={{
      minHeight: "calc(100vh - 64px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px",
      background: "linear-gradient(135deg, #0a0e1a 0%, #0f172a 100%)",
      position: "relative",
    }}>
      <div style={{
        position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)",
        width: "400px", height: "400px",
        background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{
        width: "100%", maxWidth: "420px",
        background: "rgba(30,42,58,0.9)",
        border: "1px solid rgba(99,102,241,0.2)",
        borderRadius: "24px",
        padding: "40px 36px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(99,102,241,0.08)",
        position: "relative", zIndex: 1,
      }} className="animate-scale-in">
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{
            width: "64px", height: "64px",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            borderRadius: "18px",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "32px",
            margin: "0 auto 16px",
            boxShadow: "0 8px 25px rgba(99,102,241,0.4)",
          }}>🖥️</div>
          <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#f1f5f9", marginBottom: "6px" }}>
            Espace Agent
          </h1>
          <p style={{ color: "#64748b", fontSize: "14px" }}>
            Connectez-vous avec votre compte poste
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "6px" }}>
              Email
            </label>
            <input
              id="agent-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="inscription1@uir.ac.ma"
              required
              className="input"
            />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "6px" }}>
              Mot de passe
            </label>
            <input
              id="agent-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="poste123"
              required
              className="input"
            />
          </div>

          {error && (
            <div style={{
              padding: "10px 14px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "8px",
              color: "#f87171",
              fontSize: "13px",
            }}>
              ⚠️ {error}
            </div>
          )}

          <button
            id="login-btn"
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ padding: "14px", fontSize: "15px" }}
          >
            {loading ? "⏳ Connexion..." : "🔐 Se connecter"}
          </button>
        </form>

        {/* Quick login */}
        <div style={{ marginTop: "24px" }}>
          <div style={{ fontSize: "11px", color: "#475569", textAlign: "center", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Accès rapide (démo)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            {QUICK_LOGINS.map(ql => (
              <button
                key={ql.email}
                onClick={() => { setEmail(ql.email); setPassword("poste123"); }}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: "11px", justifyContent: "flex-start", gap: "6px" }}
              >
                {ql.icon} {ql.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────
export default function GuichetPanel() {
  const [session, setSession] = useState(null); // { user, station }
  const [stationData, setStationData] = useState(null);
  const [stats, setStats] = useState(null);
  const [statPeriod, setStatPeriod] = useState("jour");
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("main"); // main | stats
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const pollRef = useRef(null);
  const timerRef = useRef(null);

  const addToast = useCallback((title, message = "", icon = "✅", color = "#10b981") => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, title, message, icon, color }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const playBeep = (success = true) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = success ? 880 : 440;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {}
  };

  const refreshStation = useCallback(async () => {
    if (!session?.station?.station_id) return;
    try {
      const data = await getStation(session.station.station_id);
      setStationData(data);
    } catch {}
  }, [session]);

  useEffect(() => {
    if (!session) return;
    refreshStation();
    pollRef.current = setInterval(refreshStation, 3000);
    return () => clearInterval(pollRef.current);
  }, [session, refreshStation]);

  // Session timer (when ticket is active)
  useEffect(() => {
    if (stationData?.ticket_en_cours_data) {
      setSessionSeconds(0);
      timerRef.current = setInterval(() => setSessionSeconds(s => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
      setSessionSeconds(0);
    }
    return () => clearInterval(timerRef.current);
  }, [stationData?.ticket_en_cours_data?.id]);

  const loadStats = useCallback(async () => {
    if (!session?.station?.service) return;
    try {
      const data = await getStatistiques(statPeriod, session.station.service, session.station.station_id);
      setStats(data);
    } catch {}
  }, [session, statPeriod]);

  useEffect(() => {
    if (activeTab === "stats") loadStats();
  }, [activeTab, statPeriod, loadStats]);

  const handleLogin = (data) => {
    setSession(data);
    addToast(`Bienvenue, ${data.user.nom}`, `Connecté sur ${data.station.nom}`, "✅", "#10b981");
  };

  const handleLogout = () => {
    clearInterval(pollRef.current);
    setSession(null);
    setStationData(null);
  };

  const handleAppelerSuivant = async () => {
    if (!session?.station?.station_id) return;
    setLoading(true);
    try {
      const result = await appellerSuivant(session.station.station_id);
      if (result.ticket) {
        addToast("Client appelé !", `Ticket ${result.ticket.numero}`, "📢", "#06b6d4");
        playBeep(true);
      } else {
        addToast("File vide", "Aucun candidat en attente", "ℹ️", "#6366f1");
      }
      await refreshStation();
    } catch (err) {
      addToast("Erreur", err.response?.data?.erreur || "Erreur", "❌", "#ef4444");
      playBeep(false);
    } finally {
      setLoading(false);
    }
  };

  const handleTerminer = async (action = "termine") => {
    if (!session?.station?.station_id) return;
    setLoading(true);
    try {
      const result = await terminerTicket(session.station.station_id, action);
      if (action === "termine") {
        addToast("Visite terminée", "Le client est pris en charge", "✅", "#10b981");
      } else {
        addToast("Réorientation", result.message || `Redirigé vers ${action}`, "🔄", "#f59e0b");
      }
      await refreshStation();
    } catch (err) {
      addToast("Erreur", err.response?.data?.erreur || "Erreur", "❌", "#ef4444");
    } finally {
      setLoading(false);
    }
  };

  const handleEtatChange = async (action) => {
    const stationId = session?.station?.station_id;
    if (!stationId) return;
    setLoading(true);
    try {
      let result;
      if (action === "pause")     result = await pauseStation(stationId);
      if (action === "reprendre") result = await reprendreStation(stationId);
      if (action === "absent")    result = await absentStation(stationId);
      if (action === "activer")   result = await activerStation(stationId);
      addToast(`État mis à jour: ${result?.etat}`, "", "🔄", "#f59e0b");
      await refreshStation();
    } catch (err) {
      addToast("Erreur", err.response?.data?.erreur || "Erreur", "❌", "#ef4444");
    } finally {
      setLoading(false);
    }
  };

  const fmtTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  if (!session) return <LoginForm onLogin={handleLogin} />;

  const st = stationData || session.station;
  const etat = st?.etat || "DISPONIBLE";
  const stateCfg = STATE_CONFIG[etat] || STATE_CONFIG.DISPONIBLE;
  const activeTicket = st?.ticket_en_cours_data;
  const fileAttente = st?.file_attente || [];
  const totalAttente = st?.total_attente || 0;
  const svcColor = st?.service_color || "#6366f1";
  const svcIcon = SERVICE_ICONS[st?.service] || "🖥️";

  // Redirect actions for current service
  const REDIRECT_OPTIONS = {
    inscription: ["paiement", "numerique"],
    paiement:    ["numerique"],
    numerique:   [],
    concours:    [],
  };
  const redirectOptions = REDIRECT_OPTIONS[st?.service] || [];

  return (
    <div style={{
      minHeight: "calc(100vh - 64px)",
      background: "linear-gradient(135deg, #0a0e1a 0%, #0f172a 100%)",
      padding: "24px",
      display: "flex",
      flexDirection: "column",
      gap: "20px",
      maxWidth: "900px",
      margin: "0 auto",
    }}>
      <ToastContainer toasts={toasts} />
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform: translateX(20px); } to { opacity:1; transform: translateX(0); } }
        @keyframes timerPulse { 0%,100% { color: #06b6d4; } 50% { color: #22d3ee; } }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(30,42,58,0.8)",
        border: `1px solid ${svcColor}30`,
        borderRadius: "16px",
        padding: "16px 20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{
            width: "48px", height: "48px",
            background: `linear-gradient(135deg, ${svcColor}, ${svcColor}99)`,
            borderRadius: "14px",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "24px",
            boxShadow: `0 4px 15px ${svcColor}40`,
          }}>
            {svcIcon}
          </div>
          <div>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "#f1f5f9" }}>
              {st?.nom || "Station"}
            </div>
            <div style={{ fontSize: "13px", color: "#64748b" }}>
              {session?.user?.email} · {st?.service_nom}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* State badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: stateCfg.bg,
            border: `1px solid ${stateCfg.color}44`,
            borderRadius: "999px",
            padding: "6px 14px",
            fontSize: "13px", fontWeight: 700,
            color: stateCfg.color,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: stateCfg.color,
              boxShadow: `0 0 6px ${stateCfg.color}`,
            }} />
            {stateCfg.icon} {stateCfg.label}
          </div>

          <button onClick={handleLogout} className="btn btn-ghost btn-sm">
            🚪 Déconnexion
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: "4px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "0" }}>
        {[
          { id: "main", label: "🖥️ Panneau Principal" },
          { id: "stats", label: "📊 Statistiques" },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "10px 18px",
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${activeTab === tab.id ? svcColor : "transparent"}`,
              cursor: "pointer",
              color: activeTab === tab.id ? "#f1f5f9" : "#64748b",
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: "14px",
              fontFamily: "inherit",
              transition: "all 0.2s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── MAIN TAB ── */}
      {activeTab === "main" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "20px" }}>
          {/* LEFT: Ticket en cours + actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Active ticket card */}
            {activeTicket ? (
              <div style={{
                background: "rgba(6,182,212,0.06)",
                border: "1px solid rgba(6,182,212,0.25)",
                borderRadius: "16px",
                padding: "24px",
                position: "relative",
                overflow: "hidden",
              }} className="animate-scale-in">
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: "3px",
                  background: "linear-gradient(90deg, #06b6d4, #8b5cf6)",
                }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                  <div>
                    <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>
                      📢 Ticket en cours
                    </div>
                    <div style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "3.5rem",
                      fontWeight: 900,
                      color: "#22d3ee",
                      lineHeight: 1,
                      textShadow: "0 0 30px rgba(6,182,212,0.5)",
                    }}>
                      {activeTicket.numero}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>Durée</div>
                    <div style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "28px",
                      fontWeight: 700,
                      color: sessionSeconds > 300 ? "#f87171" : "#06b6d4",
                      animation: "timerPulse 2s infinite",
                    }}>
                      {fmtTime(sessionSeconds)}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                    Service: <strong style={{ color: "#f1f5f9" }}>{activeTicket.service_nom}</strong>
                  </div>
                  <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                    Appelé à: <strong style={{ color: "#f1f5f9" }}>
                      {activeTicket.called_at
                        ? new Date(activeTicket.called_at).toLocaleTimeString("fr-FR")
                        : "—"}
                    </strong>
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <button
                    id="btn-terminer"
                    onClick={() => handleTerminer("termine")}
                    disabled={loading}
                    className="btn btn-success btn-lg"
                    style={{ width: "100%" }}
                  >
                    ✅ Visite terminée
                  </button>

                  {redirectOptions.length > 0 && (
                    <div>
                      <div style={{ fontSize: "11px", color: "#64748b", textAlign: "center", marginBottom: "8px" }}>
                        Réorienter vers
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        {redirectOptions.map(dest => (
                          <button
                            key={dest}
                            onClick={() => handleTerminer(dest)}
                            disabled={loading}
                            className="btn btn-warning"
                            style={{ flex: 1, fontSize: "13px" }}
                          >
                            {SERVICE_ICONS[dest]} {dest.charAt(0).toUpperCase() + dest.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{
                background: "rgba(30,42,58,0.6)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "16px",
                padding: "32px",
                textAlign: "center",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "12px",
              }}>
                <div style={{ fontSize: "3rem" }}>⏳</div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#94a3b8" }}>
                  Aucun ticket en cours
                </div>
                <div style={{ fontSize: "13px", color: "#475569" }}>
                  {totalAttente > 0
                    ? `${totalAttente} personne${totalAttente > 1 ? "s" : ""} en attente`
                    : "File d'attente vide"}
                </div>
              </div>
            )}

            {/* Call next button */}
            {!activeTicket && (
              <button
                id="btn-appeler-suivant"
                onClick={handleAppelerSuivant}
                disabled={loading || etat === "PAUSE" || etat === "ABSENT"}
                className="btn btn-primary btn-lg"
                style={{ width: "100%", fontSize: "17px", padding: "18px" }}
              >
                {loading ? "⏳ Chargement..." : "📢 Appeler le client suivant"}
              </button>
            )}

            {/* State controls */}
            <div style={{
              background: "rgba(30,42,58,0.6)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "14px",
              padding: "16px",
            }}>
              <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
                Gestion du poste
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {etat !== "PAUSE" && etat !== "ABSENT" && (
                  <button
                    id="btn-pause"
                    onClick={() => handleEtatChange("pause")}
                    disabled={loading}
                    className="btn btn-warning btn-sm"
                  >
                    ⏸ Pause
                  </button>
                )}
                {etat === "PAUSE" && (
                  <button
                    id="btn-reprendre"
                    onClick={() => handleEtatChange("reprendre")}
                    disabled={loading}
                    className="btn btn-success btn-sm"
                  >
                    ▶ Reprendre
                  </button>
                )}
                {etat !== "ABSENT" && (
                  <button
                    id="btn-absent"
                    onClick={() => handleEtatChange("absent")}
                    disabled={loading}
                    className="btn btn-danger btn-sm"
                  >
                    🔴 Absent
                  </button>
                )}
                {etat === "ABSENT" && (
                  <button
                    id="btn-activer"
                    onClick={() => handleEtatChange("activer")}
                    disabled={loading}
                    className="btn btn-primary btn-sm"
                  >
                    🟢 Réactiver
                  </button>
                )}
              </div>
              {(etat === "PAUSE") && (
                <div style={{
                  marginTop: "10px", padding: "10px 14px",
                  background: "rgba(245,158,11,0.1)",
                  border: "1px solid rgba(245,158,11,0.3)",
                  borderRadius: "8px",
                  fontSize: "12px", color: "#fbbf24",
                }}>
                  ⏸ Ce poste est en pause — Vous ne pouvez pas appeler de nouveaux tickets.
                </div>
              )}
              {(etat === "ABSENT") && (
                <div style={{
                  marginTop: "10px", padding: "10px 14px",
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: "8px",
                  fontSize: "12px", color: "#f87171",
                }}>
                  🔴 Ce poste est marqué ABSENT — Réactivez-le pour reprendre.
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: File d'attente */}
          <div style={{
            background: "rgba(30,42,58,0.6)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "16px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            maxHeight: "600px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#f1f5f9" }}>
                ⏳ File d'attente
              </div>
              <div style={{
                background: `${svcColor}22`,
                color: svcColor,
                borderRadius: "999px",
                padding: "3px 10px",
                fontSize: "12px",
                fontWeight: 700,
              }}>
                {totalAttente}
              </div>
            </div>

            {fileAttente.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "#475569", fontSize: "13px" }}>
                File vide
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", overflowY: "auto" }}>
                {fileAttente.map((t, i) => (
                  <div key={t.id} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    background: i === 0 ? `${svcColor}15` : "rgba(255,255,255,0.02)",
                    border: `1px solid ${i === 0 ? `${svcColor}30` : "rgba(255,255,255,0.04)"}`,
                  }}>
                    <span style={{
                      width: "24px", height: "24px",
                      borderRadius: "50%",
                      background: i === 0 ? `${svcColor}22` : "rgba(148,163,184,0.1)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "11px", fontWeight: 700,
                      color: i === 0 ? svcColor : "#64748b",
                      flexShrink: 0,
                    }}>
                      {i + 1}
                    </span>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "15px",
                      fontWeight: 700,
                      color: i === 0 ? svcColor : "#94a3b8",
                    }}>
                      {t.numero}
                    </span>
                    {i === 0 && (
                      <span style={{
                        marginLeft: "auto",
                        fontSize: "10px",
                        color: svcColor,
                        fontWeight: 600,
                        background: `${svcColor}15`,
                        padding: "2px 8px",
                        borderRadius: "999px",
                      }}>
                        PROCHAIN
                      </span>
                    )}
                    <span style={{ marginLeft: "auto", fontSize: "11px", color: "#475569" }}>
                      {t.date_creation
                        ? new Date(t.date_creation).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
                        : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STATS TAB ── */}
      {activeTab === "stats" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }} className="animate-fade-in">
          <div style={{ display: "flex", gap: "8px" }}>
            {["jour", "semaine", "mois"].map(p => (
              <button
                key={p}
                onClick={() => setStatPeriod(p)}
                className={`btn btn-sm ${statPeriod === p ? "btn-primary" : "btn-ghost"}`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          {stats ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
              <div className="card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: "2.5rem", fontWeight: 900, color: "#06b6d4" }}>{stats.total}</div>
                <div style={{ color: "#64748b", fontSize: "13px" }}>Visites traitées</div>
              </div>
              {Object.entries(stats.par_service || {}).map(([svc, count]) => (
                <div key={svc} className="card" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "2rem", fontWeight: 900, color: svcColor }}>{count}</div>
                  <div style={{ color: "#64748b", fontSize: "12px" }}>{svc}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: "#64748b", textAlign: "center", padding: "40px" }}>
              Chargement des statistiques...
            </div>
          )}

          {stats?.serie && (
            <div className="card">
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#f1f5f9", marginBottom: "12px" }}>
                Évolution ({statPeriod})
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "80px" }}>
                {stats.serie.map((day, i) => {
                  const maxVal = Math.max(...stats.serie.map(d => d.total), 1);
                  const pct = (day.total / maxVal) * 100;
                  return (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                      <div style={{
                        width: "100%",
                        height: `${Math.max(pct, 2)}%`,
                        background: `linear-gradient(180deg, ${svcColor}, ${svcColor}66)`,
                        borderRadius: "3px 3px 0 0",
                        minHeight: "4px",
                      }} />
                      {stats.serie.length <= 7 && (
                        <div style={{ fontSize: "9px", color: "#475569" }}>
                          {new Date(day.date).toLocaleDateString("fr-FR", { weekday: "narrow" })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
