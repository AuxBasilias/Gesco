(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    const root = document.getElementById("main-content");
    const periodSelect = document.getElementById("dashboard-period");
    const refreshButton = document.getElementById("dashboard-refresh");
    const api = window.AA;
    let loading = false;

    if (!root || !api || typeof api.getDashboard !== "function") {
      console.error("Le tableau de bord GESCO ne peut pas démarrer : API ou conteneur absent.");
      if (root) {
        root.dataset.dashboardLoading = "false";
        root.setAttribute("aria-busy", "false");
        root.innerHTML = '<div class="alert alert-danger" role="alert">Le tableau de bord est indisponible. Rechargez la page ou contactez votre administrateur.</div>';
      }
      return;
    }

    const money = (value) => `${Number(value || 0).toLocaleString("fr-FR")} FCFA`;
    const number = (value) => Number(value || 0).toLocaleString("fr-FR");
    const date = (value) => {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    function setText(selector, value) {
      const element = root.querySelector(selector);
      if (element) element.textContent = value;
    }

    function renderShell() {
      root.innerHTML = `
        <section class="mb-4" aria-labelledby="dashboard-welcome">
          <p class="text-secondary mb-1">Bienvenue dans votre espace de gestion</p>
          <h1 class="h3 fw-bold mb-1" id="dashboard-welcome" data-user-name>Votre activité</h1>
          <p class="text-secondary mb-0">Les indicateurs sont calculés à partir des données enregistrées dans GESCO.</p>
        </section>
        <div class="alert alert-info d-none" id="dashboard-empty-notice" role="status"></div>
        <div class="row gx-3 gy-3 mb-4">
          <div class="col-12 col-md-6 col-xl-3"><article class="card h-100"><div class="card-body"><p class="text-secondary small mb-2">Chiffre d'affaires aujourd'hui</p><h2 class="h4 mb-0" data-stat="chiffreAffairesJour">—</h2></div></article></div>
          <div class="col-12 col-md-6 col-xl-3"><article class="card h-100"><div class="card-body"><p class="text-secondary small mb-2">Ventes aujourd'hui</p><h2 class="h4 mb-0" data-stat="ventesJour">—</h2><p class="small text-secondary mb-0">Retours : <span data-stat="retoursJour">—</span></p></div></article></div>
          <div class="col-12 col-md-6 col-xl-3"><article class="card h-100"><div class="card-body"><p class="text-secondary small mb-2">Chiffre d'affaires sur la période</p><h2 class="h4 mb-0" data-stat="chiffreAffairesPeriode">—</h2><p class="small text-secondary mb-0" data-stat="variation">Comparaison indisponible</p></div></article></div>
          <div class="col-12 col-md-6 col-xl-3"><article class="card h-100"><div class="card-body"><p class="text-secondary small mb-2">Clients enregistrés</p><h2 class="h4 mb-0" data-stat="clients">—</h2></div></article></div>
          <div class="col-12 col-md-6 col-xl-3"><article class="card h-100"><div class="card-body"><p class="text-secondary small mb-2">Valeur d'achat du stock</p><h2 class="h4 mb-0" data-stat="valeurStock">—</h2></div></article></div>
          <div class="col-12 col-md-6 col-xl-3"><article class="card h-100"><div class="card-body"><p class="text-secondary small mb-2">Articles en stock</p><h2 class="h4 mb-0" data-stat="quantiteEnStock">—</h2></div></article></div>
          <div class="col-12 col-md-6 col-xl-3"><article class="card h-100"><div class="card-body"><p class="text-secondary small mb-2">Produits sous le seuil</p><h2 class="h4 mb-0" data-stat="produitsSousSeuil">—</h2><p class="small text-secondary mb-0">Dont en rupture : <span data-stat="produitsEnRupture">—</span></p></div></article></div>
          <div class="col-12 col-md-6 col-xl-3"><article class="card h-100"><div class="card-body"><p class="text-secondary small mb-2">Montant restant dû</p><h2 class="h4 mb-0" data-stat="montantImpayes">—</h2><p class="small text-secondary mb-0">Factures : <span data-stat="facturesImpayees">—</span></p></div></article></div>
        </div>
        <div class="row gx-3 gy-3 mb-4">
          <div class="col-12 col-xl-8">
            <section class="card h-100" aria-labelledby="dashboard-sales-title">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-3">
                  <div><h2 class="h5 mb-1" id="dashboard-sales-title">Évolution du chiffre d'affaires</h2><p class="small text-secondary mb-0" data-period-label></p></div>
                  <span class="badge text-bg-light">Ventes encaissées</span>
                </div>
                <div class="dashboard-chart d-flex align-items-end gap-2" role="img" aria-label="Chiffre d'affaires journalier sur la période"></div>
              </div>
            </section>
          </div>
          <div class="col-12 col-xl-4">
            <section class="card h-100" aria-labelledby="dashboard-best-title">
              <div class="card-body">
                <h2 class="h5 mb-1" id="dashboard-best-title">Meilleures ventes</h2>
                <p class="small text-secondary mb-3">Produits les plus vendus sur la période</p>
                <div class="dashboard-best-products"></div>
              </div>
            </section>
          </div>
          <div class="col-12 col-xl-5">
            <section class="card h-100" aria-labelledby="dashboard-stock-title">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-3">
                  <div><h2 class="h5 mb-1" id="dashboard-stock-title">Alertes de stock</h2><p class="small text-secondary mb-0"><span data-stat="produitsSousSeuil">—</span> produit(s) à vérifier</p></div>
                  <a href="gesco-stock-produits.html" class="btn btn-sm btn-link">Voir le stock</a>
                </div>
                <div class="dashboard-low-stock"></div>
              </div>
            </section>
          </div>
          <div class="col-12 col-xl-7">
            <section class="card h-100" aria-labelledby="dashboard-recent-title">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-3">
                  <div><h2 class="h5 mb-1" id="dashboard-recent-title">Ventes récentes</h2><p class="small text-secondary mb-0">Dernières ventes confirmées</p></div>
                  <a href="gesco-ventes.html" class="btn btn-sm btn-link">Toutes les ventes</a>
                </div>
                <div class="table-responsive">
                  <table class="table align-middle mb-0">
                    <thead><tr><th>Référence</th><th>Client</th><th>Date</th><th class="text-end">Montant encaissé</th></tr></thead>
                    <tbody class="dashboard-recent-sales"></tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        </div>
        <p class="small text-secondary text-end mb-3" data-updated-at></p>`;

      const profile = api.getProfile?.();
      if (profile?.name) {
        setText("[data-user-name]", profile.name);
        const headerName = document.querySelector("#userprofiledd .lh-14 span");
        const profileTitle = document.querySelector("#userprofiledd + .dropdown-menu h5");
        if (headerName) {
          const role = document.createElement("small");
          role.className = "opacity-75";
          role.textContent = "Compte actif";
          headerName.replaceChildren(document.createTextNode(profile.name), document.createElement("br"), role);
        }
        if (profileTitle) profileTitle.textContent = profile.name;
        const initials = profile.name
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part.charAt(0).toLocaleUpperCase("fr"))
          .join("");
        document.querySelectorAll("#userprofiledd .avatar").forEach((avatar) => {
          avatar.textContent = initials;
        });
      }
    }

    function renderChart(rows) {
      const chart = root.querySelector(".dashboard-chart");
      if (!chart) return;
      chart.replaceChildren();
      const max = Math.max(0, ...rows.map((row) => Number(row.chiffreAffaires) || 0));
      if (!rows.length || max === 0) {
        chart.classList.remove("align-items-end");
        chart.classList.add("align-items-center", "justify-content-center");
        chart.textContent = "Aucune vente encaissée sur cette période.";
        return;
      }

      chart.classList.add("align-items-end");
      chart.classList.remove("align-items-center", "justify-content-center");
      rows.forEach((row) => {
        const column = document.createElement("div");
        column.className = "flex-fill text-center";
        const amount = Number(row.chiffreAffaires) || 0;
        const bar = document.createElement("div");
        bar.className = `mx-auto rounded-top ${amount > 0 ? "bg-theme-1" : "bg-secondary-subtle"}`;
        bar.style.height = `${amount > 0 ? Math.max(4, Math.round((amount / max) * 140)) : 2}px`;
        bar.style.width = "min(100%, 32px)";
        bar.title = `${row.label} : ${money(amount)}`;
        const label = document.createElement("span");
        label.className = "d-block small text-secondary text-truncate mt-2";
        label.textContent = row.label;
        column.append(bar, label);
        chart.append(column);
      });
    }

    function renderList(containerSelector, rows, emptyMessage, makeRow) {
      const container = root.querySelector(containerSelector);
      if (!container) return;
      container.replaceChildren();
      if (!rows.length) {
        const empty = document.createElement("p");
        empty.className = "small text-secondary mb-0";
        empty.textContent = emptyMessage;
        container.append(empty);
        return;
      }
      rows.forEach((row) => container.append(makeRow(row)));
    }

    function render(data) {
      renderShell();
      const stats = {
        chiffreAffairesJour: money(data.chiffreAffairesJour),
        ventesJour: number(data.ventesJour),
        retoursJour: number(data.retoursJour),
        chiffreAffairesPeriode: money(data.chiffreAffairesPeriode),
        clients: number(data.clients),
        valeurStock: money(data.valeurStock),
        quantiteEnStock: number(data.quantiteEnStock),
        produitsSousSeuil: number(data.produitsSousSeuil),
        produitsEnRupture: number(data.produitsEnRupture),
        montantImpayes: money(data.montantImpayes),
        facturesImpayees: number(data.facturesImpayees),
      };
      Object.entries(stats).forEach(([key, value]) => setText(`[data-stat="${key}"]`, value));
      const variation = data.variationChiffreAffaires;
      setText(
        '[data-stat="variation"]',
        variation === null || variation === undefined
          ? "Pas d'historique de comparaison disponible"
          : `${variation > 0 ? "+" : ""}${number(variation)} % par rapport à la période précédente`,
      );
      setText("[data-period-label]", `Sur les ${number(data.periodeJours)} derniers jours`);

      const dailySales = Array.isArray(data.ventesParJour) ? data.ventesParJour : [];
      const chartSales = Number(data.periodeJours) > 30
        ? Array.from({ length: Math.ceil(dailySales.length / 7) }, (_, index) => {
          const week = dailySales.slice(index * 7, (index + 1) * 7);
          return {
            label: week.length > 1 ? `${week[0].label} – ${week[week.length - 1].label}` : week[0]?.label ?? "",
            chiffreAffaires: week.reduce((sum, row) => sum + Number(row.chiffreAffaires || 0), 0),
            ventes: week.reduce((sum, row) => sum + Number(row.ventes || 0), 0),
          };
        })
        : dailySales;
      renderChart(chartSales);
      renderList(".dashboard-best-products", Array.isArray(data.meilleuresVentes) ? data.meilleuresVentes : [], "Aucune vente de produit sur cette période.", (product) => {
        const row = document.createElement("div");
        row.className = "d-flex justify-content-between gap-3 border-bottom py-2";
        const label = document.createElement("div");
        const name = document.createElement("p");
        name.className = "mb-0";
        name.textContent = product.designation;
        const category = document.createElement("p");
        category.className = "small text-secondary mb-0";
        category.textContent = product.categorie;
        label.append(name, category);
        const quantity = document.createElement("span");
        quantity.className = "small text-nowrap";
        quantity.textContent = `${number(product.quantite)} vendu(s)`;
        row.append(label, quantity);
        return row;
      });
      renderList(".dashboard-low-stock", Array.isArray(data.stocksFaibles) ? data.stocksFaibles : [], "Aucun produit sous le seuil minimum.", (product) => {
        const row = document.createElement("div");
        row.className = "d-flex justify-content-between gap-3 border-bottom py-2";
        const label = document.createElement("span");
        label.className = "text-truncate";
        label.textContent = product.designation;
        const quantity = document.createElement("span");
        quantity.className = `small text-nowrap ${Number(product.quantite) === 0 ? "text-danger fw-semibold" : "text-secondary"}`;
        quantity.textContent = `${number(product.quantite)} / ${number(product.seuilMinimum)}`;
        row.append(label, quantity);
        return row;
      });
      renderList(".dashboard-recent-sales", Array.isArray(data.ventesRecentes) ? data.ventesRecentes : [], "Aucune vente enregistrée pour le moment.", (sale) => {
        const row = document.createElement("tr");
        [sale.reference, sale.nomClient, date(sale.dateVente)].forEach((value) => {
          const cell = document.createElement("td");
          cell.textContent = value || "—";
          row.append(cell);
        });
        const amount = document.createElement("td");
        amount.className = "text-end text-nowrap";
        amount.textContent = money(sale.montantPaye);
        row.append(amount);
        return row;
      });

      const notice = root.querySelector("#dashboard-empty-notice");
      const noSales = !Number(data.ventesPeriode);
      const noProducts = !Number(data.produits);
      if (noSales || noProducts) {
        const messages = [];
        if (noSales) messages.push("Aucune vente n'a été enregistrée sur cette période. Le chiffre d'affaires et les tendances apparaîtront après les premières ventes.");
        if (noProducts) messages.push("Le catalogue est vide. Ajoutez des produits pour suivre les niveaux et la valeur du stock.");
        notice.textContent = messages.join(" ");
        notice.classList.remove("d-none");
      }
      setText("[data-updated-at]", `Mis à jour à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`);
    }

    async function loadDashboard() {
      if (loading) return;
      loading = true;
      if (refreshButton) refreshButton.disabled = true;
      root.setAttribute("aria-busy", "true");
      root.innerHTML = '<div class="text-center py-5" role="status"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Chargement des statistiques...</div>';
      root.dataset.dashboardLoading = "false";
      try {
        const days = Number(periodSelect?.value || 7);
        const data = await api.getDashboard({ days: String(days) });
        render(data);
      } catch (error) {
        console.error("Impossible de charger les statistiques du tableau de bord :", error);
        root.innerHTML = '<div class="alert alert-danger d-flex justify-content-between align-items-center gap-3" role="alert"><span>Impossible de charger les statistiques. Vérifiez votre connexion puis réessayez.</span><button class="btn btn-sm btn-outline-danger" type="button" data-dashboard-retry>Réessayer</button></div>';
        root.querySelector("[data-dashboard-retry]")?.addEventListener("click", loadDashboard);
      } finally {
        loading = false;
        root.dataset.dashboardLoading = "false";
        root.setAttribute("aria-busy", "false");
        if (refreshButton) refreshButton.disabled = false;
      }
    }

    periodSelect?.addEventListener("change", loadDashboard);
    refreshButton?.addEventListener("click", loadDashboard);
    loadDashboard();
  });
})();
