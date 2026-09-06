import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "/api",
  headers: {
    "Bypass-Tunnel-Reminder": "true",
  },
});

// ─── Services ─────────────────────────────────────────────────────────────────
export const getServices = () => api.get("/services").then((r) => r.data);

// ─── Tickets ──────────────────────────────────────────────────────────────────
export const creerTicket = (service) =>
  api.post("/tickets", { service }).then((r) => r.data);

export const getTicketStatus = (numero) =>
  api.get(`/tickets/${encodeURIComponent(numero)}`).then((r) => r.data);

export const listerTickets = (params = {}) =>
  api.get("/tickets", { params }).then((r) => r.data);

// ─── Stations ────────────────────────────────────────────────────────────────
export const getStations = (service) =>
  api.get("/stations", { params: service ? { service } : {} }).then((r) => r.data);

export const getStation = (stationId) =>
  api.get(`/stations/${stationId}`).then((r) => r.data);

export const appellerSuivant = (stationId) =>
  api.post(`/stations/${stationId}/suivant`).then((r) => r.data);

export const terminerTicket = (stationId, action = "termine") =>
  api.post(`/stations/${stationId}/terminer`, { action }).then((r) => r.data);

export const pauseStation = (stationId) =>
  api.post(`/stations/${stationId}/pause`).then((r) => r.data);

export const reprendreStation = (stationId) =>
  api.post(`/stations/${stationId}/reprendre`).then((r) => r.data);

export const absentStation = (stationId) =>
  api.post(`/stations/${stationId}/absent`).then((r) => r.data);

export const activerStation = (stationId) =>
  api.post(`/stations/${stationId}/activer`).then((r) => r.data);

// ─── Affichage Public ─────────────────────────────────────────────────────────
export const getAffichage = () => api.get("/affichage").then((r) => r.data);

// ─── Authentification ─────────────────────────────────────────────────────────
export const login = (email, mot_de_passe) =>
  api.post("/auth/login", { email, mot_de_passe }).then((r) => r.data);

export const changerMotDePasse = (email, ancien, nouveau) =>
  api.post("/auth/changer-mot-de-passe", { email, ancien, nouveau }).then((r) => r.data);

// ─── Statistiques ────────────────────────────────────────────────────────────
export const getStatistiques = (periode = "jour", service, station_id) =>
  api
    .get("/statistiques", {
      params: {
        periode,
        service: service || undefined,
        station_id: station_id || undefined,
      },
    })
    .then((r) => r.data);

// ─── Config & Init ────────────────────────────────────────────────────────────
export const getConfig = () => api.get("/config").then((r) => r.data);

export const setConfigTunnel = (tunnelUrl) =>
  api.post("/config", { tunnel_url: tunnelUrl }).then((r) => r.data);

export const initSystem = () =>
  api.post("/init").then((r) => r.data);

// ─── Compatibilité ancienne API ───────────────────────────────────────────────
export const getGuichets = () => api.get("/stations").then((r) => r.data);
export const clientSuivant = (stationId) => appellerSuivant(stationId);
export const clorerTicket = (stationId, action) => terminerTicket(stationId, action);
export const pauseGuichet = (stationId) => pauseStation(stationId);
export const resumeGuichet = (stationId) => reprendreStation(stationId);
export const setGuichetAbsent = (stationId) => absentStation(stationId);
export const activateGuichet = (stationId) => activerStation(stationId);

export default api;
