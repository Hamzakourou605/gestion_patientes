import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  getGuichets,
  clientSuivant,
  clorerTicket,
  getStatistiques,
  login
} from "../api";

export default function GuichetPanel() {
  // Current Guichet Number (1 to 7)
  const [guichetNum, setGuichetNum] = useState(() => {
    return parseInt(localStorage.getItem("guichet_numero") || "3", 10);
  });
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [passwordInput, setPasswordInput] = useState("guichet123");
  const [loginError, setLoginError] = useState("");

  // Operator data & active ticket
  const [allGuichets, setAllGuichets] = useState([]);
  const [activeTicket, setActiveTicket] = useState(null);
  const [localQueue, setLocalQueue] = useState([]);

  // Session timer (seconds in current consultation)
  const [sessionSeconds, setSessionSeconds] = useState(258);
  const [isPaused, setIsPaused] = useState(false);

  // Statistics
  const [statScope, setStatScope] = useState("my"); // "my" or "all"
  const [statPeriod, setStatPeriod] = useState("jour"); // "jour", "semaine", "mois"
  const [statData, setStatData] = useState(null);

  // Toast notifications
  const [toasts, setToasts] = useState([]);

  // Add toast helper
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
      const list = res?.guichets || [];
      setAllGuichets(list);

      // Find current guichet
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
    }, 3500);
    return () => clearInterval(interval);
  }, [guichetNum, refreshGuichets, refreshStats]);

  // Consultation timer effect
  useEffect(() => {
    if (!activeTicket || isPaused) return;
    const timer = setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [activeTicket, isPaused]);

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

  // Action: Client Suivant
  const handleClientSuivant = async () => {
    if (activeTicket) {
      addToast("Action impossible", "Veuillez clôturer le client en cours avant d'appeler le suivant.", "warning");
      return;
    }
    try {
      const res = await clientSuivant(guichetNum);
      if (res?.ticket) {
        playBeep();
        addToast("Nouveau client appelé", `Appel du ticket ${res.ticket.numero} au Guichet ${guichetNum}`, "notifications_active");
        setActiveTicket(res.ticket);
        setSessionSeconds(0);
      } else {
        addToast("File vide", `Aucun étudiant en attente pour le Guichet ${guichetNum}.`, "info");
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
      "Rappel sonore émis",
      `Annonce de convocation diffusée sur le grand écran pour le ticket ${activeTicket.numero}`,
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
              Connexion Guichet {guichetNum}
            </h3>
            <p className="font-label-caption text-on-surface-variant mb-4">
              Mot de passe par défaut : <code className="bg-surface-container px-1 rounded">guichet123</code>
            </p>
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">Numéro de guichet</label>
                <select
                  value={guichetNum}
                  onChange={(e) => setGuichetNum(parseInt(e.target.value, 10))}
                  className="w-full p-2.5 rounded-lg border border-outline-variant bg-surface-container-low text-on-surface"
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <option key={n} value={n}>
                      Guichet {n}
                    </option>
                  ))}
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
            <span className="font-headline-sm text-headline-sm">0{guichetNum}</span>
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-space-xs flex-wrap">
              <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                Guichet N° {guichetNum}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-counter-badge text-label-counter-badge font-bold">
                <span className="w-2 h-2 rounded-full bg-on-tertiary-container animate-pulse"></span>
                {activeTicket ? "En consultation active" : "Prêt pour appel"}
              </span>
            </div>
            <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
              Poste opérationnel • Scolarité Générale, Master &amp; Bachelier
            </span>
          </div>
        </div>

        {/* Right utility actions */}
        <div className="flex items-center gap-space-sm flex-shrink-0">
          {/* Switch guichet quickly */}
          <div className="flex items-center gap-1 bg-surface-container p-1 rounded-lg">
            <span className="text-xs text-on-surface-variant px-1 font-semibold">Changer :</span>
            {[1, 2, 3, 4, 5, 6, 7].map((num) => (
              <button
                key={num}
                onClick={() => setGuichetNum(num)}
                className={`w-7 h-7 rounded text-xs font-bold transition-all ${
                  guichetNum === num
                    ? "bg-primary text-on-primary shadow-xs"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                {num}
              </button>
            ))}
          </div>

          <div className="hidden sm:flex items-center gap-2 bg-surface-container px-space-md py-space-xs rounded-lg text-on-surface-variant font-label-caption text-label-caption">
            <span className="material-symbols-outlined text-[16px] text-secondary">encrypted</span>
            <span>Poste G{guichetNum}-SEC</span>
          </div>

          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`flex items-center gap-1.5 px-space-md py-2 rounded-lg font-label-caption text-label-caption transition-all font-semibold ${
              isPaused
                ? "bg-secondary text-on-secondary shadow-sm"
                : "bg-surface-container-low hover:bg-surface-container-high text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">coffee</span>
            <span>{isPaused ? "Reprendre" : "Mettre en pause"}</span>
          </button>
        </div>
      </div>

      {/* MAIN OPERATOR COCKPIT: 2 COLUMNS (HERO CALL ZONE + MY LOCAL QUEUE) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg mb-space-xl">
        
        {/* ZONE 1: CLIENT EN COURS HERO CARD (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col gap-space-md text-left">
          <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-md relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-secondary"></div>

            {/* Top metadata of ongoing student */}
            <div className="flex flex-wrap items-start justify-between gap-space-md mb-space-lg">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-label-caption text-label-caption uppercase tracking-wider text-secondary font-bold">
                    Dossier en traitement
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                  <span className="font-label-caption text-label-caption text-on-surface-variant">
                    Attribution Guichet {guichetNum}
                  </span>
                </div>

                <div className="flex items-baseline gap-space-md my-1">
                  <span className="font-display-ticket-wall text-display-ticket-wall text-on-surface tracking-tight font-extrabold">
                    {activeTicket ? activeTicket.numero : "— Aucun —"}
                  </span>
                  {activeTicket && (
                    <span className="inline-flex items-center px-3 py-1 rounded-lg bg-surface-container-high text-secondary font-label-ticket-mono text-label-ticket-mono font-bold">
                      {activeTicket.type_label || activeTicket.type}
                    </span>
                  )}
                </div>

                <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  {activeTicket ? activeTicket.service_label : "Aucun étudiant actuellement au guichet"}
                </span>
              </div>

              {/* Dynamic Consultation Timer */}
              <div className="bg-surface-container-low px-space-lg py-space-md rounded-xl flex flex-col items-end shadow-sm">
                <span className="font-label-caption text-label-caption text-on-surface-variant uppercase tracking-wider font-semibold">
                  Durée d'entretien
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      activeTicket ? "bg-error animate-ping" : "bg-outline"
                    }`}
                  ></span>
                  <span className="font-display-ticket-mobile text-display-ticket-mobile text-on-surface font-extrabold font-mono tracking-normal">
                    {activeTicket ? formatTimer(sessionSeconds) : "00:00"}
                  </span>
                </div>
                <span className="font-label-caption text-label-caption text-on-surface-variant mt-1">
                  Statut : {activeTicket ? "En cours" : "Libre"}
                </span>
              </div>
            </div>

            {/* Student summary / Dossier Snapshot */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm bg-surface-container-low p-space-md rounded-lg mb-space-lg">
              <div className="flex flex-col">
                <span className="font-label-caption text-label-caption text-on-surface-variant">Matricule Dossier</span>
                <span className="font-body-md text-body-md font-semibold text-on-surface">
                  {activeTicket ? `SC-${activeTicket.numero}-2026` : "—"}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-caption text-label-caption text-on-surface-variant">Filière concernée</span>
                <span className="font-body-md text-body-md font-semibold text-on-surface">
                  {activeTicket ? activeTicket.type_label : "—"}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-caption text-label-caption text-on-surface-variant">Pièces jointes</span>
                <span className="font-body-md text-body-md font-semibold text-on-tertiary-container flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  {activeTicket ? "Conformes (Vérifiées)" : "En attente"}
                </span>
              </div>
            </div>

            {/* ACTION BAR / DISPOSITION BUTTONS */}
            <div className="flex flex-col gap-space-md">
              <div className="flex items-center justify-between">
                <span className="font-label-caption text-label-caption uppercase tracking-wider text-on-surface-variant font-semibold">
                  Clôturer ou Réorienter le client en cours :
                </span>
                <button
                  onClick={handleRecall}
                  disabled={!activeTicket}
                  className="flex items-center gap-1.5 text-secondary hover:text-on-secondary-container font-label-caption text-label-caption font-semibold px-2.5 py-1 rounded bg-secondary-fixed/50 hover:bg-secondary-fixed transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[16px]">campaign</span>
                  Rappeler le client (Bip sonore)
                </button>
              </div>

              {/* The 3 Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm">
                {/* 1. Terminer visite */}
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
                    <span className="font-headline-sm text-headline-sm font-bold">Visite terminée</span>
                  </div>
                  <span className="font-label-caption text-label-caption text-primary-fixed-dim">
                    Dossier finalisé &amp; clos
                  </span>
                </button>

                {/* 2. Réorienter Numérique */}
                <button
                  onClick={() =>
                    handleCloture(
                      "service_numerique",
                      "Réorientation Numérique",
                      `Le ticket ${activeTicket?.numero} repart en file avec le service "Service Numérique".`
                    )
                  }
                  disabled={!activeTicket}
                  className="flex flex-col items-center justify-center p-space-md rounded-xl bg-secondary text-on-secondary hover:bg-on-secondary-container transition-all shadow-sm group text-center disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-[22px] group-hover:rotate-45 transition-transform">
                      devices
                    </span>
                    <span className="font-headline-sm text-headline-sm font-bold">Pôle Numérique</span>
                  </div>
                  <span className="font-label-caption text-label-caption text-secondary-fixed">
                    Réinjecter (Moins chargé)
                  </span>
                </button>

                {/* 3. Réorienter Paiement / AVP */}
                <button
                  onClick={() =>
                    handleCloture(
                      "avp_paiement",
                      "Réorientation Paiement",
                      `Le ticket ${activeTicket?.numero} repart vers le guichet de paiement.`
                    )
                  }
                  disabled={!activeTicket}
                  className="flex flex-col items-center justify-center p-space-md rounded-xl bg-primary-container text-on-primary hover:bg-primary transition-all shadow-sm group text-center disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-[22px] text-secondary-fixed-dim group-hover:scale-110 transition-transform">
                      payments
                    </span>
                    <span className="font-headline-sm text-headline-sm font-bold">Paiement / AVP</span>
                  </div>
                  <span className="font-label-caption text-label-caption text-on-primary-container">
                    Vers Guichet Encaissement
                  </span>
                </button>
              </div>

              {/* Call Next Button with constraint notice */}
              <div className="pt-space-md flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-space-md">
                <div className="flex items-center gap-2 px-space-md py-space-xs bg-surface-container rounded-lg flex-1">
                  <span className="material-symbols-outlined text-outline text-[18px] flex-shrink-0">info</span>
                  <span className="font-label-caption text-label-caption text-on-surface-variant">
                    {activeTicket
                      ? "Bouton désactivé : veuillez d'abord clôturer le client actuel avant d'appeler le suivant."
                      : "Prêt : cliquez sur 'Client suivant' pour appeler le prochain ticket de votre file."}
                  </span>
                </div>

                <button
                  onClick={handleClientSuivant}
                  disabled={Boolean(activeTicket)}
                  className={`flex items-center justify-center gap-2 px-space-xl py-3 rounded-xl font-headline-sm text-headline-sm font-bold transition-all ${
                    activeTicket
                      ? "bg-surface-container-high text-on-surface-variant cursor-not-allowed opacity-60"
                      : "bg-primary text-on-primary hover:bg-primary-container shadow-md cursor-pointer"
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">person_add</span>
                  <span>Client suivant</span>
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* ZONE 2: MA PROPRE FILE D'ATTENTE (GUICHET N) (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col text-left">
          <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col h-full justify-between">
            <div>
              <div className="flex items-center justify-between pb-space-md mb-space-md border-b border-surface-container-high/60">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">queue</span>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                    File Guichet {guichetNum}
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-counter-badge text-label-counter-badge font-bold">
                  {localQueue.length} étudiant{localQueue.length > 1 ? "s" : ""}
                </span>
              </div>

              {/* Ticket stack for this Guichet */}
              <div className="flex flex-col gap-space-sm max-h-[420px] overflow-y-auto pr-1">
                {localQueue.length === 0 ? (
                  <div className="p-space-lg text-center text-on-surface-variant font-label-caption text-label-caption bg-surface-container-low rounded-xl">
                    Aucun étudiant en attente spécifique pour ce guichet.
                  </div>
                ) : (
                  localQueue.map((t, idx) => (
                    <div
                      key={t.id || idx}
                      className="p-space-md rounded-xl bg-surface-container-low hover:bg-surface-container transition-all flex items-center justify-between"
                    >
                      <div className="flex items-center gap-space-md">
                        <span className="w-7 h-7 rounded-full bg-surface-container-high flex items-center justify-center font-label-counter-badge text-label-counter-badge text-on-surface font-bold">
                          {idx + 1}
                        </span>
                        <div className="flex flex-col">
                          <span className="font-headline-sm text-headline-sm text-on-surface font-extrabold">
                            {t.numero}
                          </span>
                          <span className="font-label-caption text-label-caption text-on-surface-variant truncate max-w-[140px]">
                            {t.service_label || t.service}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end">
                        <span className="font-label-caption text-label-caption text-on-surface-variant">Attente</span>
                        <span className="font-body-sm text-body-sm font-semibold text-secondary">
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
              <span className="material-symbols-outlined text-[16px] text-secondary">alt_route</span>
              <span className="font-label-caption text-label-caption text-on-surface-variant">
                Routage dynamique : équilibrage automatique de la charge parmi les 7 guichets.
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ZONE 3: VUE GLOBALE DES 7 GUICHETS EN TEMPS RÉEL */}
      <div className="w-full bg-surface-container-lowest rounded-xl p-space-lg md:p-space-xl shadow-sm mb-space-xl text-left">
        <div className="flex flex-wrap items-center justify-between gap-space-md mb-space-lg">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">grid_view</span>
              <span className="font-headline-md text-headline-md text-on-surface font-bold">
                File d'attente globale • Panorama des 7 Guichets
              </span>
            </div>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Contrôle de charge et équilibrage automatique en direct
            </span>
          </div>

          <div className="flex items-center gap-space-sm">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-caption text-label-caption font-semibold">
              <span className="w-2 h-2 rounded-full bg-on-tertiary-container"></span>
              7/7 Guichets Opérationnels
            </span>
            <span className="text-on-surface-variant font-label-caption text-label-caption">
              Total usagers en attente : <strong className="text-on-surface font-bold">{totalGlobalWait}</strong>
            </span>
          </div>
        </div>

        {/* 7 Guichets Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-space-sm">
          {[1, 2, 3, 4, 5, 6, 7].map((num) => {
            const g = allGuichets.find((item) => item.numero === num);
            const isCurrent = num === guichetNum;
            const currentTicketNum = g?.ticket_en_cours ? g.ticket_en_cours.numero : "—";
            const waitCount = g?.file_attente?.length || 0;

            return (
              <div
                key={num}
                onClick={() => setGuichetNum(num)}
                className={`rounded-xl p-space-md flex flex-col justify-between cursor-pointer transition-all ${
                  isCurrent
                    ? "bg-surface-container-lowest shadow-md ring-2 ring-secondary relative overflow-hidden"
                    : "bg-surface-container-low hover:bg-surface-container"
                }`}
              >
                {isCurrent && <div className="absolute top-0 left-0 right-0 h-1 bg-secondary"></div>}

                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`font-label-counter-badge text-label-counter-badge font-bold ${
                      isCurrent ? "text-secondary" : "text-on-surface"
                    }`}
                  >
                    G-0{num} {isCurrent && "(Vous)"}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      g?.ticket_en_cours ? "bg-on-tertiary-container animate-pulse" : "bg-outline"
                    }`}
                  ></span>
                </div>

                <div className="my-space-xs">
                  <span
                    className={`font-label-ticket-mono text-label-ticket-mono font-extrabold ${
                      isCurrent ? "text-secondary" : "text-on-surface"
                    }`}
                  >
                    {currentTicketNum}
                  </span>
                </div>

                <div className="pt-space-xs flex items-center justify-between">
                  <span className="font-label-caption text-label-caption text-on-surface-variant">En attente</span>
                  <span
                    className={`font-label-counter-badge text-label-counter-badge font-bold px-2 py-0.5 rounded ${
                      waitCount > 0 ? "bg-surface-container-high text-on-surface" : "bg-surface-container text-outline"
                    }`}
                  >
                    {waitCount}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ZONE 4: STATISTIQUES GUICHET & GLOBALES */}
      <div className="w-full bg-surface-container-lowest rounded-xl p-space-lg md:p-space-xl shadow-sm text-left">
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
            {/* Scope Switcher */}
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
                Tous les 7 guichets
              </button>
            </div>

            {/* Period Switcher */}
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
          {/* Metric 1 */}
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

          {/* Metric 2 */}
          <div className="bg-surface-container-low p-space-lg rounded-xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-on-surface-variant mb-space-sm">
              <span className="font-label-caption text-label-caption uppercase font-semibold">Temps moyen entretien</span>
              <span className="material-symbols-outlined text-secondary text-[20px]">timer</span>
            </div>
            <span className="font-display-ticket-mobile text-display-ticket-mobile text-on-surface font-extrabold">
              5m 20s
            </span>
            <span className="font-label-caption text-label-caption text-on-tertiary-container font-medium mt-1">
              Objectif scolarité : &lt; 8 min (Conforme)
            </span>
          </div>

          {/* Metric 3 */}
          <div className="bg-surface-container-low p-space-lg rounded-xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-on-surface-variant mb-space-sm">
              <span className="font-label-caption text-label-caption uppercase font-semibold">Taux réorientation</span>
              <span className="material-symbols-outlined text-secondary text-[20px]">alt_route</span>
            </div>
            <span className="font-display-ticket-mobile text-display-ticket-mobile text-on-surface font-extrabold">
              12%
            </span>
            <span className="font-label-caption text-label-caption text-on-surface-variant mt-1">
              Réaffectations Pôle Numérique / AVP
            </span>
          </div>

          {/* Metric 4 */}
          <div className="bg-surface-container-low p-space-lg rounded-xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-on-surface-variant mb-space-sm">
              <span className="font-label-caption text-label-caption uppercase font-semibold">Satisfaction Usager</span>
              <span className="material-symbols-outlined text-tertiary-fixed-dim text-[20px]">thumb_up</span>
            </div>
            <span className="font-display-ticket-mobile text-display-ticket-mobile text-on-surface font-extrabold">
              98%
            </span>
            <span className="font-label-caption text-label-caption text-on-tertiary-container font-medium mt-1">
              Sur avis borne de sortie scolarité
            </span>
          </div>
        </div>

        {/* Hourly distribution bar chart */}
        <div className="bg-surface-container-low p-space-lg rounded-xl flex flex-col gap-space-md">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                Affluence &amp; Volume horaire (Journée en cours)
              </span>
              <p className="font-label-caption text-label-caption text-on-surface-variant">
                Nombre d'usagers accueillis par créneau horaire
              </p>
            </div>
            <div className="flex items-center gap-space-md text-on-surface-variant font-label-caption text-label-caption">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-primary"></span> Mon Guichet (G{guichetNum})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-secondary-fixed-dim"></span> Moyenne 7 guichets
              </span>
            </div>
          </div>

          <div className="w-full h-44 flex items-end justify-between gap-2 pt-space-lg px-2">
            {[
              { hour: "08h", val1: 20, val2: 15 },
              { hour: "09h", val1: 45, val2: 40 },
              { hour: "10h", val1: 70, val2: 65 },
              { hour: "11h", val1: 85, val2: 80, isPeak: true },
              { hour: "12h", val1: 30, val2: 25 },
              { hour: "13h", val1: 35, val2: 30 },
              { hour: "14h", val1: 60, val2: 55, isCurrent: true },
              { hour: "15h", val1: 10, val2: 10, isFuture: true },
              { hour: "16h", val1: 5, val2: 5, isFuture: true }
            ].map((slot) => (
              <div
                key={slot.hour}
                className={`flex-1 flex flex-col items-center gap-2 h-full justify-end ${
                  slot.isFuture ? "opacity-40" : ""
                }`}
              >
                <div
                  className="w-full max-w-[28px] bg-secondary-fixed-dim rounded-t-sm"
                  style={{ height: `${slot.val1}%` }}
                ></div>
                <div
                  className="w-full max-w-[28px] bg-primary rounded-t-sm -mt-1"
                  style={{ height: `${slot.val2}%` }}
                ></div>
                <span
                  className={`font-label-caption text-label-caption ${
                    slot.isCurrent
                      ? "text-secondary font-extrabold"
                      : slot.isPeak
                      ? "text-on-surface font-bold"
                      : "text-on-surface-variant"
                  }`}
                >
                  {slot.hour}
                  {slot.isCurrent ? "*" : ""}
                </span>
              </div>
            ))}
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
