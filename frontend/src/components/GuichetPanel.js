import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  getGuichets,
  clientSuivant,
  clorerTicket,
  getStatistiques,
  login,
  pauseGuichet,
  resumeGuichet,
  setGuichetAbsent,
  activateGuichet,
} from "../api";

const ALL_DESKS = [
  // 4 Inscription
  { numero: 1, nom: "Guichet Inscription 1", pole: "inscription", label: "G1 Inscription" },
  { numero: 2, nom: "Guichet Inscription 2", pole: "inscription", label: "G2 Inscription" },
  { numero: 3, nom: "Guichet Inscription 3", pole: "inscription", label: "G3 Inscription" },
  { numero: 4, nom: "Guichet Inscription 4", pole: "inscription", label: "G4 Inscription" },
  // 2 Concours
  { numero: 5, nom: "Guichet Concours 1", pole: "concours", label: "Concours 1" },
  { numero: 6, nom: "Guichet Concours 2", pole: "concours", label: "Concours 2" },
  // 8 Caisses de Paiement
  { numero: 7, nom: "Caisse Paiement 1", pole: "paiement", label: "Caisse 1" },
  { numero: 8, nom: "Caisse Paiement 2", pole: "paiement", label: "Caisse 2" },
  { numero: 9, nom: "Caisse Paiement 3", pole: "paiement", label: "Caisse 3" },
  { numero: 10, nom: "Caisse Paiement 4", pole: "paiement", label: "Caisse 4" },
  { numero: 11, nom: "Caisse Paiement 5", pole: "paiement", label: "Caisse 5" },
  { numero: 12, nom: "Caisse Paiement 6", pole: "paiement", label: "Caisse 6" },
  { numero: 13, nom: "Caisse Paiement 7", pole: "paiement", label: "Caisse 7" },
  { numero: 14, nom: "Caisse Paiement 8", pole: "paiement", label: "Caisse 8" },
  // 2 Service Numérique (Dernière étape)
  { numero: 15, nom: "Service Numérique 1", pole: "numerique", label: "Numérique 1" },
  { numero: 16, nom: "Service Numérique 2", pole: "numerique", label: "Numérique 2" },
];

