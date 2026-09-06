import React, { useState, useEffect, useCallback, useRef } from "react";
import QRCode from "qrcode";
import { getAffichage, getConfig, setConfigTunnel } from "../api";

const MAX_TIME = 30;
const CIRCUMFERENCE = 263.89;

function generateToken() {
  return "#TK-" + Math.floor(1000 + Math.random() * 9000);
}

// Fallback URL built from current browser location
function fallbackMobileUrl() {
  const h = window.location.hostname;
  const p = window.location.port || "3001";
  return `http://${h}:${p}/#/mobile`;
}

export default function Kiosk() {
  const canvasRef = useRef(null);

  // Timer & dynamic token
  const [timeLeft, setTimeLeft] = useState(MAX_TIME);
  const [tokenCode, setTokenCode] = useState(generateToken);
  const [scanCount, setScanCount] = useState(0);

  // Public URL configuration for 3G / 5G / All networks
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState("");

  // Mobile URL — fetched from backend (tunnel URL prioritized) or localStorage
  const [mobileUrl, setMobileUrl] = useState(() => {
    return localStorage.getItem("custom_mobile_url") || fallbackMobileUrl();
  });

  // Live stats from backend
  const [stats, setStats] = useState({
    totalAttente: 0,
    prochainMaster: "M-????",
    prochainBachelier: "B-????",
  });

  // Fetch config from backend to get tunnel or LAN URL
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const savedCustom = localStorage.getItem("custom_mobile_url");
        if (savedCustom) {
          setMobileUrl(savedCustom);
          return;
        }
        const cfg = await getConfig();
        const url = cfg.mobile_tunnel || cfg.mobile_lan || fallbackMobileUrl();
        setMobileUrl(url);
      } catch (_) { }
    };
    fetchConfig();
    const iv = setInterval(fetchConfig, 15000);
    return () => clearInterval(iv);
  }, []);

  // Draw QR code on canvas whenever URL changes
  const drawQR = useCallback(async (url) => {
    if (!canvasRef.current) return;
    try {
      await QRCode.toCanvas(canvasRef.current, url, {
        width: 320,
        margin: 2,
        color: { dark: "#00204d", light: "#ffffff" },
        errorCorrectionLevel: "M",
      });
    } catch (err) {
      console.error("QR generation error:", err);
    }
  }, []);

  useEffect(() => {
    drawQR(mobileUrl);
  }, [drawQR, mobileUrl]);


  // Token countdown
  const rotateToken = useCallback(() => {
    setTokenCode(generateToken());
    setTimeLeft(MAX_TIME);
    setScanCount((c) => c + 1);
    drawQR(mobileUrl);
  }, [drawQR, mobileUrl]);

  useEffect(() => {
    const t = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { rotateToken(); return MAX_TIME; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [rotateToken]);

  // Fetch live stats
  const refreshStats = useCallback(async () => {
    try {
      const data = await getAffichage();
      const mq = data?.par_statut?.master || [];
      const bq = data?.par_statut?.bachelier || [];
      setStats({
        totalAttente: data?.total_attente ?? 0,
        prochainMaster: mq[0]?.numero ?? "—",
        prochainBachelier: bq[0]?.numero ?? "—",
      });
    } catch (_) { }
  }, []);

  useEffect(() => {
    refreshStats();
    const iv = setInterval(refreshStats, 4000);
    return () => clearInterval(iv);
  }, [refreshStats]);

  const progressRatio = timeLeft / MAX_TIME;
  const strokeOffset = CIRCUMFERENCE - progressRatio * CIRCUMFERENCE;
  const validityPct = Math.round(progressRatio * 100);
  const formattedTime = `00:${timeLeft < 10 ? "0" + timeLeft : timeLeft}`;

  return (
    <div className="w-full pt-20 bg-background min-h-screen">
      {/* Ambient glows */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[380px] bg-primary-fixed blur-[130px] opacity-40 rounded-full pointer-events-none -z-10" />
      <div className="absolute top-80 right-0 w-96 h-96 bg-secondary-fixed blur-[140px] opacity-30 rounded-full pointer-events-none -z-10" />

      <div className="max-w-[90rem] mx-auto px-gutter-mobile md:px-gutter-desktop pt-space-md pb-space-3xl flex flex-col gap-space-xl">

        {/* ── Top strip ─────────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-space-md">
          <div className="flex flex-col gap-space-xs max-w-2xl">
            <div className="inline-flex items-center gap-space-xs px-space-sm py-space-2xs rounded-full bg-primary-fixed text-on-primary-fixed w-fit shadow-sm">
              <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
              <span className="font-label-sm text-label-sm uppercase tracking-wider font-bold">
                Borne d'Enregistrement Rapide — UIR
              </span>
            </div>
            <h1 className="font-display text-headline-lg md:text-display text-on-surface tracking-tight leading-tight">
              Scannez pour obtenir{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-container to-secondary">
                votre ticket UIR
              </span>
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
              Pointez l'appareil photo de votre smartphone vers le QR code.
              Le code se régénère toutes les 30 secondes pour sécuriser chaque ticket.
            </p>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-bold">
                URL de scan :
              </span>
              <code className="lowercase tracking-normal bg-surface-container px-2 py-0.5 rounded font-mono text-xs text-on-surface">
                {mobileUrl}
              </code>
              <button
                onClick={() => {
                  setCustomUrlInput(mobileUrl);
                  setShowUrlModal(true);
                }}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1 bg-primary-fixed px-2 py-0.5 rounded-full"
              >
                <span className="material-symbols-outlined text-[14px]">public</span>
                Changer URL (3G/5G/Render)
              </button>
              <a
                href="#/mobile"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-secondary hover:underline flex items-center gap-0.5"
              >
                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                Tester sur ce PC
              </a>
            </div>
          </div>

          {/* Metric counters */}
          <div className="flex items-center gap-space-sm bg-surface-container-low p-space-xs rounded-xl shadow-sm">
            <div className="px-space-md py-space-xs bg-surface-container-lowest rounded-lg shadow-sm text-left">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase block font-semibold">Flux actuel</span>
              <span className="font-headline-sm text-headline-sm text-primary flex items-center gap-1 font-bold">
                <span className="material-symbols-outlined text-secondary text-[20px]">groups</span>
                {stats.totalAttente} en file
              </span>
            </div>
            <div className="px-space-md py-space-xs bg-surface-container-lowest rounded-lg shadow-sm text-left">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase block font-semibold">Postes Déployés</span>
              <span className="font-headline-sm text-headline-sm text-tertiary-container flex items-center gap-1 font-bold">
                <span className="material-symbols-outlined text-[20px]">desk</span>
                16 Postes (4 Pôles)
              </span>
            </div>
          </div>
        </div>

        {/* Modal Configuration URL Publique */}
        {showUrlModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl text-left">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-lg text-[#00204d] flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">settings_ethernet</span>
                  Configurer l'URL de Scan
                </h3>
                <button
                  onClick={() => setShowUrlModal(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                Pour que les étudiants puissent scanner depuis <strong>n'importe quel réseau (3G, 4G, 5G ou Wi-Fi externe)</strong>, entrez votre URL publique (ex: l'URL Render ou votre tunnel).
              </p>

              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    URL Publique (ex: https://gestion-patientes.onrender.com)
                  </label>
                  <input
                    type="url"
                    value={customUrlInput}
                    onChange={(e) => setCustomUrlInput(e.target.value)}
                    placeholder="https://votre-app.onrender.com"
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-sm font-mono"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const url = fallbackMobileUrl();
                      setCustomUrlInput(url);
                    }}
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg font-semibold"
                  >
                    Réseau Local (Wi-Fi)
                  </button>
                  <button
                    onClick={() => {
                      localStorage.removeItem("custom_mobile_url");
                      window.location.reload();
                    }}
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg font-semibold"
                  >
                    Auto-détection
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowUrlModal(false)}
                  className="px-4 py-2 rounded-lg text-slate-600 font-semibold text-sm hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  onClick={async () => {
                    let finalUrl = customUrlInput.trim();
                    if (finalUrl && !finalUrl.includes("/#/mobile")) {
                      finalUrl = `${finalUrl.replace(/\/$/, "")}/#/mobile`;
                    }
                    localStorage.setItem("custom_mobile_url", finalUrl);
                    setMobileUrl(finalUrl);
                    drawQR(finalUrl);
                    try {
                      await setConfigTunnel(finalUrl.replace("/#/mobile", ""));
                    } catch (_) {}
                    setShowUrlModal(false);
                  }}
                  className="px-5 py-2 bg-[#00204d] text-white rounded-lg font-bold text-sm shadow hover:bg-blue-900"
                >
                  Enregistrer &amp; Actualiser QR
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Main showcase ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-stretch">

          {/* LEFT ─ QR terminal (7 cols on lg+) */}
          <div className="lg:col-span-7 bg-surface-container-lowest rounded-2xl p-space-lg md:p-space-xl shadow-[0_20px_60px_-15px_rgba(0,32,77,0.18)] relative overflow-hidden flex flex-col justify-between">
            {/* gradient top bar */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-primary-container via-secondary-container to-tertiary-fixed rounded-t-2xl" />
            {/* corner glow */}
            <div className="absolute -top-16 -right-16 w-48 h-48 bg-secondary-container/20 rounded-full blur-2xl pointer-events-none" />

            {/* Card header */}
            <div className="flex items-center justify-between gap-space-sm mb-space-lg">
              <span className="px-space-sm py-space-2xs bg-secondary-fixed text-on-secondary-fixed rounded-full font-label-md text-label-md flex items-center gap-1.5 font-semibold shadow-sm">
                <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                Actif · Prêt à scanner
              </span>
              <div className="flex items-center gap-space-2xs bg-surface-container-low px-space-sm py-space-2xs rounded-lg text-on-surface-variant font-label-md text-label-md">
                <span className="material-symbols-outlined text-[16px] text-primary">verified</span>
                <span>Jeton : <strong className="text-on-surface font-semibold">{tokenCode}</strong></span>
              </div>
            </div>

            {/* ── Giant QR code ── */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-space-xl my-space-md">
              <div className="relative group">
                {/* Corner reticles */}
                <span className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg pointer-events-none z-10" />
                <span className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg pointer-events-none z-10" />
                <span className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg pointer-events-none z-10" />
                <span className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg pointer-events-none z-10" />

                {/* Laser scan line */}
                <div className="absolute inset-x-4 h-1 bg-gradient-to-r from-transparent via-secondary-container to-transparent blur-[1px] opacity-90 animate-laser pointer-events-none z-10" />

                {/* White bg frame around canvas */}
                <div className="bg-white p-3 rounded-2xl shadow-[0_12px_40px_rgba(0,32,77,0.15)] border border-surface-container-high/30">
                  <canvas
                    ref={canvasRef}
                    className="block rounded-lg"
                    style={{ width: 280, height: 280 }}
                    width={320}
                    height={320}
                  />
                </div>

                {/* Center UIR badge */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-14 h-14 bg-white rounded-xl shadow-lg border border-surface-container-high/40 flex items-center justify-center overflow-hidden">
                    <img
                      src="/logo.png"
                      alt="UIR Logo"
                      className="w-11 h-11 object-contain"
                    />
                  </div>
                </div>
              </div>

              {/* Countdown & next tickets */}
              <div className="flex flex-col items-center md:items-start gap-space-md text-center md:text-left">
                <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider font-semibold">
                  Renouvellement dans
                </span>

                <div className="flex items-center gap-space-md">
                  {/* Donut */}
                  <div className="relative w-24 h-24">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" fill="none" r="42" stroke="currentColor" strokeWidth="8" className="text-surface-container-high" />
                      <circle
                        cx="50" cy="50" fill="none" r="42" stroke="currentColor"
                        strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={CIRCUMFERENCE}
                        strokeDashoffset={strokeOffset}
                        className="text-primary transition-all duration-1000 ease-linear"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-headline-sm text-headline-sm text-on-surface font-bold">{formattedTime}</span>
                      <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-semibold">SEC</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">Prochain estimé :</span>
                    <div className="flex items-center gap-space-xs">
                      <span className="px-space-xs py-0.5 rounded bg-primary-container text-on-primary font-headline-sm text-headline-sm tracking-tight shadow-sm">
                        {stats.prochainMaster}
                      </span>
                      <span className="text-outline-variant font-bold">/</span>
                      <span className="px-space-xs py-0.5 rounded bg-secondary-container text-on-secondary-fixed font-headline-sm text-headline-sm tracking-tight shadow-sm">
                        {stats.prochainBachelier}
                      </span>
                    </div>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">Master &amp; Bachelier</span>
                  </div>
                </div>

                {/* Validity bar */}
                <div className="w-full flex flex-col gap-1 pt-space-xs min-w-[200px]">
                  <div className="flex items-center justify-between text-xs text-on-surface-variant font-label-sm">
                    <span>Validité du jeton</span>
                    <span className="text-primary font-bold">{validityPct}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-surface-container-high rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary via-primary-container to-secondary-container rounded-full transition-all duration-1000 ease-linear"
                      style={{ width: `${validityPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom instruction bar */}
            <div className="mt-space-md flex items-center gap-space-sm p-space-sm bg-surface-container-low rounded-xl">
              <div className="w-10 h-10 rounded-lg bg-surface-container-lowest text-primary flex items-center justify-center shrink-0 shadow-sm">
                <span className="material-symbols-outlined text-[24px]">center_focus_strong</span>
              </div>
              <p className="font-label-lg text-label-lg text-on-surface text-left">
                Pointez la caméra de votre smartphone sans application.
                <span className="font-body-sm text-body-sm text-on-surface-variant block">
                  Fonctionne avec iOS &amp; Android. Restez sur le même réseau Wi-Fi que le campus.
                </span>
              </p>
            </div>
          </div>

          {/* RIGHT ─ How-to + live status (5 cols on lg+) */}
          <div className="lg:col-span-5 flex flex-col gap-space-md">

            {/* Steps */}
            <div className="p-space-lg bg-surface-container-lowest rounded-2xl shadow-sm flex flex-col gap-space-sm">
              <div className="flex items-center justify-between">
                <span className="font-headline-sm text-headline-sm text-on-surface font-bold">Comment ça marche ?</span>
                <span className="px-space-xs py-1 rounded bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm uppercase font-bold">Instantané</span>
              </div>

              {[
                { step: 1, color: "bg-primary", icon: "photo_camera", text: "Scannez le QR code", sub: "Aucune app nécessaire — caméra standard iOS/Android." },
                { step: 2, color: "bg-secondary", icon: "badge", text: "Choisissez votre service", sub: "Rendez-vous · AVP/Master · Bachelier · Autres." },
                { step: 3, color: "bg-tertiary-container", icon: "picture_as_pdf", text: "Recevez votre ticket PDF", sub: "Un ticket UIR avec numéro &amp; guichet, prêt à imprimer." },
              ].map(({ step, color, icon, text, sub }) => (
                <div key={step} className="p-space-md bg-surface-container-low rounded-xl flex items-start gap-space-md hover:bg-surface-container-high transition-colors">
                  <div className={`w-10 h-10 rounded-xl ${color} text-on-primary font-bold font-headline-sm text-headline-sm flex items-center justify-center shrink-0 shadow-sm`}>
                    {step}
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0 text-left">
                    <span className="font-label-lg text-label-lg text-on-surface font-semibold">{text}</span>
                    <p className="font-body-sm text-body-sm text-on-surface-variant leading-snug" dangerouslySetInnerHTML={{ __html: sub }} />
                  </div>
                  <span className="material-symbols-outlined text-[22px] ml-auto shrink-0 text-primary">{icon}</span>
                </div>
              ))}
            </div>

            {/* Live status card */}
            <div className="relative rounded-2xl overflow-hidden bg-primary text-on-primary p-space-lg shadow-md flex flex-col justify-between min-h-[160px]">
              <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-secondary/15 blur-xl pointer-events-none" />
              <div className="flex items-center justify-between z-10">
                <div className="text-left">
                  <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary-fixed-dim font-semibold block">
                    UIR Campus Central — Hall A
                  </span>
                  <span className="font-headline-sm text-headline-sm font-bold block">Hall des Inscriptions</span>
                </div>
                <div className="px-space-sm py-1 bg-surface-container-lowest/20 backdrop-blur-md rounded-full text-xs font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-tertiary-fixed animate-ping" />
                  Direct
                </div>
              </div>
              <div className="flex items-center justify-between text-on-primary-container z-10 pt-space-md font-label-caption text-xs">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-secondary-fixed">wifi</span>
                  Réseau : UIR_Campus_WiFi
                </span>
                <span>Scans session : {scanCount}</span>
              </div>
            </div>

            {/* Accessibility row */}
            <div className="w-full bg-surface-container-lowest rounded-xl p-space-sm shadow-sm flex gap-space-sm">
              <div className="flex-1 flex items-center gap-space-sm bg-surface-container-low rounded-lg px-space-md py-space-sm">
                <span className="material-symbols-outlined text-[22px] text-primary">accessible</span>
                <div className="text-left">
                  <span className="font-label-lg text-label-lg text-on-surface font-bold block">Accès PMR Prioritaire</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Signalez-vous au guichet 1</span>
                </div>
              </div>
              <div className="flex-1 flex items-center gap-space-sm bg-surface-container-low rounded-lg px-space-md py-space-sm">
                <span className="material-symbols-outlined text-[22px] text-secondary">support_agent</span>
                <div className="text-left">
                  <span className="font-label-lg text-label-lg text-on-surface font-bold block">Besoin d'aide ?</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Poste 4200 — Accueil</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
