import React, { useState, useEffect, useRef } from "react";
import { creerTicket, getTicketStatus } from "../api";

// ─── Service definitions including Service Concours ─────────────────────────
const SERVICES = [
  {
    code: "inscription_rdv",
    label: "Inscription avec Rendez-vous",
    desc: "Vous avez un rendez-vous planifié avec un agent de scolarité.",
    icon: "event",
    color: "bg-[#0a2d6b] hover:bg-[#0d3882]",
    textColor: "text-white",
    badgeColor: "bg-[#c9a227]",
    apiService: "inscription_rdv",
    apiType: "master",
  },
  {
    code: "inscription_avp_master",
    label: "Inscription Master / AVP",
    desc: "Dossier Master & filières professionnelles ou validation AVP.",
    icon: "school",
    color: "bg-[#1d4ed8] hover:bg-[#1e40af]",
    textColor: "text-white",
    badgeColor: "bg-[#93c5fd]",
    apiService: "inscription_master",
    apiType: "master",
  },
  {
    code: "inscription_bachelier",
    label: "Inscription Bachelier",
    desc: "Inscription ou réinscription pour les bacheliers et 1ère année.",
    icon: "local_library",
    color: "bg-[#0e7490] hover:bg-[#0c6276]",
    textColor: "text-white",
    badgeColor: "bg-[#67e8f9]",
    apiService: "inscription_bachelier",
    apiType: "bachelier",
  },
  {
    code: "concours",
    label: "Service Concours",
    desc: "Candidats aux concours d'admission (Guichets Concours 1 & 2).",
    icon: "military_tech",
    color: "bg-[#7c3aed] hover:bg-[#6d28d9]",
    textColor: "text-white",
    badgeColor: "bg-[#c4b5fd]",
    apiService: "concours",
    apiType: "master",
  },
  {
    code: "autres",
    label: "Autres Demandes",
    desc: "Attestations, relevés de notes, duplicatas de carte, ou autre démarche.",
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

  const deskText = ticket.guichet
    ? (ticket.guichet_nom ? ticket.guichet_nom.toUpperCase() : `GUICHET ${ticket.guichet}`)
    : "NON ATTRIBUÉ (ANNONCÉ À L'APPEL)";

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
    .body { padding: 24px; text-align: center; }
    .label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 4px; }
    .big-number {
      font-size: 56px;
      font-weight: 900;
      color: #00204d;
      letter-spacing: -2px;
      line-height: 1;
      margin: 8px 0 14px;
    }
    .rang-badge {
      display: inline-block;
      background: #fef3c7;
      border: 1px solid #f59e0b;
      color: #92400e;
      font-size: 13px;
      font-weight: 800;
      padding: 6px 14px;
      border-radius: 20px;
      margin-bottom: 12px;
    }
    .desk-badge {
      display: inline-block;
      background: #00204d;
      color: white;
      font-size: 13px;
      font-weight: 700;
      padding: 6px 18px;
      border-radius: 20px;
      margin-bottom: 16px;
    }
    .service-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: #eff6ff;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 16px;
      border: 1px solid #bfdbfe;
    }
    .service-badge p { font-size: 13px; font-weight: 600; color: #1d4ed8; }
    .details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      background: #f9fafb;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 16px;
      text-align: left;
    }
    .detail-label { font-size: 10px; color: #9ca3af; text-transform: uppercase; font-weight: 600; }
    .detail-value { font-size: 12px; font-weight: 700; color: #111827; margin-top: 1px; }
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
    @media print {
      body { background: white; padding: 0; }
      .ticket { box-shadow: none; border: 1px solid #e5e7eb; }
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

      <div class="rang-badge">
        🎯 POSITION DANS LA FILE : #${ticket.position || 1}
      </div>

      <p class="label">Guichet assigné</p>
      <div class="desk-badge">${deskText}</div>

      <div class="service-badge">
        <span>&#128196;</span>
        <p>${serviceMeta?.label || "Service Scolarité"}</p>
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
          <p class="detail-label">Position</p>
          <p class="detail-value">#${ticket.position || 1} (${ticket.personnes_avant ?? 0} avant vous)</p>
        </div>
        <div class="detail-item">
          <p class="detail-label">Statut</p>
          <p class="detail-value">${ticket.statut || "WAITING"}</p>
        </div>
      </div>

      <div class="info-box">
        📢 <strong>Surveillez le grand écran du hall</strong> : votre numéro ${ticket.numero} y sera appelé avec le guichet exact dès qu'un agent sera disponible.
      </div>
    </div>

    <div class="footer">
      UIR — Université Internationale de Rabat · Hall des Inscriptions · Ticket #${ticket.numero}<br/>
      <strong>Le même numéro vous accompagnera si vous êtes transféré vers la Caisse ou le Service Numérique.</strong>
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
  const audioNotifiedRef = useRef(false);

  // Polling dynamique de la position du ticket en temps réel
  useEffect(() => {
    if (phase !== "done" || !ticket?.numero) return;

    const interval = setInterval(async () => {
      try {
        const fresh = await getTicketStatus(ticket.numero);
        if (fresh) {
          setTicket((prev) => {
            if (!prev) return fresh;
            const isCalledNow =
              (fresh.statut === "IN_PROGRESS" || fresh.statut === "CALLED" || fresh.guichet) &&
              (!prev.guichet && prev.statut !== "IN_PROGRESS" && prev.statut !== "CALLED");

            if (isCalledNow && !audioNotifiedRef.current) {
              audioNotifiedRef.current = true;
              if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200, 100, 300]);
              }
            }

            return {
              ...prev,
              ...fresh,
              position: fresh.position ?? prev.position,
              personnes_avant: fresh.personnes_avant ?? prev.personnes_avant,
              statut: fresh.statut ?? prev.statut,
              guichet: fresh.guichet ?? prev.guichet,
              guichet_nom: fresh.guichet_nom ?? prev.guichet_nom,
            };
          });
        }
      } catch (err) {
        // En cas d'erreur réseau temporaire, continuer sans crasher
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [phase, ticket?.numero]);

  const handleSelectService = async (svc) => {
    setSelectedService(svc);
    setPhase("loading");
    setError("");
    audioNotifiedRef.current = false;
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
    audioNotifiedRef.current = false;
  };

  const isCalled =
    ticket &&
    (ticket.statut === "IN_PROGRESS" || ticket.statut === "CALLED" || (ticket.guichet !== null && ticket.guichet !== undefined));

  const isCompleted = ticket && ticket.statut === "COMPLETED";

  return (
    <div className="min-h-screen bg-[#f0f4ff] flex flex-col items-center justify-start pt-4 pb-12 px-4">
      {/* ── UIR Header ──────────────────────────────────────── */}
      <div className="w-full max-w-[440px] bg-[#00204d] rounded-2xl shadow-lg overflow-hidden mb-5">
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
        <div className="w-full max-w-[440px] flex flex-col gap-3">
          <div className="text-center mb-1">
            <span className="inline-block bg-[#dbeafe] text-[#1d4ed8] text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-2">
              Prise de Ticket Sans Contact
            </span>
            <h2 className="text-xl font-black text-[#0a1128] tracking-tight">
              Quelle est votre démarche ?
            </h2>
            <p className="text-xs text-[#6b7280] mt-1">
              Sélectionnez votre service pour entrer dans la file d'attente globale.
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
              className={`w-full ${svc.color} ${svc.textColor} rounded-2xl p-4 text-left transition-all duration-200 active:scale-[0.98] shadow-md`}
            >
              <div className="flex items-start gap-3.5">
                <div className={`w-11 h-11 rounded-xl ${svc.badgeColor}/30 flex items-center justify-center shrink-0`}>
                  <span className="material-symbols-outlined text-[26px]">{svc.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm leading-tight">{svc.label}</p>
                  <p className="text-xs mt-1 opacity-85 leading-snug">{svc.desc}</p>
                </div>
                <span className="material-symbols-outlined text-[20px] mt-1 opacity-70 shrink-0">
                  arrow_forward_ios
                </span>
              </div>
            </button>
          ))}

          <p className="text-center text-[10px] text-[#9ca3af] mt-2">
            UIR · File d'attente globale · Votre guichet vous sera indiqué lors de votre appel.
          </p>
        </div>
      )}

      {/* ── LOADING PHASE ───────────────────────────────────── */}
      {phase === "loading" && (
        <div className="w-full max-w-[440px] bg-white rounded-2xl shadow-lg p-10 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#eff6ff] flex items-center justify-center">
            <span className="inline-block w-8 h-8 border-4 border-[#1d4ed8] border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="font-bold text-[#00204d] text-lg">Génération de votre ticket…</p>
          <p className="text-sm text-[#6b7280] text-center">
            Entrée dans la file d'attente globale et calcul de votre position.
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
        <div className="w-full max-w-[440px] flex flex-col gap-4">
          
          {/* SI LE TICKET EST APPELÉ PAR UN AGENT */}
          {isCalled && !isCompleted && (
            <div className="bg-gradient-to-br from-emerald-600 to-green-700 text-white rounded-2xl p-6 shadow-2xl text-center animate-bounce border-2 border-green-300">
              <span className="material-symbols-outlined text-[48px] text-amber-300 block mb-1">
                campaign
              </span>
              <p className="text-xs uppercase font-extrabold tracking-widest text-emerald-100">
                🎉 C'est Votre Tour !
              </p>
              <div className="text-5xl font-black tracking-tight my-2">
                {ticket.numero}
              </div>
              <p className="text-sm font-semibold text-emerald-100 mb-2">
                Veuillez vous présenter immédiatement au :
              </p>
              <div className="inline-block bg-white text-[#00204d] font-black text-2xl px-6 py-2.5 rounded-xl shadow-lg">
                {ticket.guichet_nom ? ticket.guichet_nom.toUpperCase() : `GUICHET ${ticket.guichet}`}
              </div>
            </div>
          )}

          {/* SI LE TICKET EST CLÔTURÉ */}
          {isCompleted && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl p-5 text-center shadow-md">
              <span className="material-symbols-outlined text-[36px] text-emerald-600 block mb-1">
                task_alt
              </span>
              <p className="font-extrabold text-lg">Démarche terminée</p>
              <p className="text-xs text-emerald-700 mt-1">
                Votre passage pour le ticket <strong>{ticket.numero}</strong> est validé. Merci pour votre visite à l'UIR.
              </p>
            </div>
          )}

          {/* CARTE TICKET PRINCIPALE */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-[#e0e7ff]">
            {/* Header bandeau statut */}
            <div className={`flex items-center justify-between px-5 py-3 ${
              isCalled ? "bg-emerald-600" : isCompleted ? "bg-gray-700" : "bg-[#0a2d6b]"
            }`}>
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <span className="material-symbols-outlined text-[20px]">
                  {isCalled ? "notifications_active" : isCompleted ? "check_circle" : "hourglass_top"}
                </span>
                <span>
                  {isCalled
                    ? "TICKET APPELÉ AU GUICHET"
                    : isCompleted
                    ? "TICKET CLÔTURÉ"
                    : "EN ATTENTE D'APPEL"}
                </span>
              </div>
              <span className="text-[11px] bg-white/20 text-white font-semibold px-2 py-0.5 rounded-md">
                Direct
              </span>
            </div>

            <div className="px-6 py-5 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-[#6b7280] mb-1">
                Votre Ticket
              </p>
              <div className="text-6xl font-black text-[#00204d] tracking-tighter leading-none my-2">
                {ticket.numero}
              </div>

              {/* RANG / POSITION DYNAMIQUE */}
              {!isCalled && !isCompleted && (
                <div className="my-4 p-4 bg-amber-50/80 rounded-2xl border border-amber-200 shadow-inner">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-1">
                    Position Actuelle
                  </p>
                  <div className="text-5xl font-black text-amber-700 tracking-tight">
                    {ticket.position ?? 1}
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-extrabold text-amber-900 bg-amber-200/70 px-3 py-1 rounded-full">
                    <span className="material-symbols-outlined text-[16px]">groups</span>
                    <span>
                      {(ticket.personnes_avant ?? 0) === 0
                        ? "Vous êtes le prochain candidat !"
                        : `${ticket.personnes_avant} personne(s) avant vous`}
                    </span>
                  </div>
                </div>
              )}

              {/* GUICHET ATTRIBUTION REALISTE */}
              <div className="my-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#6b7280] mb-1">
                  Guichet d'affectation
                </p>
                {ticket.guichet ? (
                  <div className="bg-[#00204d] text-white font-black text-lg px-5 py-2.5 rounded-xl shadow-md">
                    {ticket.guichet_nom ? ticket.guichet_nom.toUpperCase() : `GUICHET ${ticket.guichet}`}
                  </div>
                ) : (
                  <div className="bg-slate-100 text-slate-700 font-bold text-sm px-4 py-2 rounded-xl border border-dashed border-slate-300">
                    Non attribué · Vous serez appelé(e) dès qu'un guichet se libère
                  </div>
                )}
              </div>

              {/* SERVICE */}
              <div className={`${selectedService.color} ${selectedService.textColor} rounded-xl px-4 py-2.5 mb-3 text-left flex items-center gap-3`}>
                <span className="material-symbols-outlined text-[22px]">{selectedService.icon}</span>
                <div>
                  <p className="font-bold text-sm">{selectedService.label}</p>
                  <p className="text-xs opacity-80 mt-0.5">{ticket.type_label}</p>
                </div>
              </div>

              {/* INFO BOX VEUILLEZ PATIENTER */}
              {!isCalled && !isCompleted && (
                <div className="bg-[#fefce8] border border-[#fde68a] rounded-xl px-3.5 py-3 text-xs text-[#78350f] text-left mb-3 leading-relaxed">
                  <div className="font-bold mb-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[18px]">info</span>
                    <span>VEUILLEZ PATIENTER</span>
                  </div>
                  Le guichet exact sera indiqué dès que votre ticket sera appelé par un agent. Surveillez cette page ou le grand écran public.
                </div>
              )}

              {/* DETAILS GRID */}
              <div className="grid grid-cols-2 gap-2.5 text-left text-xs bg-[#f9fafb] rounded-xl p-3 border border-[#e5e7eb]">
                <div>
                  <p className="text-[#9ca3af] font-semibold uppercase tracking-wider mb-0.5">Position file</p>
                  <p className="text-[#b45309] font-black text-sm">#{ticket.position ?? 1}</p>
                </div>
                <div>
                  <p className="text-[#9ca3af] font-semibold uppercase tracking-wider mb-0.5">Personnes avant</p>
                  <p className="text-[#00204d] font-bold">{ticket.personnes_avant ?? 0}</p>
                </div>
                <div>
                  <p className="text-[#9ca3af] font-semibold uppercase tracking-wider mb-0.5">Filière</p>
                  <p className="text-[#111827] font-bold">{ticket.type_label}</p>
                </div>
                <div>
                  <p className="text-[#9ca3af] font-semibold uppercase tracking-wider mb-0.5">Statut</p>
                  <p className={`font-bold ${isCalled ? "text-emerald-600" : isCompleted ? "text-gray-500" : "text-amber-600"}`}>
                    {ticket.statut || "WAITING"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <button
            onClick={handlePrint}
            className="w-full bg-[#00204d] hover:bg-[#0d3882] text-white font-bold text-sm py-3.5 rounded-2xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
            Télécharger / Imprimer Ticket PDF
          </button>

          <button
            onClick={handleReset}
            className="w-full bg-white hover:bg-[#f9fafb] text-[#374151] font-semibold text-xs py-2.5 rounded-2xl border border-[#e5e7eb] shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Prendre un autre ticket
          </button>

          <p className="text-center text-[10px] text-[#9ca3af]">
            UIR Scolarité · Ticket #{ticket.numero} · Le même numéro vous suit en cas de réorientation (Paiement & Numérique)
          </p>
        </div>
      )}
    </div>
  );
}