export default function GuichetPanel() {
  // Current Guichet Number (1 to 16)
  const [guichetNum, setGuichetNum] = useState(() => {
    return parseInt(localStorage.getItem("guichet_numero") || "1", 10);
  });
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [passwordInput, setPasswordInput] = useState("guichet123");
  const [loginError, setLoginError] = useState("");

  const currentDesk = ALL_DESKS.find((d) => d.numero === guichetNum) || ALL_DESKS[0];
  const pole = currentDesk.pole;

  // Operator data & active ticket
  const [allGuichets, setAllGuichets] = useState([]);
  const [activeTicket, setActiveTicket] = useState(null);
  const [localQueue, setLocalQueue] = useState([]);

  // Session timer (seconds in current consultation)
  const [sessionSeconds, setSessionSeconds] = useState(0);

  // Statistics
  const [statScope, setStatScope] = useState("my"); // "my" or "all"
  const [statPeriod, setStatPeriod] = useState("jour"); // "jour", "semaine", "mois"
  const [statData, setStatData] = useState(null);

  // Toast notifications
  const [toasts, setToasts] = useState([]);

  const addToast = (title, message, icon = "check_circle") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, title, message, icon }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Web Audio Bip Synthesizer
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {
      // Audio fallback
    }
  };

  // Fetch Guichets list
  const refreshGuichets = useCallback(async () => {
    try {
      const res = await getGuichets();
      const list = Array.isArray(res) ? res : res?.guichets || [];
      setAllGuichets(list);

      const current = list.find((g) => g.numero === guichetNum);
      if (current) {
        setActiveTicket(current.ticket_en_cours || null);
        setLocalQueue(current.file_attente || []);
      }
    } catch (err) {
      console.error("Erreur actualisation guichets:", err);
    }
  }, [guichetNum]);

  // Fetch Stats
  const refreshStats = useCallback(async () => {
    try {
      const targetGuichet = statScope === "my" ? guichetNum : undefined;
      const res = await getStatistiques(statPeriod, targetGuichet);
      setStatData(res);
    } catch (err) {
      console.error("Erreur actualisation stats:", err);
    }
  }, [guichetNum, statScope, statPeriod]);

  // Polling setup
  useEffect(() => {
    localStorage.setItem("guichet_numero", String(guichetNum));
    refreshGuichets();
    refreshStats();
    const interval = setInterval(() => {
      refreshGuichets();
      refreshStats();
    }, 2500);
    return () => clearInterval(interval);
  }, [guichetNum, refreshGuichets, refreshStats]);

  // Desk state from backend
  const currentDeskBackend = allGuichets.find((g) => g.numero === guichetNum);
  const deskEtat = currentDeskBackend?.etat || "DISPONIBLE";
  const isDeskPaused = deskEtat === "PAUSE";
  const isDeskAbsent = deskEtat === "ABSENT";

  // Consultation timer effect
  useEffect(() => {
    if (!activeTicket || isDeskPaused || isDeskAbsent) return;
    const timer = setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [activeTicket, isDeskPaused, isDeskAbsent]);

  // Reset timer on new ticket
  const prevTicketIdRef = useRef(null);
  useEffect(() => {
    if (activeTicket && activeTicket.id !== prevTicketIdRef.current) {
      setSessionSeconds(0);
      prevTicketIdRef.current = activeTicket.id;
    }
  }, [activeTicket]);

  // Handle Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError("");
    try {
      await login(guichetNum, passwordInput);
      setIsLoggedIn(true);
      addToast("Connexion réussie", `Vous êtes connecté au Guichet ${guichetNum}`);
      refreshGuichets();
    } catch (err) {
      setLoginError(err?.response?.data?.erreur || "Mot de passe incorrect.");
    }
  };

  // State transitions: Pause / Resume / Absent / Activate
  const handlePause = async () => {
    try {
      await pauseGuichet(guichetNum);
      addToast("Guichet en pause", `Le Guichet ${guichetNum} est maintenant EN PAUSE.`, "coffee");
      refreshGuichets();
    } catch (err) {
      addToast("Erreur", "Impossible de mettre le guichet en pause.", "error");
    }
  };

  const handleResume = async () => {
    try {
      await resumeGuichet(guichetNum);
      addToast("Service repris", `Le Guichet ${guichetNum} a repris son activité.`, "play_arrow");
      refreshGuichets();
    } catch (err) {
      addToast("Erreur", "Impossible de reprendre le service.", "error");
    }
  };

  const handleAbsent = async () => {
    try {
      await setGuichetAbsent(guichetNum);
      addToast("Guichet absent", `Le Guichet ${guichetNum} est marqué ABSENT (fermé).`, "do_not_disturb_on");
      refreshGuichets();
    } catch (err) {
      addToast("Erreur", "Impossible de marquer le guichet absent.", "error");
    }
  };

  const handleActivate = async () => {
    try {
      await activateGuichet(guichetNum);
      addToast("Guichet réactivé", `Le Guichet ${guichetNum} est réactivé et prêt à accueillir.`, "check_circle");
      refreshGuichets();
    } catch (err) {
      addToast("Erreur", "Impossible de réactiver le guichet.", "error");
    }
  };

  // Actions on active ticket
  const handleCloture = async (action, label, note) => {
    if (!activeTicket) return;
    try {
      await clorerTicket(guichetNum, action);
      addToast(label, note, "task_alt");
      setActiveTicket(null);
      refreshGuichets();
      refreshStats();
    } catch (err) {
      addToast("Erreur", err?.response?.data?.erreur || "Impossible de clôturer le ticket.", "error");
    }
  };

  // Action: APPELER LE SUIVANT (Prise explicite d'un ticket de la file globale)
  const handleClientSuivant = async () => {
    if (isDeskPaused) {
      addToast("Guichet en pause", "Veuillez reprendre le service avant d'appeler le suivant.", "warning");
      return;
    }
    if (isDeskAbsent) {
      addToast("Guichet absent", "Veuillez réactiver ce guichet avant d'appeler le suivant.", "warning");
      return;
    }
    if (activeTicket) {
      addToast("Candidat en cours", "Veuillez clôturer le candidat en cours avant d'appeler le suivant.", "warning");
      return;
    }
    try {
      const res = await clientSuivant(guichetNum);
      if (res?.ticket) {
        playBeep();
        addToast("Nouveau candidat appelé", `Appel du ticket ${res.ticket.numero} au Guichet ${guichetNum}`, "notifications_active");
        setActiveTicket(res.ticket);
        setSessionSeconds(0);
      } else {
        addToast("File vide", `Aucun candidat en attente pour le Pôle ${pole}.`, "info");
      }
      refreshGuichets();
      refreshStats();
    } catch (err) {
      addToast("Information", err?.response?.data?.erreur || "Aucun ticket disponible.", "info");
    }
  };

  // Recall button
  const handleRecall = () => {
    if (!activeTicket) return;
    playBeep();
    addToast(
      "Rappel sonore diffusé",
      `Rappel émis sur le grand écran pour le ticket ${activeTicket.numero}`,
      "campaign"
    );
  };

  // Format timer
  const formatTimer = (sec) => {
    const mins = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${mins}:${s}`;
  };

  // Total waiting globally
  const totalGlobalWait = allGuichets.reduce(
    (acc, g) => acc + (g.file_attente?.length || 0),
    0
  );

  return (
    <div className="w-full pt-20 bg-background min-h-screen px-margin-page-mobile lg:px-margin-page-desktop pb-space-3xl max-w-[1440px] mx-auto">
      
      {/* GUICHET SELECTOR MODAL / AUTH CHECK */}
      {!isLoggedIn && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-sm w-full p-space-lg shadow-2xl text-left">
            <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface mb-2">
              Connexion {currentDesk.nom}
            </h3>
            <p className="font-label-caption text-on-surface-variant mb-4">
              Mot de passe par défaut : <code className="bg-surface-container px-1 rounded">guichet123</code>
            </p>
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">Poste opérateur</label>
                <select
                  value={guichetNum}
                  onChange={(e) => setGuichetNum(parseInt(e.target.value, 10))}
                  className="w-full p-2.5 rounded-lg border border-outline-variant bg-surface-container-low text-on-surface text-sm"
                >
                  <optgroup label="🎓 Inscriptions (4 Guichets)">
                    {ALL_DESKS.filter((d) => d.pole === "inscription").map((d) => (
                      <option key={d.numero} value={d.numero}>{d.nom}</option>
                    ))}
                  </optgroup>
                  <optgroup label="🏆 Concours (2 Postes)">
                    {ALL_DESKS.filter((d) => d.pole === "concours").map((d) => (
                      <option key={d.numero} value={d.numero}>{d.nom}</option>
                    ))}
                  </optgroup>
                  <optgroup label="💳 Caisses de Paiement (8 Caisses)">
                    {ALL_DESKS.filter((d) => d.pole === "paiement").map((d) => (
                      <option key={d.numero} value={d.numero}>{d.nom}</option>
                    ))}
                  </optgroup>
                  <optgroup label="💻 Service Numérique (2 Postes - Dernière étape)">
                    {ALL_DESKS.filter((d) => d.pole === "numerique").map((d) => (
                      <option key={d.numero} value={d.numero}>{d.nom}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">Mot de passe</label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-outline-variant bg-surface-container-low text-on-surface"
                />
              </div>
              {loginError && <p className="text-xs text-error font-medium">{loginError}</p>}
              <button
                type="submit"
                className="w-full py-2.5 bg-primary text-on-primary rounded-lg font-bold hover:bg-primary-container transition-all"
              >
                Ouvrir la session
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TOP CONTEXT / GUICHET OPERATOR BAR */}
      <div className="w-full bg-surface-container-lowest rounded-xl p-space-lg shadow-sm mb-space-lg flex flex-wrap items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-md min-w-0 text-left">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-sm flex-shrink-0 font-bold">
            <span className="font-headline-sm text-headline-sm">{guichetNum < 10 ? `0${guichetNum}` : guichetNum}</span>
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-space-xs flex-wrap">
              <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                {currentDesk.nom}
              </span>

              {/* Real-time State Badge */}
              {isDeskPaused ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  EN PAUSE
                </span>
              ) : isDeskAbsent ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-slate-200 text-slate-700 border border-slate-400 font-bold text-xs">
                  <span className="w-2 h-2 rounded-full bg-slate-500" />
                  ABSENT (FERMÉ)
                </span>
              ) : activeTicket ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  ACTIF (EN CONSULTATION)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-300 font-bold text-xs">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  DISPONIBLE
                </span>
              )}
            </div>
            <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
              Pôle : {currentDesk.pole === "inscription" ? "Accueil & Inscriptions" : currentDesk.pole === "concours" ? "Service Concours" : currentDesk.pole === "paiement" ? "Caisse d'Encaissement" : "Service Numérique (Dernière étape)"}
            </span>
          </div>
        </div>

        {/* State toggles & Switch guichet */}
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          {/* Switch guichet quickly */}
          <div className="flex items-center gap-1.5 bg-surface-container p-1.5 rounded-lg">
            <span className="text-xs text-on-surface-variant px-1 font-semibold">Poste :</span>
            <select
              value={guichetNum}
              onChange={(e) => setGuichetNum(parseInt(e.target.value, 10))}
              className="bg-surface-container-high text-on-surface text-xs font-bold px-2 py-1 rounded border-0 cursor-pointer"
            >
              {ALL_DESKS.map((d) => (
                <option key={d.numero} value={d.numero}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {/* PAUSE / REPRENDRE BUTTON */}
          {isDeskPaused ? (
            <button
              onClick={handleResume}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">play_arrow</span>
              <span>REPRENDRE LE SERVICE</span>
            </button>
          ) : (
            <button
              onClick={handlePause}
              disabled={Boolean(activeTicket)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs border border-amber-300 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">coffee</span>
              <span>METTRE EN PAUSE</span>
            </button>
          )}

          {/* ABSENT / ACTIVER BUTTON */}
          {isDeskAbsent ? (
            <button
              onClick={handleActivate}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-bold text-xs shadow-sm transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">power_settings_new</span>
              <span>ACTIVER LE GUICHET</span>
            </button>
          ) : (
            <button
              onClick={handleAbsent}
              disabled={Boolean(activeTicket) || isDeskPaused}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-300 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">do_not_disturb_on</span>
              <span>ABSENT</span>
            </button>
          )}
        </div>
      </div>

      {/* ALERT BANNER IF PAUSED OR ABSENT */}
      {isDeskPaused && (
        <div className="w-full bg-amber-50 border-2 border-amber-300 text-amber-900 rounded-xl p-4 mb-space-lg flex items-center justify-between gap-4 text-left shadow-sm">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-600 text-[28px]">coffee</span>
            <div>
              <p className="font-extrabold text-sm">Guichet actuellement EN PAUSE</p>
              <p className="text-xs text-amber-700">
                Ce poste est suspendu sur le grand écran. L'appel du candidat suivant est désactivé.
              </p>
            </div>
          </div>
          <button
            onClick={handleResume}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-lg shadow-sm"
          >
            Reprendre le service
          </button>
        </div>
      )}

      {isDeskAbsent && (
        <div className="w-full bg-slate-100 border-2 border-slate-400 text-slate-800 rounded-xl p-4 mb-space-lg flex items-center justify-between gap-4 text-left shadow-sm">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-slate-600 text-[28px]">lock</span>
            <div>
              <p className="font-extrabold text-sm">Guichet marqué ABSENT (Fermé)</p>
              <p className="text-xs text-slate-600">
                L'agent est absent. Activez le guichet pour réouvrir le poste et recevoir des usagers.
              </p>
            </div>
          </div>
          <button
            onClick={handleActivate}
            className="px-4 py-2 bg-primary hover:bg-primary-container text-white text-xs font-black rounded-lg shadow-sm"
          >
            Activer le guichet
          </button>
        </div>
      )}

      {/* MAIN OPERATOR COCKPIT: 2 COLUMNS (HERO CALL ZONE + LOCAL QUEUE) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg mb-space-xl">
        
        {/* ZONE 1: CANDIDAT EN COURS HERO CARD (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col gap-space-md text-left">
          <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-md relative overflow-hidden flex flex-col justify-between border border-surface-container-high/40">
            <div className={`absolute top-0 left-0 right-0 h-1.5 ${
              isDeskPaused ? "bg-amber-500" : isDeskAbsent ? "bg-slate-500" : "bg-primary"
            }`} />

            {/* Top metadata of ongoing student */}
            <div className="flex flex-wrap items-start justify-between gap-space-md mb-space-lg">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-label-counter-badge text-label-counter-badge uppercase tracking-wider text-secondary font-bold">
                    Candidat en cours de traitement
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-surface-container font-label-caption text-label-caption text-on-surface-variant font-semibold">
                    {currentDesk.nom}
                  </span>
                </div>

                <div className="mt-2">
                  {activeTicket ? (
                    <div className="flex flex-wrap items-baseline gap-4">
                      <span className="text-5xl font-black text-primary font-mono tracking-tight">
                        {activeTicket.numero}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-on-surface">
                          {activeTicket.service_label || activeTicket.service}
                        </span>
                        <span className="text-xs text-on-surface-variant">
                          Filière : {activeTicket.type_label || activeTicket.type}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-3">
                      <span className="text-on-surface-variant text-base font-semibold">
                        {isDeskPaused
                          ? "Guichet en pause — Aucun ticket en cours"
                          : isDeskAbsent
                          ? "Guichet fermé — Cliquez sur 'Activer' pour reprendre"
                          : "Aucun candidat en cours au guichet"}
                      </span>
                      <p className="text-xs text-on-surface-variant/70 mt-1">
                        Les candidats attendent dans la file globale. Cliquez sur [ APPELER LE SUIVANT ] dès que vous êtes prêt.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Consultation timer */}
              {activeTicket && (
                <div className="flex items-center gap-3 bg-surface-container px-space-md py-2 rounded-xl">
                  <span className="material-symbols-outlined text-secondary text-[20px]">timer</span>
                  <span className="font-mono font-bold text-sm text-on-surface">
                    {formatTimer(sessionSeconds)}
                  </span>
                </div>
              )}
            </div>

            {/* ACTION BUTTONS TAILORED TO CURRENT DESK ROLE */}
            <div>
              <div className="flex items-center justify-between mb-space-sm">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Actions de clôture &amp; réorientation :
                </span>
                <button
                  onClick={handleRecall}
                  disabled={!activeTicket}
                  className="text-xs text-secondary hover:text-on-secondary-container font-bold flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[16px]">campaign</span>
                  Rappeler le candidat (Bip)
                </button>
              </div>

              <div className={`grid gap-space-sm ${
                pole === "inscription" || pole === "concours"
                  ? "grid-cols-1 sm:grid-cols-3"
                  : pole === "paiement"
                  ? "grid-cols-1 sm:grid-cols-2"
                  : "grid-cols-1"
              }`}>

                {/* 1. Terminer visite (Always present) */}
                <button
                  onClick={() =>
                    handleCloture(
                      "termine",
                      "Visite terminée",
                      `Le ticket ${activeTicket?.numero} a été clôturé avec succès.`
                    )
                  }
                  disabled={!activeTicket}
                  className="flex flex-col items-center justify-center p-space-md rounded-xl bg-primary text-on-primary hover:bg-primary-container transition-all shadow-sm group text-center disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-tertiary-fixed text-[22px] group-hover:scale-110 transition-transform">
                      task_alt
                    </span>
                    <span className="font-headline-sm text-headline-sm font-bold">
                      {pole === "numerique" ? "Clôture Finale Dossier" : "Clôturer / Terminé"}
                    </span>
                  </div>
                  <span className="font-label-caption text-label-caption text-primary-fixed-dim">
                    {pole === "numerique" ? "Fin définitive du parcours étudiant" : "Marquer COMPLETED & libérer guichet"}
                  </span>
                </button>

                {/* 2. Réorienter Numérique (Inscription, Concours, Paiement) */}
                {(pole === "inscription" || pole === "concours" || pole === "paiement") && (
                  <button
                    onClick={() =>
                      handleCloture(
                        "service_numerique",
                        "Transfert Service Numérique",
                        `Le ticket ${activeTicket?.numero} est transféré vers le Service Numérique (Dernière étape).`
                      )
                    }
                    disabled={!activeTicket}
                    className="flex flex-col items-center justify-center p-space-md rounded-xl bg-secondary text-on-secondary hover:bg-on-secondary-container transition-all shadow-sm group text-center disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-[22px] group-hover:rotate-45 transition-transform">
                        devices
                      </span>
                      <span className="font-headline-sm text-headline-sm font-bold">
                        {pole === "paiement" ? "Passer au Service Numérique" : "Pôle Numérique (2 Postes)"}
                      </span>
                    </div>
                    <span className="font-label-caption text-label-caption text-secondary-fixed">
                      Même numéro · Entrée en file Numérique
                    </span>
                  </button>
                )}

                {/* 3. Réorienter Paiement (Seulement pour Inscription et Concours) */}
                {(pole === "inscription" || pole === "concours") && (
                  <button
                    onClick={() =>
                      handleCloture(
                        "avp_paiement",
                        "Transfert Caisses Paiement",
                        `Le ticket ${activeTicket?.numero} est transféré vers une Caisse de Paiement (8 Caisses disponibles).`
                      )
                    }
                    disabled={!activeTicket}
                    className="flex flex-col items-center justify-center p-space-md rounded-xl bg-primary-container text-on-primary hover:bg-primary transition-all shadow-sm group text-center disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-[22px] text-secondary-fixed-dim group-hover:scale-110 transition-transform">
                        payments
                      </span>
                      <span className="font-headline-sm text-headline-sm font-bold">Paiement (8 Caisses)</span>
                    </div>
                    <span className="font-label-caption text-label-caption text-on-primary-container">
                      Même numéro · Entrée en file Caisses
                    </span>
                  </button>
                )}
              </div>

              {/* CALL NEXT BUTTON: L'ACTION MAÎTRESSE EXPLICITE */}
              <div className="pt-space-lg mt-space-md border-t border-surface-container-high/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-space-md">
                <div className="flex items-center gap-2 px-space-md py-space-xs bg-surface-container rounded-lg flex-1">
                  <span className="material-symbols-outlined text-outline text-[18px] flex-shrink-0">info</span>
                  <span className="font-label-caption text-label-caption text-on-surface-variant">
                    {isDeskPaused
                      ? "Guichet EN PAUSE : reprenez le service avant d'appeler."
                      : isDeskAbsent
                      ? "Guichet ABSENT : activez le guichet pour appeler."
                      : activeTicket
                      ? "Candidat en cours : clôturez d'abord le ticket avant d'appeler le suivant."
                      : "Guichet DISPONIBLE : cliquez sur [ APPELER LE SUIVANT ] pour prendre le prochain ticket."}
                  </span>
                </div>

                <button
                  onClick={handleClientSuivant}
                  disabled={Boolean(activeTicket) || isDeskPaused || isDeskAbsent}
                  className={`flex items-center justify-center gap-2.5 px-space-2xl py-3.5 rounded-xl font-headline-sm text-base font-black transition-all ${
                    Boolean(activeTicket) || isDeskPaused || isDeskAbsent
                      ? "bg-surface-container-high text-on-surface-variant cursor-not-allowed opacity-50"
                      : "bg-[#00204d] hover:bg-[#0a3875] text-white shadow-lg cursor-pointer active:scale-98"
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px]">person_add</span>
                  <span>APPELER LE SUIVANT</span>
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* ZONE 2: FILE D'ATTENTE DU PÔLE (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col text-left">
          <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col h-full justify-between border border-surface-container-high/40">
            <div>
              <div className="flex items-center justify-between pb-space-md mb-space-md border-b border-surface-container-high/60">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">queue</span>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                    File Pôle {currentDesk.pole}
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs">
                  {localQueue.length} en attente
                </span>
              </div>

              {/* Ticket stack for this Pole */}
              <div className="flex flex-col gap-space-sm max-h-[420px] overflow-y-auto pr-1">
                {localQueue.length === 0 ? (
                  <div className="p-space-xl text-center text-on-surface-variant font-label-caption text-label-caption bg-surface-container-low rounded-xl">
                    <span className="material-symbols-outlined text-3xl mb-1 text-emerald-500 block">check_circle</span>
                    Aucun candidat en attente pour ce pôle.
                  </div>
                ) : (
                  localQueue.map((t, idx) => (
                    <div
                      key={t.id || t.numero || idx}
                      className={`p-space-md rounded-xl transition-all flex items-center justify-between border ${
                        idx === 0
                          ? "bg-amber-50/80 border-amber-300 font-bold"
                          : "bg-surface-container-low hover:bg-surface-container border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-space-md">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                          idx === 0 ? "bg-amber-400 text-[#00204d]" : "bg-surface-container-high text-on-surface"
                        }`}>
                          #{t.rang || idx + 1}
                        </span>
                        <div className="flex flex-col">
                          <span className="font-headline-sm text-headline-sm text-on-surface font-extrabold font-mono">
                            {t.numero}
                          </span>
                          <span className="font-label-caption text-label-caption text-on-surface-variant truncate max-w-[140px]">
                            {t.service_label || t.service}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold uppercase text-amber-700">
                          {idx === 0 ? "Prochain éligible" : `${idx} avant`}
                        </span>
                        <span className="font-body-sm text-xs font-semibold text-secondary">
                          ~ {(idx + 1) * 3} min
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Smart dispatch note */}
            <div className="mt-space-md p-space-sm rounded-lg bg-surface-container flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-secondary">groups</span>
              <span className="font-label-caption text-label-caption text-on-surface-variant">
                File globale : les tickets ne sont attribués à un guichet qu'au clic sur [ APPELER LE SUIVANT ].
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ZONE 3: TABLEAU COMPLET - ÉTAT DE TOUS LES 16 GUICHETS */}
      <div className="w-full bg-surface-container-lowest rounded-xl p-space-lg md:p-space-xl shadow-sm mb-space-xl text-left border border-surface-container-high/40">
        <div className="flex flex-wrap items-center justify-between gap-space-md mb-space-lg">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">grid_view</span>
              <span className="font-headline-md text-headline-md text-on-surface font-bold">
                État Réel des 16 Guichets
              </span>
            </div>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Visualisation complète de tous les guichets : ACTIF, DISPONIBLE, EN PAUSE, ABSENT
            </span>
          </div>

          <div className="flex items-center gap-space-sm">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-900 font-bold text-xs">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              16 Guichets configurés
            </span>
            <span className="text-on-surface-variant font-label-caption text-label-caption">
              Total usagers en attente globale : <strong className="text-on-surface font-bold">{totalGlobalWait}</strong>
            </span>
          </div>
        </div>

        {/* 16 Guichets Table / Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-space-sm">
          {Array.from({ length: 16 }, (_, index) => index + 1).map((num) => {
            const g = allGuichets.find((item) => item.numero === num);
            const isCurrent = num === guichetNum;
            const etat = g?.etat || "DISPONIBLE";
            const ticket = g?.ticket_en_cours;
            const waitCount = g?.file_attente?.length || 0;

            let badgeColor = "bg-blue-100 text-blue-900 border-blue-200";
            let statusLabel = "DISPONIBLE";

            if (etat === "PAUSE") {
              badgeColor = "bg-amber-100 text-amber-900 border-amber-300";
              statusLabel = "EN PAUSE";
            } else if (etat === "ABSENT") {
              badgeColor = "bg-slate-200 text-slate-700 border-slate-300";
              statusLabel = "ABSENT";
            } else if (ticket || etat === "EN_COURS") {
              badgeColor = "bg-emerald-100 text-emerald-900 border-emerald-300";
              statusLabel = "ACTIF";
            }

            return (
              <div
                key={num}
                onClick={() => setGuichetNum(num)}
                className={`rounded-xl p-3 flex flex-col justify-between cursor-pointer transition-all border ${
                  isCurrent
                    ? "bg-surface-container-lowest shadow-md ring-2 ring-primary border-primary relative overflow-hidden"
                    : "bg-surface-container-low hover:bg-surface-container border-surface-container-high/40"
                }`}
              >
                {isCurrent && <div className="absolute top-0 left-0 right-0 h-1 bg-primary"></div>}

                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`text-xs font-bold ${
                      isCurrent ? "text-primary" : "text-on-surface"
                    }`}
                  >
                    G-{String(num).padStart(2, "0")} {isCurrent && "★"}
                  </span>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${badgeColor}`}>
                    {statusLabel}
                  </span>
                </div>

                <div className="my-1 text-center">
                  <span
                    className={`font-mono text-sm font-extrabold ${
                      ticket ? "text-emerald-700" : "text-on-surface-variant"
                    }`}
                  >
                    {ticket ? ticket.numero : etat === "PAUSE" ? "--" : etat === "ABSENT" ? "--" : "Aucun ticket"}
                  </span>
                </div>

                <div className="pt-1 flex items-center justify-between text-[10px] text-on-surface-variant border-t border-surface-container-high/40">
                  <span>File pôle</span>
                  <span className="font-bold text-on-surface bg-surface-container px-1.5 py-0.5 rounded">
                    {waitCount}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ZONE 4: STATISTIQUES GUICHET & GLOBALES */}
      <div className="w-full bg-surface-container-lowest rounded-xl p-space-lg md:p-space-xl shadow-sm text-left border border-surface-container-high/40">
        <div className="flex flex-wrap items-center justify-between gap-space-md pb-space-lg mb-space-lg border-b border-surface-container-high/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">analytics</span>
              <h3 className="font-headline-md text-headline-md text-on-surface font-bold">
                Statistiques d'Activité &amp; Performance
              </h3>
            </div>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Mesures de cadence d'accueil, fluidité et satisfaction étudiante
            </span>
          </div>

          {/* FILTERS & TAB TOGGLES */}
          <div className="flex flex-wrap items-center gap-space-sm">
            <div className="p-1 bg-surface-container rounded-lg flex items-center text-on-surface-variant font-label-caption text-label-caption">
              <button
                onClick={() => setStatScope("my")}
                className={`px-space-md py-1.5 rounded-lg font-bold transition-all ${
                  statScope === "my"
                    ? "bg-surface-container-lowest text-on-surface shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Mon Guichet (G{guichetNum})
              </button>
              <button
                onClick={() => setStatScope("all")}
                className={`px-space-md py-1.5 rounded-lg font-bold transition-all ${
                  statScope === "all"
                    ? "bg-surface-container-lowest text-on-surface shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Tous les 16 guichets
              </button>
            </div>

            <div className="p-1 bg-surface-container-low rounded-lg flex items-center text-on-surface-variant font-label-caption text-label-caption">
              <button
                onClick={() => setStatPeriod("jour")}
                className={`px-space-sm py-1.5 rounded-lg font-semibold transition-all ${
                  statPeriod === "jour" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Aujourd'hui
              </button>
              <button
                onClick={() => setStatPeriod("semaine")}
                className={`px-space-sm py-1.5 rounded-lg font-semibold transition-all ${
                  statPeriod === "semaine" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                7 jours
              </button>
              <button
                onClick={() => setStatPeriod("mois")}
                className={`px-space-sm py-1.5 rounded-lg font-semibold transition-all ${
                  statPeriod === "mois" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                30 jours
              </button>
            </div>
          </div>
        </div>

        {/* 4 Key Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md mb-space-xl">
          <div className="bg-surface-container-low p-space-lg rounded-xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-on-surface-variant mb-space-sm">
              <span className="font-label-caption text-label-caption uppercase font-semibold">Tickets traités</span>
              <span className="material-symbols-outlined text-secondary text-[20px]">how_to_reg</span>
            </div>
            <span className="font-display-ticket-mobile text-display-ticket-mobile text-on-surface font-extrabold">
              {statData?.total ?? 36}
            </span>
            <span className="font-label-caption text-label-caption text-on-tertiary-container font-medium mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">arrow_upward</span> +14% par rapport à hier
            </span>
          </div>

          <div className="bg-surface-container-low p-space-lg rounded-xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-on-surface-variant mb-space-sm">
              <span className="font-label-caption text-label-caption uppercase font-semibold">Temps moyen d'attente</span>
              <span className="material-symbols-outlined text-secondary text-[20px]">hourglass_empty</span>
            </div>
            <span className="font-display-ticket-mobile text-display-ticket-mobile text-on-surface font-extrabold">
              4m 12s
            </span>
            <span className="font-label-caption text-label-caption text-on-tertiary-container font-medium mt-1">
              File fluide (Conforme)
            </span>
          </div>

          <div className="bg-surface-container-low p-space-lg rounded-xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-on-surface-variant mb-space-sm">
              <span className="font-label-caption text-label-caption uppercase font-semibold">Taux de réorientation</span>
              <span className="material-symbols-outlined text-secondary text-[20px]">alt_route</span>
            </div>
            <span className="font-display-ticket-mobile text-display-ticket-mobile text-on-surface font-extrabold">
              12%
            </span>
            <span className="font-label-caption text-label-caption text-on-surface-variant mt-1">
              Transferts Caisses / Pôle Numérique
            </span>
          </div>

          <div className="bg-surface-container-low p-space-lg rounded-xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-on-surface-variant mb-space-sm">
              <span className="font-label-caption text-label-caption uppercase font-semibold">Satisfaction Étudiants</span>
              <span className="material-symbols-outlined text-tertiary-fixed-dim text-[20px]">thumb_up</span>
            </div>
            <span className="font-display-ticket-mobile text-display-ticket-mobile text-on-surface font-extrabold">
              98%
            </span>
            <span className="font-label-caption text-label-caption text-on-tertiary-container font-medium mt-1">
              Retours positifs scolarité
            </span>
          </div>
        </div>
      </div>

      {/* TOAST NOTIFICATION CONTAINER */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto bg-surface-container-lowest text-on-surface p-space-md rounded-xl shadow-2xl flex items-center gap-3 transition-all duration-300 border border-surface-container-high text-left"
          >
            <span className="material-symbols-outlined text-secondary text-[22px]">{t.icon}</span>
            <div className="flex flex-col">
              <span className="font-headline-sm text-sm font-bold">{t.title}</span>
              <span className="font-body-sm text-xs text-on-surface-variant">{t.message}</span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
