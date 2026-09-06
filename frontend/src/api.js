import axios from "axios";

// En développement, "proxy" dans package.json redirige déjà /api vers le backend Flask.
// En production, mettez ici l'URL complète de votre API (ex: variable d'environnement).
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "/api",
});

export const getServices = () => api.get("/services").then((r) => r.data);

export const creerTicket = (type, service) =>
  api.post("/tickets", { type, service }).then((r) => r.data);

export const getAffichage = () => api.get("/affichage").then((r) => r.data);

export const getGuichets = () => api.get("/guichets").then((r) => r.data);

export const login = (numero, mot_de_passe) =>
  api.post("/auth/login", { numero, mot_de_passe }).then((r) => r.data);

export const clientSuivant = (numero) =>
  api.post(`/guichets/${numero}/suivant`).then((r) => r.data);

export const clorerTicket = (numero, action) =>
  api.post(`/guichets/${numero}/terminer`, { action }).then((r) => r.data);

export const getStatistiques = (periode, guichet) =>
  api
    .get("/statistiques", { params: { periode, guichet: guichet || undefined } })
    .then((r) => r.data);

export const getConfig = () => api.get("/config").then((r) => r.data);

export default api;
