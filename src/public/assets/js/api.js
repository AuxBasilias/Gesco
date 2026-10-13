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

  async function request(url, options = {}) {
    const isFormData = options.body instanceof FormData;
    const token = sessionStorage.getItem("tt_token") || localStorage.getItem("token");
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
        if (url !== "/login") {
          sessionStorage.removeItem("tt_token");
          sessionStorage.removeItem("tt_auth");
          sessionStorage.removeItem("tt_user_id");
          sessionStorage.removeItem("tt_user_email");
          localStorage.removeItem("token");
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

    const email = sessionStorage.getItem('tt_user_email') || 'admin@togotech.com';

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

  async function deleteProduit(id) {
    return request(`/produits/${id}`, { method: 'DELETE' });
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

  async function createInventory(data = {}) {
    return request('/inventaires', { method: 'POST', body: JSON.stringify(data) });
  }

  async function countInventory(id, data) {
    return request(`/inventaires/${id}/comptages`, { method: 'POST', body: JSON.stringify(data) });
  }

  async function closeInventory(id, data) {
    return request(`/inventaires/${id}/cloture`, { method: 'POST', body: JSON.stringify(data) });
  }

  async function getFournisseurs() {
    return request('/fournisseurs');
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

  async function getSessionsCaisse() {
    return request('/caisse/sessions');
  }

  async function openSessionCaisse(data) {
    return request('/caisse/sessions', { method: 'POST', body: JSON.stringify(data) });
  }

  async function closeSessionCaisse(id, data) {
    return request(`/caisse/sessions/${id}/cloture`, { method: 'POST', body: JSON.stringify(data) });
  }

  async function getPaiements() {
    return request('/paiements');
  }

  async function createPaiement(idFacture, data) {
    return request(`/factures/${idFacture}/paiements`, { method: 'POST', body: JSON.stringify(data) });
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

  // =========================
  // 🔹 EXPORT PUBLIC
  // =========================

  return {
    login,
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
    createInventory,
    countInventory,
    closeInventory,
    getFournisseurs,
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
    createFactureFromVente,
    createVente,
    cancelVente,
    getRetours,
    createRetour,
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
    getCategories
  };

})()