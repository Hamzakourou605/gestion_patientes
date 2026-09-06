import React, { useState } from "react";
import { creerTicket } from "../api";

// ─── Service definitions for the 4 UIR buttons ──────────────────────────────
const SERVICES = [
  {
    code: "inscription_rdv",
    label: "Inscription avec Rendez-vous",
    desc: "Vous avez un rendez-vous planifié avec un agent de scolarité.",
    icon: "event",
    color: "bg-[#0a2d6b] hover:bg-[#0d3882]",
    textColor: "text-white",
    badgeColor: "bg-[#c9a227]",
    apiService: "inscription_master",
    apiType: "master",
  },
  {
    code: "inscription_avp_master",
    label: "Inscription AVP / Master",
    desc: "Paiement des droits d'inscription ou dossier Master & filières professionnelles.",
    icon: "school",
    color: "bg-[#1d4ed8] hover:bg-[#1e40af]",
    textColor: "text-white",
    badgeColor: "bg-[#93c5fd]",
    apiService: "avp_paiement",
    apiType: "master",
  },
  {
    code: "inscription_bachelier",
    label: "Inscription Bachelier",
    desc: "Inscription ou réinscription pour les licences et 1ère année.",
    icon: "local_library",
    color: "bg-[#0e7490] hover:bg-[#0c6276]",
    textColor: "text-white",
    badgeColor: "bg-[#67e8f9]",
    apiService: "inscription_master",
    apiType: "bachelier",
  },
  {
    code: "autres",
    label: "Autres Demandes",
    desc: "Attestations, relevés de notes, duplicatas de carte, ou toute autre demande.",
    icon: "folder_open",
    color: "bg-[#374151] hover:bg-[#1f2937]",
    textColor: "text-white",
    badgeColor: "bg-[#d1d5db]",
    apiService: "autres",
    apiType: "bachelier",
  },
];

