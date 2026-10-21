/* GESCO — Garde d'authentification frontend.
   A inclure sur chaque page protegee (apres api.js), et sur index.html.
   - Sans token (ou token expire) -> redirection vers la page d'erreur d'acces.
   - Deja connecte sur index.html -> redirection vers le tableau de bord.
   - Synchronise la deconnexion entre TOUS les onglets (evenement storage).
   - Reinvalide l'etat a chaque retour via le cache navigateur (bfcache/pageshow).
   - Branche les liens [data-logout] sur AA.logout(). */
(function () {
  "use strict";

  var LOGIN_PAGE = "index.html";
  var DASHBOARD_PAGE = "gesco-dashboard.html";
  var ERROR_PAGE = "gesco-acces-refuse.html";

  var AUTH_KEYS = ["token", "tt_token", "tt_auth", "tt_user_id", "tt_user_email"];
  var STORAGE_SIGNAL = "gesco_logout_signal";

  var current = (location.pathname.split("/").pop() || "").toLowerCase();

  // Pages publiques : accessibles sans etre connecte
  var PUBLIC_PAGES = {
    "index.html": true,
    "": true,
    "gesco-connexion.html": true,
    "gesco-mot-de-passe-oublie.html": true,
    "gesco-reinitialisation.html": true,
    "gesco-acces-refuse.html": true
  };
  var isPublic = !!PUBLIC_PAGES[current];
  var isErrorPage = current === ERROR_PAGE;

  function clearAuthStorage() {
    AUTH_KEYS.forEach(function (key) {
      try { localStorage.removeItem(key); } catch (e) {}
      try { sessionStorage.removeItem(key); } catch (e) {}
    });
  }

  function readToken() {
    try {
      return localStorage.getItem("tt_token") || localStorage.getItem("token")
        || sessionStorage.getItem("tt_token");
    } catch (e) {
      return null;
    }
  }

  function isTokenValid(token) {
    try {
      var parts = token.split(".");
      if (parts.length !== 3) return false;
      var payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (payload.exp && payload.exp * 1000 <= Date.now()) return false;
      return true;
    } catch (e) {
      return false;
    }
  }

  // Enforce l'etat d'authentification pour la page courante.
  function enforce() {
    var token = readToken();
    var connected = !!token && isTokenValid(token);

    if (isErrorPage) {
      if (connected) location.replace(DASHBOARD_PAGE);
      return;
    }

    if (isPublic) {
      // Deja connecte sur la page de connexion -> on renvoie au tableau de bord.
      if (connected && (current === LOGIN_PAGE || current === "")) {
        location.replace(DASHBOARD_PAGE);
      }
      return;
    }

    // Page protegee
    if (!connected) {
      clearAuthStorage();
      try { sessionStorage.setItem("gesco_login_required", "1"); } catch (e) {}
      location.replace(ERROR_PAGE);
    }
  }

  // Deconnecte cet onglet sans rappeler l'API (deja faite par l'onglet initiateur).
  function logoutLocally() {
    clearAuthStorage();
    if (!isPublic) location.replace(LOGIN_PAGE);
  }

  enforce();

  // --- Synchronisation multi-onglets -----------------------------------------
  // L'evenement "storage" se declenche dans les AUTRES onglets quand une cle
  // localStorage change : parfait pour propager une deconnexion.
  window.addEventListener("storage", function (event) {
    if (event.key === STORAGE_SIGNAL && event.newValue) {
      logoutLocally();
      return;
    }
    // Un autre onglet a supprime le token -> deconnexion.
    if (event.key === "token" && event.newValue === null) {
      logoutLocally();
      return;
    }
    if (event.key === "token" && event.newValue) {
      enforce();
    }
  });

  if ("BroadcastChannel" in window) {
    try {
      var channel = new BroadcastChannel("gesco-auth");
      channel.addEventListener("message", function (event) {
        if (event.data === "logout") logoutLocally();
        if (event.data === "login") enforce();
      });
    } catch (e) {}
  }

  // --- Retour via le cache navigateur (bfcache) -------------------------------
  // Sur un retour arriere, le JS n'est pas reexecute : on reevalue l'etat.
  window.addEventListener("pageshow", function (event) {
    if (event.persisted) enforce();
  });

  // --- Liens de deconnexion (dropdown + barre superieure) ---------------------
  document.addEventListener("click", function (e) {
    var link = e.target && e.target.closest ? e.target.closest("[data-logout]") : null;
    if (!link) return;
    e.preventDefault();
    if (window.AA && typeof window.AA.logout === "function") {
      window.AA.logout();
    } else {
      clearAuthStorage();
      try { localStorage.setItem(STORAGE_SIGNAL, String(Date.now())); localStorage.removeItem(STORAGE_SIGNAL); } catch (err) {}
      location.replace(LOGIN_PAGE);
    }
  });
})();
