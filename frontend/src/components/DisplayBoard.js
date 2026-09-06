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
    par_statut: { master: [], bachelier: [] },
    total_attente: 0
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
      // Ignore audio errors if blocked by browser policy
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

  // Prepare map of 7 guichets
  const guichetsMap = {};
  for (let i = 1; i <= 7; i++) {
    guichetsMap[i] = {
      numero: i,
      nom: `Guichet ${i}`,
      ticket: null,
      attenteCount: 0
    };
  }

  // Populate with active tickets
  if (data?.en_cours) {
    data.en_cours.forEach((t) => {
      if (t.guichet && guichetsMap[t.guichet]) {
        guichetsMap[t.guichet].ticket = t;
      }
    });
  }

  // Count waiting per guichet
  if (data?.attente) {
    data.attente.forEach((t) => {
      if (t.guichet && guichetsMap[t.guichet]) {
        guichetsMap[t.guichet].attenteCount += 1;
      }
    });
  }

  // Waiting queues
  const masterQueue = data?.par_statut?.master || [];
  const bachelierQueue = data?.par_statut?.bachelier || [];

  return (
    <main className="w-full pt-20 bg-background max-w-[1440px] mx-auto px-margin-page-mobile lg:px-margin-page-desktop pb-space-2xl">
      <div className="flex flex-col w-full gap-space-lg">
        
        {/* ZONE D'APPEL MAJEURE & HORLOGE DIGITALE */}
        <section className="grid grid-cols-1 xl:grid-cols-12 gap-space-md items-stretch">
          
          {/* Horloge & Identifiant de salle */}
          <div className="xl:col-span-4 bg-primary text-on-primary rounded-xl p-space-md md:p-space-lg shadow-md flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-secondary/15 pointer-events-none blur-xl"></div>
            
            <div className="flex items-center justify-between gap-space-sm z-10">
              <div className="flex items-center gap-space-sm">
                <div className="w-10 h-10 rounded-lg bg-surface-container-lowest text-primary flex items-center justify-center p-1 shadow-sm font-bold">
                  <span className="material-symbols-outlined text-[24px]">school</span>
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-headline-sm text-headline-sm font-bold text-on-primary tracking-tight">
                    Hall Scolarité
                  </span>
                  <span className="font-label-caption text-label-caption text-secondary-fixed-dim">
                    Bâtiment Central — Rez-de-Chaussée
                  </span>
                </div>
              </div>

              <span className="px-space-xs py-1 rounded-full bg-secondary-container text-on-secondary-container font-label-caption text-label-caption font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">schedule</span>
                Affichage Public
              </span>
            </div>

            <div className="mt-space-md mb-space-xs z-10 text-left">
              <p className="font-headline-sm text-headline-sm text-surface-container-high font-medium capitalize">
                {currentDate || "Chargement date..."}
              </p>
              <div className="font-display-ticket-mobile md:font-display-ticket-wall text-display-ticket-mobile md:text-display-ticket-wall text-surface-container-lowest tracking-tight font-black leading-none mt-1 select-none">
                {currentTime || "00:00:00"}
              </div>
            </div>

            <div className="flex items-center justify-between text-on-primary-container z-10 pt-space-xs">
              <span className="font-label-caption text-label-caption flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-secondary-fixed">wifi</span>
                Synchronisé avec le serveur central
              </span>
              <span className="font-label-caption text-label-caption text-surface-container-highest">
                Moniteur 01-HALL
              </span>
            </div>
          </div>

          {/* Bannière Dernier Appel (Flash Grand Format) */}
          <div className="xl:col-span-8 bg-surface-container-lowest rounded-xl p-space-md md:p-space-lg shadow-md flex flex-col md:flex-row items-center justify-between gap-space-md relative overflow-hidden">
            {/* Indicateur d'appel sonore */}
            <div className="flex items-center gap-space-md w-full md:w-auto text-left">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                <span className="material-symbols-outlined text-[36px] md:text-[44px]">notifications_active</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-space-xs">
                  <span className="font-label-counter-badge text-label-counter-badge uppercase tracking-wider text-secondary font-bold">
                    Dernier Appel en cours
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-surface-container font-label-caption text-label-caption text-on-surface-variant font-semibold">
                    En direct
                  </span>
                </div>
                <p className="font-headline-md text-headline-md text-on-surface font-extrabold mt-0.5">
                  L'étudiant portant le ticket suivant est prié de se présenter :
                </p>
              </div>
            </div>

            {/* Ticket & Cible Guichet */}
            <div className="flex items-center gap-space-md bg-surface-container-low px-space-lg py-space-sm rounded-xl w-full md:w-auto justify-center shadow-inner">
              <div className="flex flex-col text-center">
                <span className="font-label-caption text-label-caption text-on-surface-variant uppercase font-semibold tracking-wide">
                  Numéro Ticket
                </span>
                <span className="font-display-ticket-mobile text-display-ticket-mobile font-black text-secondary tracking-tight">
                  {lastCalled ? lastCalled.numero : "—"}
                </span>
              </div>

              <div className="flex items-center justify-center text-outline-variant px-space-xs">
                <span className="material-symbols-outlined text-[32px] text-secondary">arrow_forward</span>
              </div>

              <div className="flex flex-col text-center">
                <span className="font-label-caption text-label-caption text-on-surface-variant uppercase font-semibold tracking-wide">
                  Destination
                </span>
                <div className="px-space-md py-1 bg-primary text-on-primary rounded-lg font-headline-md text-headline-md font-extrabold tracking-tight">
                  {lastCalled ? `GUICHET ${lastCalled.guichet}` : "EN ATTENTE"}
                </div>
              </div>
            </div>
          </div>

        </section>

        {/* GRILLE PRINCIPALE : LES 7 GUICHETS D'ACCUEIL */}
        <section className="flex flex-col gap-space-sm">
          <div className="flex items-center justify-between px-space-xs">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-secondary text-[24px]">view_quilt</span>
              <h2 className="font-headline-md text-headline-md text-on-surface font-bold tracking-tight">
                Statut des 7 Guichets de Scolarité
              </h2>
            </div>
            <div className="flex items-center gap-space-md text-body-sm font-body-sm">
              <span className="flex items-center gap-space-2xs text-on-surface-variant">
                <span className="w-3 h-3 rounded-full bg-on-tertiary-container inline-block"></span>
                7/7 Guichets Opérationnels
              </span>
              <span className="hidden sm:inline text-outline-variant">|</span>
              <span className="hidden sm:inline text-on-surface-variant font-label-caption text-label-caption">
                Actualisation toutes les 3s
              </span>
            </div>
          </div>

          {/* Grille : 7 Cartes Guichet + 1 Carte Statistique */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-space-md">
            {Object.values(guichetsMap).map((g) => {
              const hasTicket = Boolean(g.ticket);
              const isMaster = g.ticket?.type === "master";
              const isLast = lastCalled && lastCalled.guichet === g.numero;

              return (
                <article
                  key={g.numero}
                  className={`rounded-xl p-space-md flex flex-col justify-between transition-all relative overflow-hidden ${
                    isLast
                      ? "bg-gradient-to-br from-surface-container-lowest to-surface-container-low shadow-lg ring-2 ring-secondary"
                      : "bg-surface-container-lowest shadow-sm hover:shadow-md"
                  }`}
                >
                  {isLast && <div className="absolute top-0 left-0 right-0 h-1.5 bg-secondary animate-pulse"></div>}

                  {/* Card Header */}
                  <div className="w-full flex items-center justify-between pb-space-xs">
                    <div className="flex items-center gap-space-xs">
                      <span
                        className={`px-space-xs py-1 rounded font-label-ticket-mono text-label-ticket-mono font-black ${
                          isLast ? "bg-secondary text-on-secondary" : "bg-surface-container text-on-surface"
                        }`}
                      >
                        G-0{g.numero}
                      </span>
                      <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                        GUICHET {g.numero}
                      </span>
                    </div>

                    <span
                      className={`px-space-xs py-1 rounded-full font-label-caption text-label-caption font-bold flex items-center gap-1 ${
                        isLast
                          ? "bg-secondary-container text-on-secondary-container animate-pulse"
                          : hasTicket
                          ? "bg-surface-container-high text-on-tertiary-container"
                          : "bg-surface-container text-on-surface-variant"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          hasTicket ? "bg-on-tertiary-container" : "bg-outline"
                        }`}
                      ></span>
                      {isLast ? "APPEL ACTIF" : hasTicket ? "EN SERVICE" : "DISPONIBLE"}
                    </span>
                  </div>

                  {/* Middle Ticket Box */}
                  <div
                    className={`my-space-sm py-space-sm px-space-md rounded-xl flex flex-col items-center justify-center text-center ${
                      hasTicket
                        ? isMaster
                          ? "bg-primary-container text-on-primary shadow-sm"
                          : "bg-secondary-fixed/40 text-on-surface"
                        : "bg-surface-container text-on-surface-variant"
                    }`}
                  >
                    <span
                      className={`font-label-caption text-label-caption uppercase tracking-wider font-bold ${
                        hasTicket && isMaster ? "text-secondary-fixed" : "text-secondary"
                      }`}
                    >
                      {hasTicket ? (isMaster ? "Master & Doctorat" : "Bachelier / Licence") : "En attente"}
                    </span>

                    <span
                      className={`font-display-ticket-mobile text-display-ticket-mobile font-black tracking-tight ${
                        hasTicket
                          ? isMaster
                            ? "text-surface-bright"
                            : "text-secondary"
                          : "text-outline"
                      }`}
                    >
                      {hasTicket ? g.ticket.numero : "Libre"}
                    </span>
                  </div>

                  {/* Footer metadata */}
                  <div className="flex items-center justify-between pt-space-xs text-on-surface-variant">
                    <div className="flex items-center gap-space-2xs text-left">
                      <span className="material-symbols-outlined text-[18px] text-secondary">
                        {isMaster ? "school" : "credit_card"}
                      </span>
                      <span className="font-body-sm text-body-sm font-medium text-on-surface truncate max-w-[130px]">
                        {hasTicket ? g.ticket.service_label : "Prêt pour appel"}
                      </span>
                    </div>

                    <span className="font-label-caption text-label-caption font-semibold text-secondary">
                      {g.attenteCount} en file
                    </span>
                  </div>
                </article>
              );
            })}

            {/* 8th Card: Supervision Directe */}
            <aside className="bg-primary text-on-primary rounded-xl p-space-md flex flex-col justify-between shadow-sm relative overflow-hidden text-left">
              <div className="flex items-center justify-between">
                <span className="font-label-counter-badge text-label-counter-badge uppercase tracking-wider text-secondary-fixed font-bold">
                  Flux Global Hall
                </span>
                <span className="material-symbols-outlined text-secondary-fixed text-[20px]">speed</span>
              </div>

              <div className="flex flex-col my-space-xs">
                <span className="font-display-ticket-mobile text-display-ticket-mobile font-black text-surface-container-lowest leading-none">
                  {data.total_attente}
                </span>
                <span className="font-body-sm text-body-sm text-surface-container-high mt-1">
                  Étudiants actuellement en file d'attente
                </span>
              </div>

              <div className="bg-surface-container-highest/15 rounded-lg p-space-xs flex items-center justify-between text-on-primary">
                <span className="font-label-caption text-label-caption">Délai moyen d'attente</span>
                <span className="font-label-ticket-mono text-label-ticket-mono text-secondary-fixed-dim">
                  ~ 4 min
                </span>
              </div>
            </aside>
          </div>
        </section>

        {/* SECTION INFÉRIEURE : RÉCAPITULATIF DES FILES D'ATTENTE PAR FILIÈRE */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-space-md">
          
          {/* COLONNE MASTER & DOCTORAT */}
          <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between text-left">
            <div>
              <div className="flex items-center justify-between pb-space-sm border-b border-surface-container-high/60">
                <div className="flex items-center gap-space-sm">
                  <div className="w-10 h-10 rounded-lg bg-primary-container text-surface-bright flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-[24px]">school</span>
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                      File Master &amp; Doctorat
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Orientation automatique vers le guichet le moins chargé
                    </p>
                  </div>
                </div>

                <span className="px-space-sm py-1 rounded-full bg-surface-container text-primary font-label-counter-badge text-label-counter-badge font-bold">
                  {masterQueue.length} personnes
                </span>
              </div>

              <div className="mt-space-md">
                <span className="font-label-caption text-label-caption text-on-surface-variant uppercase font-bold tracking-wider">
                  Prochains tickets appelés
                </span>

                <div className="grid grid-cols-3 gap-space-sm mt-space-xs">
                  {[0, 1, 2].map((idx) => {
                    const ticket = masterQueue[idx];
                    return (
                      <div key={idx} className="bg-surface-container-low p-space-sm rounded-lg text-center">
                        <span className="font-label-caption text-label-caption text-on-surface-variant block font-medium">
                          Rang +{idx + 1}
                        </span>
                        <span className="font-headline-md text-headline-md font-black text-primary">
                          {ticket ? ticket.numero : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-space-sm pt-space-md mt-space-md bg-surface-container-low/50 rounded-lg p-space-sm">
              <span className="material-symbols-outlined text-secondary text-[24px]">hourglass_top</span>
              <div className="flex items-center gap-space-xs">
                <span className="font-label-caption text-label-caption text-on-surface-variant font-medium">
                  Attente moyenne estimée :
                </span>
                <span className="font-headline-sm text-headline-sm font-bold text-secondary">
                  {masterQueue.length > 0 ? `${masterQueue.length * 3} min` : "Immédiate"}
                </span>
              </div>
            </div>
          </div>

          {/* COLONNE BACHELIER & LICENCE */}
          <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between text-left">
            <div>
              <div className="flex items-center justify-between pb-space-sm border-b border-surface-container-high/60">
                <div className="flex items-center gap-space-sm">
                  <div className="w-10 h-10 rounded-lg bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-[24px]">local_library</span>
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                      File Bachelier &amp; Licence
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Orientation automatique vers le guichet le moins chargé
                    </p>
                  </div>
                </div>

                <span className="px-space-sm py-1 rounded-full bg-secondary-fixed/40 text-secondary font-label-counter-badge text-label-counter-badge font-bold">
                  {bachelierQueue.length} personnes
                </span>
              </div>

              <div className="mt-space-md">
                <span className="font-label-caption text-label-caption text-on-surface-variant uppercase font-bold tracking-wider">
                  Prochains tickets appelés
                </span>

                <div className="grid grid-cols-3 gap-space-sm mt-space-xs">
                  {[0, 1, 2].map((idx) => {
                    const ticket = bachelierQueue[idx];
                    return (
                      <div key={idx} className="bg-secondary-fixed/20 p-space-sm rounded-lg text-center">
                        <span className="font-label-caption text-label-caption text-secondary block font-medium">
                          Rang +{idx + 1}
                        </span>
                        <span className="font-headline-md text-headline-md font-black text-secondary">
                          {ticket ? ticket.numero : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-space-sm pt-space-md mt-space-md bg-surface-container-low/50 rounded-lg p-space-sm">
              <span className="material-symbols-outlined text-secondary text-[24px]">timer</span>
              <div className="flex items-center gap-space-xs">
                <span className="font-label-caption text-label-caption text-on-surface-variant font-medium">
                  Attente moyenne estimée :
                </span>
                <span className="font-headline-sm text-headline-sm font-bold text-secondary">
                  {bachelierQueue.length > 0 ? `${bachelierQueue.length * 2.5} min` : "Immédiate"}
                </span>
              </div>
            </div>
          </div>

        </section>

        {/* BANDEAU DÉFILANT D'INFORMATION EN BAS (TICKER PUBLIC) */}
        <section className="w-full bg-primary text-on-primary rounded-xl py-space-sm px-space-md shadow-sm overflow-hidden flex items-center gap-space-md">
          <div className="flex items-center gap-space-xs shrink-0 bg-secondary px-space-sm py-1 rounded font-label-caption text-label-caption font-bold text-on-secondary uppercase tracking-wider">
            <span className="material-symbols-outlined text-[16px]">info</span>
            <span>Information</span>
          </div>

          <div className="relative w-full overflow-hidden whitespace-nowrap">
            <div className="inline-block animate-marquee font-body-md text-body-md font-medium text-surface-container-high tracking-wide">
              Veuillez préparer votre pièce d'identité originale et votre attestation d'inscription provisoire. • Les étudiants munis de tickets prioritaires sont invités à se signaler directement au guichet d'accueil numéro 1. • Borne libre-service disponible près de l'entrée pour les retraits d'attestation de scolarité immédiate. • Un QR code dynamique est à votre disposition à la borne d'entrée pour recevoir votre ticket directement sur votre smartphone.
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