// ─── Ticket PDF print ─────────────────────────────────────────────────────
function printTicket(ticket, serviceMeta) {
  const pad = (n) => String(n).padStart(2, "0");
  const now = new Date();
  const dateStr = now.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Ticket UIR — ${ticket.numero}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', sans-serif;
      background: #f5f7ff;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
      padding: 20px;
    }
    .ticket {
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,32,77,0.12);
      width: 380px;
      max-width: 100%;
      overflow: hidden;
      border: 1.5px solid #e0e7ff;
    }
    .header {
      background: linear-gradient(135deg, #00204d 0%, #0d3882 100%);
      padding: 20px 24px 16px;
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .header img { width: 52px; height: 52px; object-fit: contain; background: white; border-radius: 10px; padding: 4px; }
    .header-text h1 { font-size: 15px; font-weight: 700; color: #fff; }
    .header-text p { font-size: 11px; color: #93c5fd; margin-top: 2px; }
    .stripe { height: 5px; background: linear-gradient(90deg, #c9a227, #e6c440, #c9a227); }
    .body { padding: 24px; }
    .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7280; margin-bottom: 4px; }
    .big-number {
      font-size: 72px;
      font-weight: 900;
      color: #00204d;
      letter-spacing: -0.04em;
      line-height: 1;
      margin-bottom: 16px;
    }
    .desk-badge {
      display: inline-block;
      background: #00204d;
      color: white;
      font-weight: 700;
      font-size: 18px;
      padding: 8px 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      border-top: 1px solid #e5e7eb;
      padding-top: 16px;
      margin-bottom: 16px;
    }
    .detail-item p.detail-label { font-size: 10px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px; }
    .detail-item p.detail-value { font-size: 13px; font-weight: 600; color: #111827; }
    .service-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #eff6ff;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 16px;
      border: 1px solid #bfdbfe;
    }
    .service-badge p { font-size: 13px; font-weight: 600; color: #1d4ed8; }
    .info-box {
      background: #fefce8;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 11px;
      color: #78350f;
      line-height: 1.5;
      margin-bottom: 16px;
    }
    .footer {
      background: #f9fafb;
      border-top: 1px solid #e5e7eb;
      padding: 12px 24px;
      text-align: center;
      font-size: 10px;
      color: #9ca3af;
    }
    .footer strong { color: #374151; }
    @media print {
      body { background: white; padding: 0; }
      .ticket { box-shadow: none; border: 1px solid #e5e7eb; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="header">
      <img src="${window.location.origin}/uir_logo.jpg" alt="UIR Logo"/>
      <div class="header-text">
        <h1>Université Internationale de Rabat</h1>
        <p>Service Scolarité — Accueil des Étudiants</p>
      </div>
    </div>
    <div class="stripe"></div>

    <div class="body">
      <p class="label">Votre numéro d'appel</p>
      <div class="big-number">${ticket.numero}</div>

      <p class="label">Veuillez vous présenter au</p>
      <div class="desk-badge">GUICHET ${ticket.guichet}</div>

      <div class="service-badge">
        <span>&#128196;</span>
        <p>${serviceMeta.label}</p>
      </div>

      <div class="details-grid">
        <div class="detail-item">
          <p class="detail-label">Date</p>
          <p class="detail-value">${dateStr}</p>
        </div>
        <div class="detail-item">
          <p class="detail-label">Heure d'émission</p>
          <p class="detail-value">${timeStr}</p>
        </div>
        <div class="detail-item">
          <p class="detail-label">Filière</p>
          <p class="detail-value">${ticket.type_label || (serviceMeta.apiType === "master" ? "Master" : "Bachelier / Licence")}</p>
        </div>
        <div class="detail-item">
          <p class="detail-label">Statut dossier</p>
          <p class="detail-value">En attente</p>
        </div>
      </div>

      <div class="info-box">
        ⚠️ Veuillez <strong>préparer votre pièce d'identité</strong> et vos documents avant de vous présenter au guichet.<br/>
        Votre numéro sera affiché sur le grand écran du hall dès qu'il sera appelé.
      </div>
    </div>

    <div class="footer">
      UIR — Université Internationale de Rabat · Hall des Inscriptions · Ticket #${ticket.numero}<br/>
      <strong>Ne pas perdre ce ticket. Une seule utilisation.</strong>
    </div>
  </div>

  <script>
    window.addEventListener('load', () => {
      setTimeout(() => window.print(), 500);
    });
  </script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

// ─── Main component ───────────────────────────────────────────────────────
export default function MobileScanView() {
  const [phase, setPhase] = useState("choose"); // "choose" | "loading" | "done"
  const [selectedService, setSelectedService] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState("");

  const handleSelectService = async (svc) => {
    setSelectedService(svc);
    setPhase("loading");
    setError("");
    try {
      const t = await creerTicket(svc.apiType, svc.apiService);
      setTicket(t);
      setPhase("done");
    } catch (err) {
      setError(err?.response?.data?.erreur || "Erreur de connexion au serveur. Réessayez.");
      setPhase("choose");
    }
  };

  const handlePrint = () => {
    if (ticket && selectedService) printTicket(ticket, selectedService);
  };

  const handleReset = () => {
    setPhase("choose");
    setSelectedService(null);
    setTicket(null);
    setError("");
  };

  return (
    <div className="min-h-screen bg-[#f0f4ff] flex flex-col items-center justify-start pt-4 pb-10 px-4">
      {/* ── UIR Header ──────────────────────────────────────── */}
      <div className="w-full max-w-[420px] bg-[#00204d] rounded-2xl shadow-lg overflow-hidden mb-5">
        <div className="flex items-center gap-3 px-5 py-4">
          <img
            src="/uir_logo.jpg"
            alt="Logo UIR"
            className="w-12 h-12 rounded-xl bg-white object-contain p-1 shadow-sm"
          />
          <div className="text-left">
            <h1 className="text-white font-bold text-base tracking-tight">
              Université Internationale de Rabat
            </h1>
            <p className="text-[#93c5fd] text-xs mt-0.5">
              Service Scolarité · Hall des Inscriptions
            </p>
          </div>
        </div>
        <div className="h-1.5 bg-gradient-to-r from-[#c9a227] via-[#e6c440] to-[#c9a227]" />
      </div>

      {/* ── CHOOSE PHASE ────────────────────────────────────── */}
      {phase === "choose" && (
        <div className="w-full max-w-[420px] flex flex-col gap-4">
          <div className="text-center mb-2">
            <span className="inline-block bg-[#dbeafe] text-[#1d4ed8] text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-2">
              Prise de Ticket Sans Contact
            </span>
            <h2 className="text-xl font-black text-[#0a1128] tracking-tight">
              Quelle est votre demande ?
            </h2>
            <p className="text-sm text-[#6b7280] mt-1">
              Sélectionnez votre service pour recevoir un ticket numéroté.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 font-medium">
              {error}
            </div>
          )}

          {SERVICES.map((svc) => (
            <button
              key={svc.code}
              onClick={() => handleSelectService(svc)}
              className={`w-full ${svc.color} ${svc.textColor} rounded-2xl p-5 text-left transition-all duration-200 active:scale-[0.98] shadow-md`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl ${svc.badgeColor}/30 flex items-center justify-center shrink-0`}>
                  <span className="material-symbols-outlined text-[28px]">{svc.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base leading-tight">{svc.label}</p>
                  <p className="text-xs mt-1 opacity-80 leading-snug">{svc.desc}</p>
                </div>
                <span className="material-symbols-outlined text-[22px] mt-1 opacity-70 shrink-0">
                  arrow_forward_ios
                </span>
              </div>
            </button>
          ))}

          <p className="text-center text-[10px] text-[#9ca3af] mt-2">
            UIR · Scolarité Numérique · 2026 · Votre ticket sera imprimable après sélection.
          </p>
        </div>
      )}

      {/* ── LOADING PHASE ───────────────────────────────────── */}
      {phase === "loading" && (
        <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-lg p-10 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#eff6ff] flex items-center justify-center">
            <span className="inline-block w-8 h-8 border-4 border-[#1d4ed8] border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="font-bold text-[#00204d] text-lg">Génération du ticket…</p>
          <p className="text-sm text-[#6b7280] text-center">
            Connexion au serveur UIR Scolarité en cours. Veuillez patienter.
          </p>
          {selectedService && (
            <div className={`${selectedService.color} ${selectedService.textColor} rounded-xl px-4 py-2 text-sm font-semibold`}>
              {selectedService.label}
            </div>
          )}
        </div>
      )}

      {/* ── DONE PHASE ──────────────────────────────────────── */}
      {phase === "done" && ticket && selectedService && (
        <div className="w-full max-w-[420px] flex flex-col gap-4">
          {/* Ticket card */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-[#e0e7ff]">
            {/* Top green banner */}
            <div className="bg-[#16a34a] flex items-center gap-3 px-5 py-3">
              <span className="material-symbols-outlined text-white text-[24px]">check_circle</span>
              <p className="text-white font-bold text-sm">Ticket généré avec succès !</p>
            </div>

            <div className="px-6 py-6 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-[#6b7280] mb-2">
                Votre numéro d'appel
              </p>
              <div className="text-7xl font-black text-[#00204d] tracking-tighter leading-none my-3">
                {ticket.numero}
              </div>
              <div className="inline-block bg-[#00204d] text-white font-bold text-lg px-6 py-2 rounded-xl mb-4 shadow-md">
                GUICHET {ticket.guichet}
              </div>

              <div className={`${selectedService.color} ${selectedService.textColor} rounded-xl px-4 py-3 mb-4 text-left flex items-center gap-3`}>
                <span className="material-symbols-outlined text-[22px]">{selectedService.icon}</span>
                <div>
                  <p className="font-bold text-sm">{selectedService.label}</p>
                  <p className="text-xs opacity-80 mt-0.5">{ticket.type_label}</p>
                </div>
              </div>

              <div className="bg-[#fefce8] border border-[#fde68a] rounded-xl px-4 py-3 text-xs text-[#78350f] text-left mb-4 leading-relaxed">
                📢 Votre numéro sera affiché sur le <strong>grand écran du hall</strong> dès qu'il sera appelé. Restez dans la zone d'attente.
              </div>

              <div className="grid grid-cols-2 gap-3 text-left text-xs bg-[#f9fafb] rounded-xl p-3 border border-[#e5e7eb] mb-4">
                <div>
                  <p className="text-[#9ca3af] font-semibold uppercase tracking-wider mb-0.5">Service</p>
                  <p className="text-[#111827] font-bold">{selectedService.label}</p>
                </div>
                <div>
                  <p className="text-[#9ca3af] font-semibold uppercase tracking-wider mb-0.5">Filière</p>
                  <p className="text-[#111827] font-bold">{ticket.type_label}</p>
                </div>
                <div>
                  <p className="text-[#9ca3af] font-semibold uppercase tracking-wider mb-0.5">Statut</p>
                  <p className="text-[#16a34a] font-bold">En attente</p>
                </div>
                <div>
                  <p className="text-[#9ca3af] font-semibold uppercase tracking-wider mb-0.5">Guichet</p>
                  <p className="text-[#00204d] font-bold">Guichet {ticket.guichet}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <button
            onClick={handlePrint}
            className="w-full bg-[#00204d] hover:bg-[#0d3882] text-white font-bold text-base py-4 rounded-2xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[22px]">picture_as_pdf</span>
            Imprimer / Sauvegarder en PDF
          </button>

          <button
            onClick={handleReset}
            className="w-full bg-white hover:bg-[#f9fafb] text-[#374151] font-semibold text-sm py-3 rounded-2xl border border-[#e5e7eb] shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Prendre un autre ticket
          </button>

          <p className="text-center text-[10px] text-[#9ca3af]">
            UIR Scolarité · Ticket #{ticket.numero} · Une seule utilisation
          </p>
        </div>
      )}
    </div>
  );
}
