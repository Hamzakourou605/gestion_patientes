import React, { useState, useEffect, useRef, useCallback } from "react";
import { getAffichage } from "../api";

export default function DisplayBoard() {
  // Real-time clock & French date
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");

  // Live data from backend
  const [data, setData] = useState({
    en_cours: [],
    attente: [],
    par_pole: {},
    total_attente: 0,
    total_en_cours: 0,
  });

  // Last called ticket
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
      // Ignore audio errors
    }
  };

  // Poll backend
  const fetchData = useCallback(async () => {
    try {
      const res = await getAffichage();
      setData(res);

      // Detect newly called ticket
      if (res?.en_cours && res.en_cours.length > 0) {
        const newest = res.en_cours[0];
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
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Build departments from data
  const poles = [
    {
      id: "inscription",
      titre: "Accueil & Inscriptions",
      badge: "4 Guichets",
      icon: "school",
      color: "border-blue-500 bg-blue-50/40 text-blue-900",
      guichets: [1, 2, 3, 4].map((num) => {
        const t = data.en_cours?.find((item) => item.guichet === num);
        return { num, nom: `Guichet ${num}`, ticket: t };
      }),
    },
    {
      id: "concours",
      titre: "Service Concours",
      badge: "2 Postes",
      icon: "military_tech",
      color: "border-purple-500 bg-purple-50/40 text-purple-900",
      guichets: [5, 6].map((num) => {
        const t = data.en_cours?.find((item) => item.guichet === num);
        return { num, nom: `Concours ${num - 4}`, ticket: t };
      }),
    },
    {
      id: "paiement",
      titre: "Caisses de Paiement",
      badge: "8 Caisses",
      icon: "payments",
      color: "border-emerald-500 bg-emerald-50/40 text-emerald-900",
      guichets: [7, 8, 9, 10, 11, 12, 13, 14].map((num) => {
        const t = data.en_cours?.find((item) => item.guichet === num);
        return { num, nom: `Caisse ${num - 6}`, ticket: t };
      }),
    },
    {
      id: "numerique",
      titre: "Service Numérique (Dernière étape)",
      badge: "2 Postes",
      icon: "devices",
      color: "border-indigo-500 bg-indigo-50/40 text-indigo-900",
      guichets: [15, 16].map((num) => {
        const t = data.en_cours?.find((item) => item.guichet === num);
        return { num, nom: `Numérique ${num - 14}`, ticket: t };
      }),
    },
  ];

  const waitingList = data.attente || [];

  return (
    <div className="w-full h-screen max-h-screen bg-[#f1f5f9] text-slate-800 flex flex-col overflow-hidden select-none">
      
      {/* ── HEADER BANNER (Fixed, compact) ────────────────────────── */}
      <header className="h-16 bg-[#00204d] text-white px-5 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <img
            src="/uir_logo.jpg"
            alt="UIR Logo"
            className="w-10 h-10 rounded-lg bg-white object-contain p-0.5 shadow-sm"
          />
          <div className="text-left">
            <h1 className="font-extrabold text-sm md:text-base leading-tight tracking-tight">
              UNIVERSITÉ INTERNATIONALE DE RABAT
            </h1>
            <p className="text-[11px] text-[#93c5fd] font-medium">
              Service Scolarité · Grand Écran des Appels &amp; Rang de la File
            </p>
          </div>
        </div>

        {/* Live clock and counters */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 bg-[#0a2d6b] px-3 py-1 rounded-lg text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-slate-200">En cours : <strong>{data.total_en_cours || 0}</strong></span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-200">En attente : <strong>{data.total_attente || 0}</strong></span>
          </div>

          <div className="text-right">
            <div className="text-xs text-[#93c5fd] font-semibold capitalize leading-none">
              {currentDate}
            </div>
            <div className="text-xl md:text-2xl font-black tracking-tight leading-none text-white mt-0.5 font-mono">
              {currentTime}
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT AREA (Takes remaining height, NO SCROLL) ───── */}
      <main className="flex-1 p-3.5 grid grid-cols-12 gap-3.5 min-h-0 overflow-hidden">
        
        {/* LEFT COLUMN: DERNIER APPEL + TOUS LES PÔLES (7 Cols) */}
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-3 min-h-0 overflow-hidden">
          
          {/* BANNIÈRE DERNIER APPEL */}
          <div className="bg-gradient-to-r from-[#00204d] to-[#0a3875] rounded-2xl p-4 text-white shadow-lg flex items-center justify-between shrink-0 border border-blue-900/40">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-amber-400 text-[#00204d] flex items-center justify-center font-black animate-pulse shadow-md">
                <span className="material-symbols-outlined text-[34px]">notifications_active</span>
              </div>
              <div className="text-left">
                <span className="inline-block text-[11px] font-extrabold uppercase tracking-wider bg-amber-400/20 text-amber-300 px-2.5 py-0.5 rounded-full mb-0.5">
                  Dernier Numéro Appelé
                </span>
                <p className="text-xs text-blue-100 font-medium">
                  L'étudiant portant ce numéro est invité au guichet :
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-black/25 px-5 py-2 rounded-xl border border-white/10">
              <div className="text-center">
                <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider block">Numéro</span>
                <span className="text-3xl md:text-4xl font-black text-white font-mono tracking-tight">
                  {lastCalled ? lastCalled.numero : "—"}
                </span>
              </div>
              <span className="material-symbols-outlined text-amber-300 text-[26px]">arrow_forward</span>
              <div className="text-center">
                <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider block">Orientation</span>
                <span className="text-xl md:text-2xl font-black text-amber-300">
                  {lastCalled ? (lastCalled.guichet_nom || `GUICHET ${lastCalled.guichet}`) : "EN ATTENTE"}
                </span>
              </div>
            </div>
          </div>

          {/* GRILLE DES PÔLES ET GUICHETS (S'adapte sans dépasser) */}
          <div className="flex-1 grid grid-cols-2 gap-2.5 min-h-0 overflow-hidden">
            {poles.map((pole) => (
              <div
                key={pole.id}
                className="bg-white rounded-xl p-2.5 shadow-sm border border-slate-200 flex flex-col min-h-0 overflow-hidden"
              >
                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 shrink-0">
                  <div className="flex items-center gap-1.5 text-left">
                    <span className="material-symbols-outlined text-blue-700 text-[18px]">{pole.icon}</span>
                    <span className="font-extrabold text-xs text-slate-800 tracking-tight truncate">
                      {pole.titre}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full shrink-0">
                    {pole.badge}
                  </span>
                </div>

                {/* Sub-grid of desks */}
                <div className="flex-1 grid grid-cols-2 gap-1.5 min-h-0 overflow-y-auto pr-0.5">
                  {pole.guichets.map((g) => (
                    <div
                      key={g.num}
                      className={`p-1.5 rounded-lg border text-left transition-all ${
                        g.ticket
                          ? "bg-blue-50/80 border-blue-300 shadow-xs"
                          : "bg-slate-50 border-slate-200 opacity-75"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 truncate">{g.nom}</span>
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            g.ticket ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                          }`}
                        />
                      </div>
                      <div className="mt-0.5">
                        {g.ticket ? (
                          <div className="flex items-baseline justify-between">
                            <span className="text-sm font-black text-blue-900 font-mono tracking-tight">
                              {g.ticket.numero}
                            </span>
                            <span className="text-[9px] font-semibold text-blue-700 truncate max-w-[65px]">
                              {g.ticket.type_label}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Disponible</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* RIGHT COLUMN: RANG DANS LA FILE D'ATTENTE (5 Cols - NO SCROLL / FITS SCREEN) */}
        <div className="col-span-12 lg:col-span-5 bg-white rounded-2xl p-3.5 shadow-sm border border-slate-200 flex flex-col min-h-0 overflow-hidden text-left">
          
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">format_list_numbered</span>
              </div>
              <div>
                <h2 className="font-extrabold text-sm text-slate-900">
                  File d'Attente &amp; Tour du Candidat
                </h2>
                <p className="text-[10px] text-slate-500">
                  Votre tour dans le rang est mis à jour en temps réel.
                </p>
              </div>
            </div>

            <span className="px-2.5 py-1 bg-amber-100 text-amber-900 font-black text-xs rounded-full">
              {waitingList.length} en attente
            </span>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-12 gap-1 px-2 py-1 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-600 uppercase tracking-wider shrink-0 mb-1.5">
            <div className="col-span-3 text-center">Rang</div>
            <div className="col-span-3 text-center">Ticket</div>
            <div className="col-span-3">Filière / Type</div>
            <div className="col-span-3 text-right">Affectation</div>
          </div>

          {/* Waiting Tickets List */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1">
            {waitingList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs py-8">
                <span className="material-symbols-outlined text-4xl mb-1 text-slate-300">check_circle</span>
                <p className="font-semibold">Aucun ticket en attente</p>
                <p className="text-[10px]">Tous les étudiants ont été pris en charge.</p>
              </div>
            ) : (
              waitingList.slice(0, 16).map((t, idx) => {
                const isNext = idx === 0;
                return (
                  <div
                    key={t.id || idx}
                    className={`grid grid-cols-12 gap-1 items-center px-2 py-1.5 rounded-lg border text-xs transition-all ${
                      isNext
                        ? "bg-amber-50/90 border-amber-300 shadow-xs font-bold"
                        : idx % 2 === 0
                        ? "bg-slate-50 border-slate-100"
                        : "bg-white border-slate-100"
                    }`}
                  >
                    {/* Rang */}
                    <div className="col-span-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-black ${
                          isNext
                            ? "bg-amber-500 text-white animate-bounce"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        #{t.rang || idx + 1}
                      </span>
                    </div>

                    {/* Numéro */}
                    <div className="col-span-3 text-center">
                      <span className="font-black text-sm text-[#00204d] font-mono">
                        {t.numero}
                      </span>
                    </div>

                    {/* Service / Type */}
                    <div className="col-span-3 truncate text-[11px] text-slate-600 font-medium">
                      {t.service_label || t.type_label}
                    </div>

                    {/* Guichet */}
                    <div className="col-span-3 text-right truncate">
                      <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-900">
                        {t.guichet_nom || `G${t.guichet}`}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer note */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
            <span>📢 Préparez vos pièces justificatives</span>
            <span>Le même numéro vous suit jusqu'au bout</span>
          </div>

        </div>

      </main>
    </div>
  );
}
