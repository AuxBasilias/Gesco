'use strict';

// 🔥 Namespace global
window.AA = (function () {

  // =========================
  // 🔹 CONFIG
  // =========================
  const BASE_URL = '/api';



  // =========================
  // 🔹 HELPERS
  // =========================

  // Clés d'authentification stockées dans localStorage (partagé entre tous les
  // onglets) afin qu'une déconnexion soit visible partout.
  var AUTH_KEYS = ["token", "tt_token", "tt_auth", "tt_user_id", "tt_user_email"];
  var LOGOUT_SIGNAL = "gesco_logout_signal";
  var LOGIN_PAGE = "index.html";

  function getToken() {
    try {
      return localStorage.getItem("tt_token") || localStorage.getItem("token")
        || sessionStorage.getItem("tt_token");
    } catch (e) {
      return null;
    }
  }

  function getAuthItem(key) {
    try {
      return localStorage.getItem(key) || sessionStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function setAuthSession(data) {
    var token = data.token || data.accessToken;
    var user = data.utilisateur || {};
    // localStorage = source partagée entre onglets
    localStorage.setItem("token", token);
    localStorage.setItem("tt_token", token);
    localStorage.setItem("tt_user_id", user.id ?? "");
    localStorage.setItem("tt_user_email", user.email || "");
    localStorage.setItem("tt_auth", JSON.stringify(user));
    // miroir sessionStorage pour le code existant qui le lit encore
    sessionStorage.setItem("tt_token", token);
    sessionStorage.setItem("tt_user_id", user.id ?? "");
    sessionStorage.setItem("tt_user_email", user.email || "");
    sessionStorage.setItem("tt_auth", JSON.stringify(user));
  }

  async function request(url, options = {}) {
    const isFormData = options.body instanceof FormData;
    const token = getToken();
    const { headers: requestHeaders, ...requestOptions } = options;
    const res = await fetch(BASE_URL + url, {
      ...requestOptions,
      headers: {
        ...(!isFormData && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(requestHeaders || {})
      }
    });

    let data;
    if (!res.ok) {
      data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        if (url.indexOf("/login") !== 0) {
          clearAuthStorage();
          if (!/index\.html?$/.test(location.pathname) && location.pathname !== "/") {
            location.replace("gesco-acces-refuse.html");
          }
        }
        throw new Error(data.message || "Connexion requise. Connectez-vous puis réessayez.");
      }
      if (res.status === 403) {
        throw new Error(data.message || "Vous n'avez pas les droits nécessaires pour cette action.");
      }
      throw new Error(data.message || `API error: ${res.status}`);
    }

    return res.json();
  }

  // =========================
  // 🔹 PROFILE (comme ton TT)
  // =========================

  function getProfile() {

    const email = getAuthItem('tt_user_email') || 'admin@togotech.com';

    return {
      email,
      name: email
        .split('@')[0]
        .replace(/[._]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase()),
      phone: '',
      avatar: '',
      language: 'fr',
      timezone: 'Africa/Lome',
    };
  }

// =========================
// 🔹 AUTHENTIFICATION
// =========================
function login(data){
    return request('/login', {
      method: 'POST',
      body: JSON.stringify(data)
    });
}

  function clearAuthStorage() {
    AUTH_KEYS.forEach(function (key) {
      try { localStorage.removeItem(key); } catch (e) {}
      try { sessionStorage.removeItem(key); } catch (e) {}
    });
  }

  function isAuthenticated() {
    var token = getToken();
    if (!token) return false;
    try {
      var parts = token.split(".");
      if (parts.length !== 3) return false;
      var payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (payload.exp && payload.exp * 1000 <= Date.now()) {
        clearAuthStorage();
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  // Diffuse un signal de déconnexion aux autres onglets (via localStorage :
  // l'événement "storage" ne se déclenche que dans les AUTRES onglets).
  function broadcastLogout() {
    try {
      localStorage.setItem(LOGOUT_SIGNAL, String(Date.now()));
      localStorage.removeItem(LOGOUT_SIGNAL);
    } catch (e) {}
  }

  async function logout(options) {
    try {
      await request('/login/logout', { method: 'POST' });
    } catch (e) { /* on ignore : on nettoie quand même */ }
    clearAuthStorage();
    broadcastLogout();
    if (options && options.silent) return;
    window.location.replace(LOGIN_PAGE);
  }
 
  

  // =========================
  // 🔹 CLIENTS
  // =========================

  async function getClients() {
    return request('/clients');
  }
  async function getClient(id) {
    return request(`/clients/${id}`);
  }

  async function createClient(data) {
    return request('/clients', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  async function updateClient(id, data) {
    return request(`/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

    async function deleteClient(id) {
    return request(`/clients/${id}`, {
      method: 'DELETE'
    });
  }

    async function getClientStats(id) {
    return request(`/clients/${id}/stats`);
  }






   // =========================
  // 🔹 Utilisateurs
  // =========================

  async function getUtilisateurs() {
    return request('/utilisateurs');
  }
  async function getUtilisateur(id) {
    return request(`/utilisateurs/${id}`);
  }

  async function createUtilisateur(data) {
    return request('/utilisateurs', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  async function updateUtilisateur(id, data) {
    return request(`/utilisateurs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

    async function deleteUtilisateur(id) {
      return request(`/utilisateurs/${id}`, {
      method: 'DELETE'
    });
  }
// =========================
// 🔹 Authentification
// =========================

async function changePassword(data) {
  return request('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}




  // =========================
  // 🔹 FACTURES
  // =========================

async function getFactures(status) {
  const url = status 
    ? `/factures?status=${encodeURIComponent(status)}`
    : '/factures';

  return request(url);
}

  async function getFacture(id) {
    return request(`/factures/${id}`);
  }

  async function getFactureLignes(factureId) {
    return request(`/factures/${factureId}/lignes`);
  }

  async function createFacture(data) {
    return request('/factures', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async function updateFacture(id, data) {
    return request(`/factures/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async function factureToDraft(id) {
    const data = {"facture":{
        "status":"draft"
      }};
    return request(`/factures/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async function factureToBasket(id) {
    const data = {"facture":{
        "status":"deleted"
      }};
    return request(`/factures/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async function getFacturesStats(){
    return request('/factures/stats');
  }

  async function getFactureRevenueStats(period){
    return request(`/factures/revenue?period=${period}`);
  }



  async function deleteFacture(id) {
    return request(`/factures/${id}`, {
      method: 'DELETE'
    });
  }

  async function emptyTrash() {
    return request(`/factures/cleanup`, {
      method: 'DELETE'
    });
  }

  // =========================
  // 🔹 PRODUITS
  // =========================

  async function getProduits() {
    return request('/produits');
  }

  async function getProduit(id) {
    return request(`/produits/${id}`);
  }

  async function createProduit(data) {
    return request('/produits', {
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data)
    });
  }

  async function updateProduit(id, data) {
    return request(`/produits/${id}`, {
      method: 'PUT',
      body: data instanceof FormData ? data : JSON.stringify(data)
    });
  }

  async function deleteProduit(id, data) {
    return request(`/produits/${id}`, {
      method: 'DELETE',
      body: data ? (data instanceof FormData ? data : JSON.stringify(data)) : undefined
    });
  }

  async function getStocks() {
    return request('/stocks');
  }

  async function getStockMovements() {
    return request('/stocks/mouvements');
  }

  async function createStockMovement(data) {
    return request('/stocks/mouvements', { method: 'POST', body: JSON.stringify(data) });
  }

  async function getInventories() {
    return request('/inventaires');
  }

  async function getInventory(id) {
    return request(`/inventaires/${id}`);
  }

  async function createInventory(data = {}) {
    return request('/inventaires', { method: 'POST', body: JSON.stringify(data) });
  }

  async function countInventory(id, data) {
    return request(`/inventaires/${id}/comptages`, { method: 'POST', body: JSON.stringify(data) });
  }

  async function closeInventory(id, data) {
    return request(`/inventaires/${id}/cloture`, { method: 'POST', body: JSON.stringify(data) });
  }

  async function deleteInventory(id) {
    return request(`/inventaires/${id}`, { method: 'DELETE' });
  }

  async function getFournisseurs() {
    return request('/fournisseurs');
  }

  async function getFournisseur(id) {
    return request(`/fournisseurs/${id}`);
  }

  async function getFournisseurStats(id) {
    return request(`/fournisseurs/${id}/stats`);
  }

  async function createFournisseur(data) {
    return request('/fournisseurs', { method: 'POST', body: JSON.stringify(data) });
  }

  async function updateFournisseur(id, data) {
    return request(`/fournisseurs/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async function deleteFournisseur(id) {
    return request(`/fournisseurs/${id}`, { method: 'DELETE' });
  }

  async function getCommandes() {
    return request('/commandes');
  }

  async function getCommande(id) {
    return request(`/commandes/${id}`);
  }

  async function createCommande(data) {
    return request('/commandes', { method: 'POST', body: JSON.stringify(data) });
  }

  async function receiveCommande(id, data) {
    return request(`/commandes/${id}/receptions`, { method: 'POST', body: JSON.stringify(data) });
  }

  async function getReceptions() {
    return request('/receptions');
  }

  async function getVentes() {
    return request('/ventes');
  }

  async function getVente(id) {
    return request(`/ventes/${id}`);
  }

  async function getVenteSerials(id) {
    return request(`/ventes/${id}/serials`);
  }

  async function updateVenteSerials(id, serials) {
    return request(`/ventes/${id}/serials`, { method: 'PUT', body: JSON.stringify({ serials }) });
  }

  async function getVenteRetournable(id) {
    return request(`/ventes/${id}/lignes-retournables`);
  }

  async function createFactureFromVente(id) {
    return request(`/ventes/${id}/facture`, { method: 'POST' });
  }

  async function createVente(data) {
    return request('/ventes', { method: 'POST', body: JSON.stringify(data) });
  }

  async function cancelVente(id) {
    return request(`/ventes/${id}/annulation`, { method: 'POST' });
  }

  async function getRetours() {
    return request('/ventes-retours');
  }

  async function createRetour(data) {
    return request('/ventes-retours', { method: 'POST', body: JSON.stringify(data) });
  }

  async function setRetourStatut(id, statut) {
    return request(`/ventes-retours/${id}/statut`, { method: 'POST', body: JSON.stringify({ statut }) });
  }

  async function getSessionsCaisse() {
    return request('/caisse/sessions');
  }

  async function openSessionCaisse(data) {
    return request('/caisse/sessions', { method: 'POST', body: JSON.stringify(data) });
  }

  async function closeSessionCaisse(id, data) {
    return request(`/caisse/sessions/${id}/cloture`, { method: 'POST', body: JSON.stringify(data) });
  }

  async function getPaiements(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value) !== '') params.set(key, value);
    });
    return request(`/paiements${params.size ? `?${params}` : ''}`);
  }

  async function getFacturesImpayees(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value) !== '') params.set(key, value);
    });
    return request(`/factures/impayees${params.size ? `?${params}` : ''}`);
  }

  async function createPaiement(idFacture, data) {
    return request(`/factures/${idFacture}/paiements`, { method: 'POST', body: JSON.stringify(data) });
  }

  async function annulerPaiement(id, data) {
    return request(`/paiements/${id}/annulation`, { method: 'POST', body: JSON.stringify(data) });
  }

  async function relancerFacture(id, data) {
    return request(`/factures/${id}/relance`, { method: 'POST', body: JSON.stringify(data || {}) });
  }

  async function getDashboard(filters = {}) {
    const params = new URLSearchParams(filters);
    return request(`/dashboard${params.size ? `?${params}` : ''}`);
  }

  async function getRapport(filters = {}) {
    const params = new URLSearchParams(filters);
    return request(`/rapports${params.size ? `?${params}` : ''}`);
  }

  async function getParametres() {
    return request('/administration/parametres');
  }

  async function saveParametres(data) {
    return request('/administration/parametres', { method: 'PUT', body: JSON.stringify(data) });
  }

  async function getJournalActivite() {
    return request('/administration/journal');
  }

  async function getCategories() {
    return request('/categories');
  }

  async function createCategorie(data) {
    return request('/categories', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // =========================
  // 🔹 EXPORT PUBLIC
  // =========================

  return {
    login,
    logout,
    isAuthenticated,
    clearAuthStorage,
    setAuthSession,
    getToken,
    getAuthItem,
    AUTH_KEYS,
    LOGOUT_SIGNAL,
    getProfile,

    getClients,
    getClient,
    createClient,
    updateClient,
    deleteClient,
    getClientStats,

    getFactures,
    getFacture,
    getFactureLignes,
    createFacture,
    updateFacture,
    deleteFacture,
    factureToDraft,
    factureToBasket,
    emptyTrash,
    getFacturesStats,
    getFactureRevenueStats,


    getUtilisateurs,
    getUtilisateur,
    createUtilisateur,
    updateUtilisateur,
    deleteUtilisateur,
    changePassword,

    getProduits,
    getProduit,
    createProduit,
    updateProduit,
    deleteProduit,
    getStocks,
    getStockMovements,
    createStockMovement,
    getInventories,
    getInventory,
    createInventory,
    countInventory,
    closeInventory,
    deleteInventory,
    getFournisseurs,
    getFournisseur,
    getFournisseurStats,
    createFournisseur,
    updateFournisseur,
    deleteFournisseur,
    getCommandes,
    getCommande,
    createCommande,
    receiveCommande,
    getReceptions,
    getVentes,
    getVente,
    getVenteSerials,
    updateVenteSerials,
    getVenteRetournable,
    createFactureFromVente,
    createVente,
    cancelVente,
    getRetours,
    createRetour,
    setRetourStatut,
    getSessionsCaisse,
    openSessionCaisse,
    closeSessionCaisse,
    getPaiements,
    createPaiement,
    getDashboard,
    getRapport,
    getParametres,
    saveParametres,
    getJournalActivite,
    getCategories,
    createCategorie
  };

})()