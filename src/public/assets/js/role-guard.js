/* GESCO — Masquage des rubriques selon le rôle de l'utilisateur connecté. */
(function () {
  "use strict";

  var RESTRICTED_ROLES = { comptable: true };

  var DENIED_FILES = [
    "gesco-ventes-terminal.html",
    "gesco-caisse.html",
    "ca.html",
    "gesco-stock-produit-detail.html",
    "gesco-administration.html",
  ];

  function readRole() {
    try {
      var raw = sessionStorage.getItem("tt_auth");
      if (!raw) return null;
      var user = JSON.parse(raw);
      return user && user.role ? String(user.role) : null;
    } catch (e) { return null; }
  }

  function getFile(href) {
    if (!href) return "";
    var p = href.split("?")[0].split("#")[0];
    var file = p.split("/").pop();
    return file;
  }

  var role = readRole();
  if (!role) return;
  var current = location.pathname.split("/").pop() || "";

  if (RESTRICTED_ROLES[role]) {
    if (DENIED_FILES.indexOf(current) !== -1) {
      try { sessionStorage.setItem("gesco_refused", current); } catch (e) {}
      if (current !== "gesco-dashboard.html") {
        location.replace("gesco-dashboard.html");
        return;
      }
    }
    document.querySelectorAll("a[href]").forEach(function (link) {
      var href = link.getAttribute("href") || "";
      if (href.indexOf("javascript:") === 0 || href.indexOf("#") === 0) return;
      var file = getFile(href);
      if (!file) return;
      if (DENIED_FILES.indexOf(file) !== -1) {
        var entry = link.closest(".nav-item, .dropdown-item");
        if (entry) entry.classList.add("d-none");
        else link.classList.add("d-none");
      }
    });
    document.querySelectorAll("li.nav-item.dropdown").forEach(function (group) {
      var items = group.querySelectorAll(".dropdown-menu a[href]");
      var has = false;
      for (var i = 0; i < items.length; i++) {
        var a = items[i];
        if (a.closest(".d-none")) continue;
        has = true; break;
      }
      if (!has) group.classList.add("d-none");
    });
    if (current === "gesco-dashboard.html") {
      var refused = null;
      try { refused = sessionStorage.getItem("gesco_refused"); sessionStorage.removeItem("gesco_refused"); } catch (e) {}
      if (refused) {
        var main = document.querySelector("main.adminuiux-content") || document.querySelector("main");
        if (main) {
          var div = document.createElement("div");
          div.className = "alert alert-warning d-flex align-items-center gap-2";
          div.setAttribute("role", "status");
          div.innerHTML = '<i class="bi bi-shield-lock"></i><span>Accès refusé : votre profil <strong>Comptable</strong> ne donne pas accès à la rubrique <code>' + refused.replace(/[<>&"]/g,"") + '</code>.</span>';
          main.prepend(div);
        }
      }
    }
  }
})();
