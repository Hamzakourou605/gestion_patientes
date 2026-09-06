import React, { useState, useEffect, useRef, useCallback } from "react";
import { getAffichage } from "../api";

export default function DisplayBoard() {
  // Real-time clock & French date
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");

  // Live data from backend
  const [data, setData] = useState({
    guichets: [],
    derniers_appeles: [],
    en_cours: [],
    attente: [],
    prochains_tickets: [],
    total_attente: 0,
    total_en_cours: 0,
  });

  // Last called ticket with animation
  const [lastCalled, setLastCalled] = useState(null);
  const previousCalledRef = useRef(null);

  // Clock effect
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");
      setCurrentTime(`${hours}:${minutes}:${seconds}`);

      const options = { weekday: "long", day: "numeric", month: "long", year: "numeric" };
      const dateStr = now.toLocaleDateString("fr-FR", options);
      setCurrentDate(dateStr.charAt(0).toUpperCase() + dateStr.slice(1));
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Web Audio chime function
  const playChime = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      // Audio fallback
    }
  };

  // Poll backend
  const fetchData = useCallback(async () => {
    try {
      const res = await getAffichage();
      setData(res);

      // Detect newly called ticket
      if (res?.derniers_appeles && res.derniers_appeles.length > 0) {
        const newest = res.derniers_appeles[0];
        setLastCalled(newest);

        if (previousCalledRef.current && previousCalledRef.current.numero !== newest.numero) {
          playChime();
        }
        previousCalledRef.current = newest;
      }
    } catch (err) {
      console.error("Erreur chargement affichage:", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2500);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Group guichets into 4 poles
  const guichetsList = data.guichets || [];

  const poleGroups = [
    {
      id: "inscription",
      titre: "Accueil & Inscriptions",
      badge: "Postes 1 à 4",
      icon: "school",
      color: "border-blue-500",
      guichets: guichetsList.filter((g) => g.pole === "inscription" || (g.numero >= 1 && g.numero <= 4)),
    },
    {
      id: "concours",
      titre: "Service Concours",
      badge: "Postes 5 & 6",
      icon: "military_tech",
      color: "border-purple-500",
      guichets: guichetsList.filter((g) => g.pole === "concours" || (g.numero >= 5 && g.numero <= 6)),
    },
    {
      id: "paiement",
      titre: "Caisses de Paiement",
      badge: "8 Caisses (7 à 14)",
      icon: "payments",
      color: "border-emerald-500",
      guichets: guichetsList.filter((g) => g.pole === "paiement" || (g.numero >= 7 && g.numero <= 14)),
    },
    {
      id: "numerique",
      titre: "Service Numérique",
      badge: "Postes 15 & 16",
      icon: "devices",
      color: "border-indigo-500",
      guichets: guichetsList.filter((g) => g.pole === "numerique" || (g.numero >= 15 && g.numero <= 16)),
    },
  ];

  const waitingList = data.prochains_tickets || data.attente || [];

  return (
    <div className="w-full h-screen max-h-screen bg-[#061224] text-slate-100 flex flex-col overflow-hidden select-none font-sans">
      
      {/* ── HEADER BANNER (Fixed, compact TV style) ────────────────────────── */}
      <header className="h-16 bg-[#00183b] border-b border-blue-900/60 px-6 flex items-center justify-between shadow-xl shrink-0">
        <div className="flex items-center gap-3">
          <img
            src="/uir_logo.jpg"
            alt="UIR Logo"
            className="w-11 h-11 rounded-xl bg-white object-contain p-1 shadow-md"
          />
          <div className="text-left">
            <h1 className="font-black text-base md:text-lg leading-tight tracking-tight text-white">
              UNIVERSITÉ INTERNATIONALE DE RABAT
            </h1>
            <p className="text-xs text-blue-300 font-semibold tracking-wide">
              Service Scolarité · Système Central de File d'Attente
            </p>
          </div>
        </div>

        {/* Live counters and clock */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-3 bg-blue-950/70 border border-blue-800/60 px-4 py-1.5 rounded-xl shadow-inner">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span>En cours : <strong className="text-white text-sm">{data.total_en_cours || 0}</strong></span>
            </div>
            <span className="text-blue-700">|</span>
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
              <span className="material-symbols-outlined text-[16px]">groups</span>
              <span>En attente : <strong className="text-white text-sm">{data.total_attente || 0}</strong></span>
            </div>
          </div>

          <div className="text-right pl-2 border-l border-blue-900/60">
            <div className="text-[11px] text-blue-300 font-bold capitalize leading-none">
              {currentDate}
            </div>
            <div className="text-2xl font-black tracking-tight leading-none text-white mt-1 font-mono">
              {currentTime}
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT AREA (FITS EXACTLY IN 100vh, NO SCROLLBAR) ───── */}
      <main className="flex-1 p-3 grid grid-cols-12 gap-3 min-h-0 overflow-hidden">
        
        {/* LEFT COLUMN: DERNIER APPEL HERO + ÉTAT DES 16 GUICHETS (7 Cols) */}
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-2.5 min-h-0 overflow-hidden">
          
          {/* BANNIÈRE DERNIER NUMÉRO APPELÉ */}
          <div className="bg-gradient-to-r from-[#00275c] via-[#0d3b80] to-[#00204d] rounded-2xl px-5 py-3 text-white shadow-2xl flex items-center justify-between shrink-0 border border-blue-500/40 relative overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-400 text-[#00204d] flex items-center justify-center font-black animate-pulse shadow-lg shrink-0">
                <span className="material-symbols-outlined text-[30px]">campaign</span>
              </div>
              <div className="text-left">
                <span className="inline-block text-[11px] font-black uppercase tracking-widest bg-amber-400 text-[#00204d] px-2.5 py-0.5 rounded-md mb-0.5 shadow-sm">
                  Dernier Appel
                </span>
                <p className="text-xs text-blue-200 font-medium">
                  Présentez-vous immédiatement à votre guichet :
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-black/40 px-5 py-1.5 rounded-xl border border-white/15">
              <div className="text-center">
                <span className="text-[10px] text-blue-300 font-bold uppercase tracking-wider block">Numéro</span>
                <span className="text-3xl md:text-4xl font-black text-amber-300 font-mono tracking-tight">
                  {lastCalled ? lastCalled.numero : "—"}
                </span>
              </div>
              <span className="material-symbols-outlined text-amber-400 text-[24px]">arrow_forward</span>
              <div className="text-center">
                <span className="text-[10px] text-blue-300 font-bold uppercase tracking-wider block">Guichet</span>
                <span className="text-xl md:text-2xl font-black text-white">
                  {lastCalled ? (lastCalled.guichet_nom ? lastCalled.guichet_nom.toUpperCase() : `GUICHET ${lastCalled.guichet}`) : "EN ATTENTE"}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION ÉTAT DES GUICHETS (ACTIF, DISPONIBLE, EN PAUSE, ABSENT) */}
          <div className="flex-1 bg-[#091b38] rounded-2xl p-3 border border-blue-900/50 shadow-lg flex flex-col min-h-0 overflow-hidden">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-blue-900/60 shrink-0 text-left">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400 text-[20px]">desk</span>
                <h2 className="text-sm font-black uppercase tracking-wider text-white">
                  État des 16 Guichets en Direct
                </h2>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-bold">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> ACTIF
                </span>
                <span className="flex items-center gap-1 text-blue-300">
                  <span className="w-2 h-2 rounded-full bg-blue-400" /> DISPONIBLE
                </span>
                <span className="flex items-center gap-1 text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> EN PAUSE
                </span>
                <span className="flex items-center gap-1 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-slate-500" /> ABSENT
                </span>
              </div>
            </div>

            {/* Sub-grid of 4 poles */}
            <div className="flex-1 grid grid-cols-2 gap-2 min-h-0 overflow-hidden">
              {poleGroups.map((pole) => (
                <div
                  key={pole.id}
                  className="bg-[#05142b] rounded-xl p-2 border border-blue-950 flex flex-col min-h-0 overflow-hidden"
                >
                  <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-blue-900/40 shrink-0">
                    <div className="flex items-center gap-1.5 text-left">
                      <span className="material-symbols-outlined text-blue-400 text-[16px]">{pole.icon}</span>
                      <span className="font-extrabold text-xs text-white tracking-tight truncate">
                        {pole.titre}
                      </span>
                    </div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-950 text-blue-300 rounded border border-blue-900 shrink-0">
                      {pole.badge}
                    </span>
                  </div>

                  {/* List of desks in this pole */}
                  <div className="flex-1 grid grid-cols-2 gap-1.5 min-h-0 overflow-y-auto pr-0.5">
                    {pole.guichets.map((g) => {
                      const etat = g.etat || "DISPONIBLE";
                      const t = g.ticket_en_cours;

                      let statusBadge = (
                        <span className="text-[10px] font-bold text-blue-300 bg-blue-950 px-1.5 py-0.5 rounded border border-blue-800">
                          DISPONIBLE
                        </span>
                      );
                      let cardBorder = "border-blue-900/50 bg-[#071d40]";

                      if (etat === "PAUSE") {
                        statusBadge = (
                          <span className="text-[10px] font-black text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-600">
                            EN PAUSE
                          </span>
                        );
                        cardBorder = "border-amber-700/60 bg-amber-950/30";
                      } else if (etat === "ABSENT") {
                        statusBadge = (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">
                            ABSENT
                          </span>
                        );
                        cardBorder = "border-slate-800 bg-slate-900/50 opacity-60";
                      } else if (t || etat === "EN_COURS") {
                        statusBadge = (
                          <span className="text-[10px] font-black text-emerald-300 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-500 animate-pulse">
                            ACTIF
                          </span>
                        );
                        cardBorder = "border-emerald-600/70 bg-[#062438]";
                      }

                      return (
                        <div
                          key={g.numero}
                          className={`p-1.5 rounded-lg border text-left flex flex-col justify-between ${cardBorder}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold text-white truncate max-w-[85px]">
                              {g.nom}
                            </span>
                            {statusBadge}
                          </div>

                          <div className="mt-1 flex items-center justify-between">
                            {t ? (
                              <div className="w-full flex items-baseline justify-between">
                                <span className="text-base font-black text-amber-300 font-mono tracking-tight">
                                  {t.numero}
                                </span>
                                <span className="text-[9px] font-semibold text-blue-200 truncate max-w-[55px]">
                                  {t.type_label}
                                </span>
                              </div>
                            ) : etat === "PAUSE" ? (
                              <span className="text-[10px] text-amber-400 font-medium italic">
                                Momentanément suspendu
                              </span>
                            ) : etat === "ABSENT" ? (
                              <span className="text-[10px] text-slate-500 font-medium italic">
                                Guichet fermé
                              </span>
                            ) : (
                              <span className="text-[10px] text-blue-400 font-medium italic">
                                Prêt pour appel
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: PROCHAINS TICKETS EN ATTENTE (FILE GLOBALE) (5 Cols) */}
        <div className="col-span-12 lg:col-span-5 bg-[#091b38] rounded-2xl p-3 border border-blue-900/50 shadow-lg flex flex-col min-h-0 overflow-hidden text-left">
          
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-blue-900/60 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-400 text-[#00204d] flex items-center justify-center font-black">
                <span className="material-symbols-outlined text-[20px]">format_list_numbered</span>
              </div>
              <div>
                <h2 className="font-black text-sm uppercase tracking-wider text-white">
                  File d'Attente Globale
                </h2>
                <p className="text-[10px] text-blue-300">
                  Progression en temps réel · Guichet assigné à l'appel
                </p>
              </div>
            </div>

            <div className="px-3 py-1 bg-amber-400 text-[#00204d] font-black text-xs rounded-full shadow-md">
              {data.total_attente || 0} EN ATTENTE
            </div>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-12 gap-1 px-2.5 py-1.5 bg-[#05142b] rounded-lg text-[10px] font-black text-blue-300 uppercase tracking-wider shrink-0 mb-1.5 border border-blue-950">
            <div className="col-span-3 text-center">Rang</div>
            <div className="col-span-4 text-center">Ticket</div>
            <div className="col-span-5 text-left">Démarche / Pôle</div>
          </div>

          {/* Waiting Tickets List */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
            {waitingList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-blue-300/70 text-xs py-10">
                <span className="material-symbols-outlined text-5xl mb-2 text-emerald-400">task_alt</span>
                <p className="font-bold text-sm text-white">Aucun usager en attente</p>
                <p className="text-[11px] text-blue-300 mt-0.5">Tous les candidats ont été pris en charge.</p>
              </div>
            ) : (
              waitingList.slice(0, 14).map((t, idx) => {
                const isNext = idx === 0;
                return (
                  <div
                    key={t.id || t.numero || idx}
                    className={`grid grid-cols-12 gap-1 items-center px-2.5 py-2 rounded-xl border text-xs transition-all ${
                      isNext
                        ? "bg-gradient-to-r from-amber-500/30 to-amber-600/20 border-amber-400 shadow-md font-bold"
                        : idx % 2 === 0
                        ? "bg-[#071c3b] border-blue-950"
                        : "bg-[#05142b] border-blue-950"
                    }`}
                  >
                    {/* Rang */}
                    <div className="col-span-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-black ${
                          isNext
                            ? "bg-amber-400 text-[#00204d] animate-bounce shadow-sm"
                            : "bg-blue-950 text-blue-200 border border-blue-800"
                        }`}
                      >
                        #{t.rang || idx + 1}
                      </span>
                    </div>

                    {/* Numéro */}
                    <div className="col-span-4 text-center">
                      <span className="font-black text-base md:text-lg text-white font-mono tracking-tight">
                        {t.numero}
                      </span>
                    </div>

                    {/* Service / Pôle */}
                    <div className="col-span-5 truncate text-xs text-blue-200 font-semibold">
                      {t.service_label || t.type_label}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer note */}
          <div className="pt-2 border-t border-blue-900/60 flex items-center justify-between text-[10px] text-blue-300 font-medium shrink-0">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-amber-400">info</span>
              Surveillez votre numéro : le guichet s'allumera dès votre appel.
            </span>
            <span className="font-bold text-amber-400">Campus UIR</span>
          </div>

        </div>

      </main>
    </div>
  );
}
