(function () {
  "use strict";

  const api = window.AA;
  if (!api) {
    console.error("L'API GESCO n'est pas disponible.");
    return;
  }

  function setupUserManagement(users) {
    const activeCount = document.getElementById("users-active-count");
    if (activeCount) {
      const enabled = users.filter((user) => user.actif).length;
      activeCount.textContent = `${users.length} compte${users.length === 1 ? "" : "s"} — ${enabled} actif${enabled === 1 ? "" : "s"}`;
    }
  }

  const page = location.pathname.split("/").pop();
  const esc = (value) => String(value ?? "");
  const list = (value) => Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : [];
  const findId = () => {
    const queryId = new URLSearchParams(location.search).get("id");
    if (queryId) return queryId;
    const match = location.pathname.match(/-(\d+)\.html$/);
    return match?.[1] ?? null;
  };

  async function loadSalesHistory() {
    const [sales, clients, invoices] = await Promise.all([
      api.getVentes(),
      api.getClients(),
      api.getFactures(),
    ]);
    const clientNames = new Map(list(clients).map((client) => [client.id, client.nom]));
    const invoiceRefs = new Map(list(invoices).filter((invoice) => invoice.idVente).map((invoice) => [invoice.idVente, invoice]));
    return list(sales).map((sale) => {
      const invoice = invoiceRefs.get(sale.id);
      return {
        ...sale,
        idClientLabel: clientNames.get(sale.idClient) ?? (sale.idClient ? `Client ${sale.idClient}` : "Client comptoir"),
        articleCount: Number(sale.articleCount ?? 0),
        invoiceReference: invoice?.reference ?? "Créer la facture",
        idFacture: invoice?.id ?? null,
      };
    });
  }
  const money = (value) => `${Number(value || 0).toLocaleString("fr-FR")} FCFA`;
  const roundedMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

  let confirmResolve = null;
  let confirmElement = null;

  function closeConfirm(value) {
    const resolve = confirmResolve;
    if (!resolve) return;
    confirmResolve = null;
    resolve(value);
    if (window.bootstrap?.Modal) {
      window.bootstrap.Modal.getOrCreateInstance(confirmElement).hide();
    } else if (confirmElement) {
      confirmElement.remove();
      confirmElement = null;
    }
  }

  function confirmAction(options) {
    const settings = typeof options === "string" ? { message: options } : (options ?? {});
    const danger = settings.tone === "danger";
    if (!confirmElement) {
      confirmElement = document.createElement("div");
      confirmElement.className = "modal fade";
      confirmElement.tabIndex = -1;
      confirmElement.setAttribute("role", "dialog");
      confirmElement.setAttribute("aria-modal", "true");
      confirmElement.setAttribute("aria-hidden", "true");

      const dialog = document.createElement("div");
      dialog.className = "modal-dialog modal-dialog-centered";
      const content = document.createElement("div");
      content.className = "modal-content border-0 shadow-lg rounded-4";
      const body = document.createElement("div");
      body.className = "modal-body px-4 pt-4 pb-2 text-center";

      const icon = document.createElement("div");
      icon.className = "mx-auto mb-3 d-flex align-items-center justify-content-center rounded-circle";
      icon.style.cssText = "width:64px;height:64px;font-size:1.6rem;";
      const glyph = document.createElement("i");
      glyph.className = "bi";
      icon.append(glyph);

      const title = document.createElement("h5");
      title.className = "mb-2";
      const message = document.createElement("p");
      message.className = "text-secondary mb-0";
      body.append(icon, title, message);

      const footer = document.createElement("div");
      footer.className = "modal-footer border-0 px-4 pb-4 pt-2 justify-content-center gap-2";
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "btn btn-outline-secondary px-4";
      cancel.addEventListener("click", () => closeConfirm(false));
      const confirm = document.createElement("button");
      confirm.type = "button";
      confirm.className = "btn px-4";
      confirm.addEventListener("click", () => closeConfirm(true));
      footer.append(cancel, confirm);

      content.append(body, footer);
      dialog.append(content);
      confirmElement.append(dialog);
      confirmElement.addEventListener("hidden.bs.modal", () => closeConfirm(false));
      document.body.append(confirmElement);
    }

    const icon = confirmElement.querySelector(".modal-body > div");
    const glyph = icon.querySelector("i");
    const title = confirmElement.querySelector(".modal-body > h5");
    const message = confirmElement.querySelector(".modal-body > p");
    const [cancel, confirm] = confirmElement.querySelectorAll(".modal-footer button");

    icon.className = `mx-auto mb-3 d-flex align-items-center justify-content-center rounded-circle ${danger ? "bg-danger-subtle text-danger" : "bg-theme-1-subtle text-theme-1"}`;
    glyph.className = `bi ${danger ? "bi-exclamation-triangle" : "bi-question-circle"}`;
    title.textContent = settings.title ?? "Confirmation";
    message.textContent = settings.message ?? "Voulez-vous continuer ?";
    cancel.textContent = settings.cancelLabel ?? "Annuler";
    confirm.textContent = settings.confirmLabel ?? "Confirmer";
    confirm.className = `btn px-4 ${danger ? "btn-danger" : "btn-theme"}`;

    if (confirmResolve) closeConfirm(false);
    return new Promise((resolve) => {
      confirmResolve = resolve;
      if (window.bootstrap?.Modal) {
        window.bootstrap.Modal.getOrCreateInstance(confirmElement).show();
        setTimeout(() => confirm.focus(), 200);
      } else {
        confirmElement.style.cssText = "inset:0;background:rgba(0,0,0,.45);display:block;z-index:1080;";
        confirmElement.classList.add("show");
      }
    });
  }

  async function loadOrderHistory() {
    const orders = list(await api.getCommandes());
    const now = new Date();
    const monthOrders = orders.filter((order) => {
      const dateValue = new Date(order.dateCommande);
      return dateValue.getFullYear() === now.getFullYear() && dateValue.getMonth() === now.getMonth();
    });
    const indicators = document.querySelectorAll("main .row.g-3.mb-4 .card-body h3");
    if (indicators.length >= 4) {
      indicators[0].textContent = String(monthOrders.length);
      indicators[1].textContent = String(orders.filter((order) => ["envoyee", "partielle"].includes(order.statut)).length);
      indicators[2].textContent = String(orders.filter((order) => order.statut === "brouillon").length);
      indicators[3].textContent = money(orders
        .filter((order) => !["recue", "annulee"].includes(order.statut))
        .reduce((sum, order) => sum + Number(order.montantTotal || 0), 0));
    }
    return orders;
  }

  function setupOrderHistory(orders, config) {
    const main = document.querySelector("main");
    const table = mainTable(0);
    if (!main || !table) return;
    const state = table._gescoOrderState ?? { orders: [], config, attached: false };
    state.orders = orders;
    state.config = config;
    table._gescoOrderState = state;
    const search = main.querySelector("#orders-search");
    const statusFilter = main.querySelector("#orders-status-filter");

    const render = () => {
      const query = String(search?.value ?? "").trim().toLocaleLowerCase("fr");
      const filtered = state.orders.filter((order) => {
        const searchable = `${order.reference} ${order.idFournisseurLabel ?? ""}`.toLocaleLowerCase("fr");
        return (!query || searchable.includes(query))
          && (!statusFilter?.value || order.statut === statusFilter.value);
      });
      renderTable(table, filtered, state.config.tables[0].columns, state.config);
      const count = main.querySelector("#orders-result-count");
      if (count) {
        count.textContent = `${filtered.length} commande${filtered.length === 1 ? "" : "s"} affichée${filtered.length === 1 ? "" : "s"} sur ${state.orders.length}`;
      }
    };

    if (!state.attached) {
      search?.addEventListener("input", render);
      statusFilter?.addEventListener("change", render);
      state.attached = true;
    }
    render();
  }

  const date = (value) => {
    if (!value) return "—";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? esc(value) : parsed.toLocaleDateString("fr-FR");
  };

  const apiPages = {
    "gesco-stock-produits.html": {
      tables: [{ load: api.getProduits, columns: [["Désignation", "designation"], ["Catégorie", "idCategorie"], ["Prix de vente", "prixVente", "money"], ["Stock", "stock"], ["Seuil", "seuilMinimum"], ["État", "stockState", "status"]] }],
      create: "produit",
    },
    "gesco-dashboard.html": {
      tables: [{
        load: api.getProduits,
        columns: [["Produit", "designation"], ["Catégorie", "idCategorie"], ["Stock", "stock"], ["Prix", "prixVente", "money"]],
      }],
    },
    "gesco-stock-nouveau-produit.html": {
      tables: [],
    },
    "gesco-approvisionnement-fournisseurs.html": {
      // La liste est rendue par gesco-fournisseurs.js, qui ajoute les
      // boutons Consulter / Modifier / Supprimer dans la colonne Actions.
      tables: [],
      create: "fournisseur",
    },
    "gesco-approvisionnement-fournisseur-detail.html": {
      // La fiche fournisseur est rendue par son propre script
      // (gesco-fournisseur-detail.js) : il affiche les commandes du fournisseur
      // avec leurs statuts et les produits commandés via /api/fournisseurs/:id/stats.
      tables: [],
    },
    "gesco-stock-produit-detail.html": {
      tables: [
        { load: async () => {
          const id = findId();
          if (!id) return [];
          return list(await api.getStockMovements()).filter((row) => row.idProduit === Number(id));
        }, columns: [["Date", "createdAt", "date"], ["Type", "type", "movementType"], ["Référence", "reference"], ["Quantité", "quantite", "quantity"], ["Motif", "motif"]] },
        { load: async () => {
          const id = findId();
          if (!id) return [];
          const productId = Number(id);
          const sales = list(await api.getVentes());
          const details = await Promise.all(sales.map((sale) => api.getVente(sale.id)));
          return details.flatMap((sale) => (sale.lignes ?? [])
            .filter((line) => line.idProduit === productId)
            .map((line) => ({ ...line, venteReference: sale.reference, idVente: sale.id, dateVente: sale.dateVente, idClient: sale.idClient })));
        }, columns: [["Vente", "venteReference"], ["Client", "idClient"], ["Date", "dateVente", "date"], ["Quantité", "quantite"], ["Montant", "montantTotal", "money"]] },
      ],
    },
    "gesco-approvisionnement-commandes.html": {
      tables: [{ load: loadOrderHistory, columns: [["N° commande", "reference"], ["Date", "dateCommande", "date"], ["Fournisseur", "idFournisseur"], ["Articles", "articleCount"], ["Montant", "montantTotal", "money"], ["Statut", "statut", "status"], ["Livraison prévue", "dateLivraisonPrevue", "date"]] }],
      create: "commande",
    },
    "gesco-approvisionnement-receptions.html": {
      key: "reception",
      tables: [{ load: api.getReceptions, columns: [["N° réception", "reference"], ["Date", "dateReception", "date"], ["Commande", "idCommandeLabel"], ["Fournisseur", "fournisseurNom"], ["Reçu / attendu", "quantiteRecue", "receptionProgress"], ["Statut", "receptionStatut", "receptionStatus"], ["Réceptionné par", "nomUtilisateur"]] }],
    },
    "gesco-stock-mouvements.html": {
      tables: [{ load: api.getStockMovements, columns: [["Date", "createdAt", "date"], ["Type", "type", "movementType"], ["Produit", "idProduit"], ["Quantité", "quantite", "quantity"], ["Référence", "reference"], ["Motif", "motif"]] }],
      create: "mouvement",
    },
    "gesco-stock-inventaires.html": {
      tables: [{ load: api.getInventories, columns: [["Titre de l'inventaire", "reference"], ["Date", "dateInventaire", "date"], ["Responsable", "responsable"], ["Comptage", "articlesComptes", "inventoryProgress"], ["Écarts", "ecarts"], ["Statut", "statut", "inventoryStatus"]] }],
      create: "inventaire",
    },
    "gesco-ventes.html": {
      key: "vente",
      tables: [{ load: loadSalesHistory, columns: [["N° vente", "reference"], ["Date", "dateVente", "date"], ["Client", "idClient"], ["Articles", "articleCount"], ["Total", "montantTotal", "money"], ["Paiement", "modePaiement", "paymentMethod"], ["Statut", "statut", "saleStatus"], ["Facture", "invoiceReference"]] }],
    },
    "gesco-ventes-detail.html": {
      tables: [{ load: async () => {
        const id = findId();
        if (!id) return [];
        const result = await api.getVente(id);
        const invoiceLink = document.querySelector('a[href="gesco-facturation-detail.html"]');
        if (invoiceLink) invoiceLink.href = `gesco-facturation-detail.html?venteId=${encodeURIComponent(result.id)}`;
        const deliveryLink = document.querySelector('a[href="gesco-livraison-detail.html"]');
        if (deliveryLink) deliveryLink.href = `gesco-livraison-detail.html?venteId=${encodeURIComponent(result.id)}`;
        if (typeof window.__hydrateVenteDetail === "function") {
          try { window.__hydrateVenteDetail(result); } catch (e) { console.error(e); }
        }
        return result.lignes ?? [];
      }, columns: [["Produit", "designation"], ["Quantité", "quantite"], ["Prix unitaire", "prixUnitaire", "money"], ["Montant", "montantTotal", "money"]] }],
    },
    "gesco-ventes-retours.html": {
      key: "retour",
      tables: [{ load: api.getRetours, columns: [["Type", "type", "returnType"], ["Référence", "reference"], ["Date", "date", "date"], ["Vente", "venteReference"], ["Motif", "motif"], ["Montant", "montant", "money"], ["Statut", "statut", "returnStatus"]] }],
      create: "retour",
    },
    "gesco-caisse-historique.html": {
      tables: [{ load: api.getFactures, columns: [["N° document", "reference"], ["Date", "dateFacture", "date"], ["Client", "idClient"], ["Total", "montantTotal", "money"], ["Payé", "montantPaye", "money"], ["Solde", "solde", "money"], ["Statut", "statut"]] }],
    },
    "gesco-facturation.html": {
      tables: [{ load: api.getFactures, columns: [["N° document", "reference"], ["Date", "dateFacture", "date"], ["Client", "idClient"], ["Total TTC", "montantTotal", "money"], ["Payé", "montantPaye", "money"], ["Solde", "solde", "money"], ["Statut", "statut"]] }],
      create: "facture",
    },
    "gesco-facturation-paiements.html": {
      tables: [
        { load: api.getPaiements, columns: [["Référence", "reference"], ["Date", "datePaiement", "date"], ["Facture", "idFacture"], ["Montant", "montant", "money"], ["Mode", "modePaiement"], ["Enregistré par", "idUtilisateur"]] },
        { load: api.getFactures, columns: [["Facture", "reference"], ["Client", "idClient"], ["Montant total", "montantTotal", "money"], ["Solde", "solde", "money"], ["Échéance", "dateEcheance", "date"]] },
      ],
      create: "paiement",
    },
    "gesco-administration.html": {
      tables: [
        { load: api.getUtilisateurs, columns: [["Utilisateur", "nomUtilisateur"], ["E-mail", "email"], ["Téléphone", "telephone"], ["Rôle", "role", "userRole"], ["État", "actif", "status"]] },
        { load: api.getJournalActivite, columns: [["Date", "createdAt", "date"], ["Utilisateur", "idUtilisateur"], ["Action", "action"], ["Détails", "details"]] },
      ],
      create: "utilisateur",
    },
  };

  const forms = {
    produit: {
      title: "Nouveau produit",
      method: api.createProduit,
      fields: [
        ["designation", "Désignation", "text", true],
        ["idCategorie", "Catégorie", "category", true],
        ["description", "Description", "textarea"],
        ["prixVente", "Prix de vente", "number", true],
        ["stockInitial", "Stock initial", "number"],
        ["seuilMinimum", "Seuil minimum", "number"],
        ["idFournisseur", "Fournisseur principal", "supplier"],
      ],
    },
    fournisseur: {
      title: "Nouveau fournisseur",
      method: api.createFournisseur,
      fields: [["nom", "Nom", "text", true], ["tel", "Téléphone"], ["email", "E-mail", "email"], ["adresse", "Adresse", "text"], ["nif", "NIF"]],
    },
    commande: {
      title: "Nouvelle commande fournisseur",
      method: api.createCommande,
      fields: [["idFournisseur", "Fournisseur", "supplier", true], ["dateLivraisonPrevue", "Livraison prévue", "date"]],
    },
    mouvement: {
      title: "Mouvement de stock",
      method: api.createStockMovement,
      fields: [["idProduit", "Produit", "product", true], ["type", "Type", "select", true, [["entree", "Entrée"], ["sortie", "Sortie"], ["perte", "Perte"]]], ["quantite", "Quantité", "number", true], ["motif", "Motif", "text"]],
    },
    inventaire: {
      title: "Nouvel inventaire",
      method: api.createInventory,
      fields: [["reference", "Titre de l'inventaire", "text", true], ["responsable", "Responsable", "text"]],
    },
    retour: {
      title: "Enregistrer un retour",
    },
    facture: {
      title: "Nouvelle facture",
      method: api.createFacture,
      fields: [["idClient", "Client", "client", true], ["dateEcheance", "Échéance", "date"], ["lignes", "Lignes (JSON : designation, quantite, prixUnitaire; idProduit facultatif)", "textarea", true]],
    },
    paiement: {
      title: "Enregistrer un paiement",
      fields: [["idFacture", "Facture concernée", "invoice", true], ["montant", "Montant", "number", true], ["modePaiement", "Mode de paiement", "select", true, [["especes", "Espèces"], ["mobile_money", "Mobile money"], ["carte", "Carte"], ["virement", "Virement"], ["cheque", "Chèque"]]], ["notes", "Note"]],
    },
    utilisateur: {
      title: "Nouvel utilisateur",
      method: api.createUtilisateur,
      fields: [["nomUtilisateur", "Nom d'utilisateur", "text", true], ["email", "E-mail", "email", true], ["telephone", "Téléphone"], ["motDePasse", "Mot de passe (8 caractères minimum)", "password", true], ["role", "Rôle", "select", true, [["admin", "Administrateur"], ["caissiere", "Caissière"], ["comptable", "Comptable"], ["user", "Utilisateur standard"]]]],
    },
    parametres: {
      title: "Paramètres de la boutique",
      method: api.saveParametres,
      fields: [["nom", "Nom", "text", true], ["adresse", "Adresse"], ["telephone", "Téléphone"], ["email", "E-mail", "email"], ["nif", "NIF"], ["devise", "Devise"], ["tauxTaxe", "Taux de taxe (%)", "number"], ["prefixeFacture", "Préfixe des factures"]],
    },
  };

  function mainTable(index) {
    const tables = Array.from(document.querySelectorAll("table.table.adminuiux-table, #dataTable"));
    return tables[index] ?? null;
  }

  function createButton(key, target) {
    const main = document.querySelector("main");
    if (!main) return;
    const title = forms[key].title;
    const actionLabels = {
      commande: ["Nouvelle commande"],
      mouvement: ["Nouveau mouvement"],
      retour: ["Nouveau retour"],
      paiement: ["Nouveau paiement"],
    };
    const labels = [title, ...(actionLabels[key] ?? [])];
    const existingAction = Array.from(main.querySelectorAll("a.btn, button.btn"))
      .find((element) => labels.some((label) => element.textContent.trim().includes(label)));
    if (existingAction) {
      if (key === "produit" && existingAction.matches('a[href*="gesco-stock-nouveau-produit"]')) return;
      existingAction.removeAttribute("data-bs-toggle");
      existingAction.removeAttribute("data-bs-target");
      existingAction.addEventListener("click", (event) => {
        event.preventDefault();
        showForm(key, target);
      });
      return;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-theme gesco-create-button";
    button.textContent = title;
    button.addEventListener("click", () => showForm(key, target));
    const toolbar = main.querySelector(".container-fluid > .row");
    const actions = toolbar?.querySelector(".col-auto");
    if (actions) actions.append(button);
    else if (toolbar) {
      const actionColumn = document.createElement("div");
      actionColumn.className = "col-auto";
      actionColumn.append(button);
      toolbar.append(actionColumn);
    } else {
      main.prepend(button);
    }
  }

  async function lookupOptions(kind) {
    if (kind === "category") {
      const result = await api.getCategories();
      return list(result).map((item) => [item.id, item.label]);
    }
    if (kind === "supplier") {
      return list(await api.getFournisseurs()).map((item) => [item.id, item.nom]);
    }
    if (kind === "product") {
      return list(await api.getProduits()).map((item) => [item.id, item.designation]);
    }
    if (kind === "client") {
      return list(await api.getClients()).map((item) => [item.id, item.nom]);
    }
    if (kind === "sale") {
      return list(await api.getVentes()).map((item) => [item.id, item.reference]);
    }
    if (kind === "invoice") {
      return list(await api.getFactures())
        .map((item) => ({ item, solde: invoiceBalance(item) }))
        .filter(({ item, solde }) => solde > 0 && !["deleted", "annulee"].includes(String(item.statut)))
        .map(({ item, solde }) => [item.id, `${item.reference} — reste ${money(solde)}`]);
    }
    return [];
  }

  function invoiceBalance(invoice) {
    return Math.max(0, Number(invoice?.montantTotal ?? 0) - Number(invoice?.montantPaye ?? 0));
  }

  async function invoiceBalanceMap() {
    const balances = new Map();
    for (const invoice of list(await api.getFactures())) {
      balances.set(String(invoice.id), invoiceBalance(invoice));
    }
    return balances;
  }

  async function showForm(key, target, editUser = null) {
    if (key === "commande") return showOrderForm(target);
    if (key === "retour") return showReturnForm(target);
    const definition = forms[key];
    const overlay = document.createElement("div");
    overlay.className = "gesco-modal-backdrop";
    overlay.setAttribute("role", "presentation");
    const panel = document.createElement("section");
    panel.className = "card adminuiux-card gesco-form-dialog shadow";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    const title = document.createElement("h2");
    title.className = "h5 mb-0";
    title.textContent = editUser ? "Modifier l'utilisateur" : definition.title;
    title.id = "gesco-form-title";
    panel.setAttribute("aria-labelledby", title.id);
    const header = document.createElement("div");
    header.className = "card-header d-flex align-items-center justify-content-between";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "btn-close";
    close.setAttribute("aria-label", "Fermer");
    close.addEventListener("click", () => overlay.remove());
    header.append(title, close);
    const form = document.createElement("form");
    form.className = "gesco-form";
    const error = document.createElement("div");
    error.className = "alert alert-danger d-none";
    const body = document.createElement("div");
    body.className = "card-body";
    body.append(error);
    if (key === "inventaire") {
      const guidance = document.createElement("p");
      guidance.className = "small text-secondary";
      guidance.textContent = "Les quantités théoriques sont reprises du stock enregistré pour chaque produit. Après sa création, le comptage s'ouvre automatiquement.";
      body.append(guidance);
    }
    try {
      for (const [name, label, type = "text", required = false, options] of definition.fields) {
        const fieldRequired = name === "motDePasse" && editUser ? false : required;
        const group = document.createElement("div");
        group.className = "mb-3";
        const caption = document.createElement("label");
        caption.className = "form-label";
        caption.htmlFor = `gesco-${name}`;
        caption.textContent = label;
        let input;
        if (type === "textarea") {
          input = document.createElement("textarea");
          input.rows = 3;
        } else if (type === "select" || type === "category" || type === "supplier" || type === "product" || type === "client" || type === "sale" || type === "invoice") {
          input = document.createElement("select");
          input.append(new Option("— Sélectionner —", ""));
          const selectOptions = options ?? await lookupOptions(type);
          selectOptions.forEach(([value, text]) => input.append(new Option(text, value)));
        } else {
          input = document.createElement("input");
          input.type = type;
          if (type === "number") {
            input.min = "0";
            input.step = "any";
          }
          if (type === "date") input.value = new Date().toISOString().slice(0, 10);
        }
        input.className = type === "select" || type === "category" || type === "supplier" || type === "product" || type === "client" || type === "sale" || type === "invoice"
          ? "form-select"
          : "form-control";
        input.id = `gesco-${name}`;
        input.name = name;
        input.required = fieldRequired;
        if (key === "inventaire" && name === "reference") {
          input.maxLength = 50;
          input.placeholder = "Ex. Inventaire du magasin — octobre";
        }
        if (key === "inventaire" && name === "responsable") {
          input.maxLength = 150;
          input.placeholder = "Ex. Kossi Adjo";
        }
        if (name === "motDePasse") input.autocomplete = "new-password";
        if (editUser && name !== "motDePasse" && editUser[name] !== undefined && editUser[name] !== null) {
          input.value = String(editUser[name]);
        }
        if (name === "motDePasse" && editUser) input.placeholder = "Laisser vide pour conserver le mot de passe actuel";
        if (type === "textarea" && name === "lignes") {
          input.placeholder = '[{"idProduit":1,"quantite":1,"prixUnitaire":1000}]';
          input.classList.add("font-monospace");
          input.setAttribute("aria-describedby", `gesco-${name}-help`);
          const help = document.createElement("div");
          help.className = "form-text";
          help.id = `gesco-${name}-help`;
          help.textContent = "Saisissez les lignes au format JSON indiqué, puis vérifiez les quantités et les prix.";
          group.append(caption, input, help);
        } else {
          group.append(caption, input);
        }
        body.append(group);
      }
    } catch (loadError) {
      error.textContent = loadError.message;
      error.classList.remove("d-none");
    }
    if (key === "paiement" && !editUser) {
      try {
        const invoiceSelect = body.querySelector('[name="idFacture"]');
        const amountInput = body.querySelector('[name="montant"]');
        const balances = await invoiceBalanceMap();
        const hint = document.createElement("div");
        hint.className = "form-text";
        hint.id = "gesco-payment-balance";
        invoiceSelect?.closest(".mb-3")?.append(hint);
        const refreshBalance = () => {
          const solde = balances.get(invoiceSelect?.value ?? "");
          hint.textContent = solde === undefined ? "" : `Solde restant à payer : ${money(solde)}`;
          if (solde === undefined) amountInput?.removeAttribute("max");
          else amountInput?.setAttribute("max", String(solde));
        };
        invoiceSelect?.addEventListener("change", refreshBalance);
        refreshBalance();
      } catch {
        /* l'indice de solde reste facultatif */
      }
    }
    const actions = document.createElement("div");
    actions.className = "card-footer d-flex justify-content-end gap-2";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn btn-outline-secondary";
    cancel.textContent = "Annuler";
    cancel.addEventListener("click", () => overlay.remove());
    const save = document.createElement("button");
    save.type = "submit";
    save.className = "btn btn-primary";
    save.textContent = key === "inventaire" ? "Suivant" : "Enregistrer";
    actions.append(cancel, save);
    form.append(body, actions);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.classList.add("d-none");
      save.disabled = true;
      let created;
      try {
        const data = {};
        for (const field of definition.fields) {
          const [name, , type] = field;
          const input = form.elements.namedItem(name);
          if (!input || !input.value) continue;
          if (type === "textarea" && name === "lignes") {
            data[name] = JSON.parse(input.value);
          } else if (type === "number" || type === "category" || type === "supplier" || type === "product" || type === "client" || type === "sale" || type === "invoice") {
            data[name] = Number(input.value);
          } else {
            data[name] = input.value;
          }
        }
        if (key === "paiement") {
          const { idFacture, ...payment } = data;
          await api.createPaiement(idFacture, payment);
        } else if (editUser) {
          await api.updateUtilisateur(editUser.id, data);
        } else {
          created = await definition.method(data);
        }
      } catch (submitError) {
        error.textContent = submitError.message || "Échec de l'enregistrement.";
        error.classList.remove("d-none");
        save.disabled = false;
        return;
      }
      overlay.remove();
      try {
        await loadPage(target);
      } catch (refreshError) {
        const alertBox = document.createElement("div");
        alertBox.className = "alert alert-warning";
        alertBox.setAttribute("role", "alert");
        alertBox.textContent = `Enregistrement effectué, mais la liste n'a pas pu être actualisée : ${refreshError.message || "erreur de chargement."}`;
        document.querySelector("main")?.prepend(alertBox);
      }
      if (key === "inventaire") {
        const createdId = created?.data?.id ?? created?.id;
        if (createdId) await openInventoryCount(createdId, target);
      }
    });
    panel.append(header, form);
    overlay.append(panel);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) overlay.remove();
    });
    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") overlay.remove();
    });
    document.body.append(overlay);
    form.querySelector("input, select, textarea")?.focus();
    return form;
  }

  async function showOrderForm(target) {
    const overlay = document.createElement("div");
    overlay.className = "gesco-modal-backdrop";
    overlay.setAttribute("role", "presentation");
    const panel = document.createElement("section");
    panel.className = "card adminuiux-card gesco-form-dialog shadow";
    panel.style.width = "min(70rem, 100%)";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "gesco-order-form-title");

    const title = document.createElement("h2");
    title.className = "h5 mb-0";
    title.id = "gesco-order-form-title";
    title.textContent = "Nouvelle commande fournisseur";
    const header = document.createElement("div");
    header.className = "card-header d-flex align-items-center justify-content-between";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "btn-close";
    close.setAttribute("aria-label", "Fermer");
    close.addEventListener("click", () => overlay.remove());
    header.append(title, close);

    const form = document.createElement("form");
    form.className = "gesco-form";
    const body = document.createElement("div");
    body.className = "card-body";
    const error = document.createElement("div");
    error.className = "alert alert-danger d-none";
    error.setAttribute("role", "alert");
    body.append(error);

    const [suppliers, products] = await Promise.all([api.getFournisseurs(), api.getProduits()]);
    const supplierList = list(suppliers);
    const productList = list(products);
    const supplierSelect = document.createElement("select");
    supplierSelect.className = "form-select";
    supplierSelect.required = true;
    supplierSelect.append(new Option("Sélectionner un fournisseur", ""));
    supplierList.forEach((supplier) => supplierSelect.append(new Option(supplier.nom, supplier.id)));
    const supplierLabel = document.createElement("label");
    supplierLabel.className = "form-label fw-semibold";
    supplierLabel.textContent = "Fournisseur";
    supplierLabel.append(supplierSelect);
    const deliveryInput = document.createElement("input");
    deliveryInput.className = "form-control";
    deliveryInput.type = "date";
    deliveryInput.min = new Date().toISOString().slice(0, 10);
    const deliveryLabel = document.createElement("label");
    deliveryLabel.className = "form-label";
    deliveryLabel.textContent = "Date de livraison prévue (facultative)";
    deliveryLabel.append(deliveryInput);
    const headerFields = document.createElement("div");
    headerFields.className = "row g-3 mb-4";
    const supplierColumn = document.createElement("div");
    supplierColumn.className = "col-md-7";
    supplierColumn.append(supplierLabel);
    const deliveryColumn = document.createElement("div");
    deliveryColumn.className = "col-md-5";
    deliveryColumn.append(deliveryLabel);
    headerFields.append(supplierColumn, deliveryColumn);
    body.append(headerFields);

    const linesTitle = document.createElement("h3");
    linesTitle.className = "h6 mb-2";
    linesTitle.textContent = "Produits à commander";
    const table = document.createElement("table");
    table.className = "table table-sm table-bordered align-middle";
    table.innerHTML = "<thead><tr><th>Produit</th><th style='width:110px'>Quantité</th><th style='width:180px'>Prix unitaire</th><th class='text-end' style='width:150px'>Total</th><th style='width:48px'></th></tr></thead>";
    const tableBody = document.createElement("tbody");
    table.append(tableBody);
    const lines = [];
    const total = document.createElement("strong");
    total.className = "fs-5";
    total.textContent = money(0);

    const updateTotal = () => {
      let amount = 0;
      lines.forEach((line) => {
        const lineTotal = Math.max(0, Number(line.quantity.value) || 0) * Math.max(0, Number(line.price.value) || 0);
        line.amount.textContent = money(lineTotal);
        amount += lineTotal;
      });
      total.textContent = money(amount);
    };

    const addLine = () => {
      const row = document.createElement("tr");
      const productCell = document.createElement("td");
      const productSelect = document.createElement("select");
      productSelect.className = "form-select form-select-sm";
      productSelect.required = true;
      productSelect.append(new Option("Sélectionner un produit", ""));
      productList.forEach((product) => {
        const stock = Number(product.stock ?? 0);
        const minimum = Number(product.seuilMinimum ?? 0);
        productSelect.append(new Option(
          `${product.designation} — Stock : ${stock} (minimum ${minimum})`,
          product.id,
        ));
      });
      productCell.append(productSelect);

      const quantityCell = document.createElement("td");
      const quantity = document.createElement("input");
      quantity.type = "number";
      quantity.className = "form-control form-control-sm";
      quantity.min = "1";
      quantity.step = "1";
      quantity.value = "1";
      quantity.required = true;
      quantityCell.append(quantity);

      const priceCell = document.createElement("td");
      const price = document.createElement("input");
      price.type = "number";
      price.className = "form-control form-control-sm text-end";
      price.min = "0";
      price.step = "1";
      price.required = true;
      priceCell.append(price);

      const amountCell = document.createElement("td");
      amountCell.className = "text-end text-nowrap";
      const removeCell = document.createElement("td");
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn btn-sm btn-outline-danger";
      remove.setAttribute("aria-label", "Retirer ce produit");
      remove.innerHTML = '<i class="bi bi-trash" aria-hidden="true"></i>';
      removeCell.append(remove);
      row.append(productCell, quantityCell, priceCell, amountCell, removeCell);
      tableBody.append(row);
      const line = { row, productSelect, quantity, price, amount: amountCell };
      lines.push(line);
      productSelect.addEventListener("change", () => {
        const selected = productList.find((product) => Number(product.id) === Number(productSelect.value));
        if (selected) price.value = "";
        updateTotal();
      });
      quantity.addEventListener("input", updateTotal);
      price.addEventListener("input", updateTotal);
      remove.addEventListener("click", () => {
        row.remove();
        lines.splice(lines.indexOf(line), 1);
        updateTotal();
      });
    };

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "btn btn-outline-primary btn-sm";
    addButton.innerHTML = '<i class="bi bi-plus-lg me-1" aria-hidden="true"></i> Ajouter un produit';
    addButton.disabled = true;
    addButton.addEventListener("click", addLine);
    supplierSelect.addEventListener("change", () => {
      addButton.disabled = !supplierSelect.value;
      if (supplierSelect.value && lines.length === 0) addLine();
    });
    const totalBar = document.createElement("div");
    totalBar.className = "d-flex justify-content-between align-items-center border-top pt-3 mt-3";
    const totalLabel = document.createElement("span");
    totalLabel.className = "text-secondary";
    totalLabel.textContent = "Total de la commande";
    totalBar.append(totalLabel, total);

    const notes = document.createElement("textarea");
    notes.className = "form-control mt-3";
    notes.rows = 2;
    notes.placeholder = "Note ou instruction au fournisseur (facultatif)";
    const notesLabel = document.createElement("label");
    notesLabel.className = "form-label mt-3";
    notesLabel.textContent = "Notes";
    notesLabel.append(notes);

    body.append(linesTitle, table, addButton, totalBar, notesLabel);
    const actions = document.createElement("div");
    actions.className = "card-footer d-flex justify-content-end gap-2";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn btn-outline-secondary";
    cancel.textContent = "Annuler";
    cancel.addEventListener("click", () => overlay.remove());
    const save = document.createElement("button");
    save.type = "submit";
    save.className = "btn btn-primary";
    save.textContent = "Créer la commande";
    actions.append(cancel, save);
    form.append(body, actions);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.classList.add("d-none");
      const productIds = lines.map((line) => Number(line.productSelect.value));
      if (!supplierSelect.value) {
        error.textContent = "Sélectionnez un fournisseur.";
        error.classList.remove("d-none");
        return;
      }
      if (lines.length === 0 || lines.some((line) => !line.productSelect.value || !line.quantity.value || !line.price.value)) {
        error.textContent = "Ajoutez au moins un produit et complétez sa quantité et son prix.";
        error.classList.remove("d-none");
        return;
      }
      if (productIds.some((id) => !Number.isSafeInteger(id) || id <= 0) || new Set(productIds).size !== productIds.length) {
        error.textContent = "Chaque produit doit apparaître une seule fois dans la commande.";
        error.classList.remove("d-none");
        return;
      }
      save.disabled = true;
      try {
        await api.createCommande({
          idFournisseur: Number(supplierSelect.value),
          dateLivraisonPrevue: deliveryInput.value || undefined,
          notes: notes.value.trim() || undefined,
          lignes: lines.map((line) => {
            const product = productList.find((item) => Number(item.id) === Number(line.productSelect.value));
            return {
              idProduit: Number(line.productSelect.value),
              designation: product.designation,
              quantite: Number(line.quantity.value),
              prixUnitaire: Number(line.price.value),
            };
          }),
        });
        overlay.remove();
        await loadPage(target);
      } catch (submitError) {
        error.textContent = submitError.message || "Échec de la création de la commande.";
        error.classList.remove("d-none");
        save.disabled = false;
      }
    });

    panel.append(header, form);
    overlay.append(panel);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) overlay.remove();
    });
    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") overlay.remove();
    });
    document.body.append(overlay);
    supplierSelect.focus();
    return form;
  }

  async function showReceptionForm(orderId, target) {
    const order = await api.getCommande(orderId);
    const orderLines = list(order.lignes);
    const overlay = document.createElement("div");
    overlay.className = "gesco-modal-backdrop";
    overlay.setAttribute("role", "presentation");
    const panel = document.createElement("section");
    panel.className = "card adminuiux-card gesco-form-dialog shadow";
    panel.style.width = "min(60rem, 100%)";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "gesco-reception-form-title");

    const title = document.createElement("h2");
    title.className = "h5 mb-0";
    title.id = "gesco-reception-form-title";
    title.textContent = `Réception — ${order.reference}`;
    const header = document.createElement("div");
    header.className = "card-header d-flex align-items-center justify-content-between";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "btn-close";
    close.setAttribute("aria-label", "Fermer");
    close.addEventListener("click", () => overlay.remove());
    header.append(title, close);

    const form = document.createElement("form");
    form.className = "gesco-form";
    form.noValidate = true;
    const body = document.createElement("div");
    body.className = "card-body";
    const error = document.createElement("div");
    error.className = "alert alert-danger d-none";
    error.setAttribute("role", "alert");
    body.append(error);

    const supplier = order.fournisseur?.nom ?? order.idFournisseurLabel ?? "—";
    let infoText = `Fournisseur : ${supplier}`;
    if (order.dateLivraisonPrevue) infoText += ` · Livraison prévue : ${date(order.dateLivraisonPrevue)}`;
    const info = document.createElement("p");
    info.className = "small text-secondary mb-3";
    info.textContent = infoText;
    body.append(info);

    const table = document.createElement("table");
    table.className = "table table-sm table-bordered align-middle";
    table.innerHTML = "<thead><tr><th>Produit</th><th class='text-center' style='width:110px'>Commandé</th><th class='text-center' style='width:110px'>Déjà reçu</th><th class='text-center' style='width:90px'>Reste</th><th style='width:150px'>Qté à recevoir</th></tr></thead>";
    const tableBody = document.createElement("tbody");
    table.append(tableBody);
    const inputs = [];
    orderLines.forEach((line) => {
      const commande = Number(line.quantite || 0);
      const recue = Number(line.quantiteRecue || 0);
      const reste = Math.max(0, commande - recue);
      const row = document.createElement("tr");
      const productCell = document.createElement("td");
      productCell.textContent = line.designation || `Produit ${line.idProduit}`;
      const commandeCell = document.createElement("td");
      commandeCell.className = "text-center";
      commandeCell.textContent = String(commande);
      const recueCell = document.createElement("td");
      recueCell.className = "text-center";
      recueCell.textContent = String(recue);
      const resteCell = document.createElement("td");
      resteCell.className = "text-center fw-medium";
      resteCell.textContent = String(reste);
      const inputCell = document.createElement("td");
      const input = document.createElement("input");
      input.type = "number";
      input.className = "form-control form-control-sm";
      input.min = "0";
      input.max = String(reste);
      input.step = "1";
      input.value = reste > 0 ? String(reste) : "0";
      input.disabled = reste === 0;
      inputCell.append(input);
      row.append(productCell, commandeCell, recueCell, resteCell, inputCell);
      tableBody.append(row);
      inputs.push({ line, input, reste });
    });
    body.append(table);

    const notes = document.createElement("textarea");
    notes.className = "form-control mt-3";
    notes.rows = 2;
    notes.placeholder = "Note de réception (facultatif)";
    const notesLabel = document.createElement("label");
    notesLabel.className = "form-label mt-3";
    notesLabel.textContent = "Notes";
    notesLabel.append(notes);
    body.append(notesLabel);

    const actions = document.createElement("div");
    actions.className = "card-footer d-flex justify-content-end gap-2";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn btn-outline-secondary";
    cancel.textContent = "Annuler";
    cancel.addEventListener("click", () => overlay.remove());
    const save = document.createElement("button");
    save.type = "submit";
    save.className = "btn btn-primary";
    save.textContent = "Valider la réception";
    actions.append(cancel, save);
    form.append(body, actions);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.classList.add("d-none");
      const lignes = [];
      let invalid = false;
      inputs.forEach(({ line, input, reste }) => {
        if (input.disabled || input.value === "") return;
        const qte = Number(input.value);
        if (!Number.isSafeInteger(qte) || qte < 0 || qte > reste) {
          invalid = true;
          return;
        }
        if (qte > 0) lignes.push({ idLigneCommande: line.id, quantiteRecue: qte });
      });
      if (invalid) {
        error.textContent = "Les quantités doivent être des entiers compris entre 0 et le reste à recevoir.";
        error.classList.remove("d-none");
        return;
      }
      if (lignes.length === 0) {
        error.textContent = "Saisissez au moins une quantité à recevoir.";
        error.classList.remove("d-none");
        return;
      }
      save.disabled = true;
      try {
        await api.receiveCommande(orderId, { lignes, notes: notes.value.trim() || undefined });
        overlay.remove();
        await loadPage(target);
      } catch (submitError) {
        error.textContent = submitError.message || "Échec de la réception.";
        error.classList.remove("d-none");
        save.disabled = false;
      }
    });

    panel.append(header, form);
    overlay.append(panel);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) overlay.remove();
    });
    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") overlay.remove();
    });
    document.body.append(overlay);
    return form;
  }

  async function showReturnForm(target) {
    const overlay = document.createElement("div");
    overlay.className = "gesco-modal-backdrop";
    overlay.setAttribute("role", "presentation");
    const panel = document.createElement("section");
    panel.className = "card adminuiux-card gesco-form-dialog shadow";
    panel.style.width = "min(70rem, 100%)";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "gesco-return-form-title");

    const title = document.createElement("h2");
    title.className = "h5 mb-0";
    title.id = "gesco-return-form-title";
    title.textContent = "Enregistrer un retour";
    const header = document.createElement("div");
    header.className = "card-header d-flex align-items-center justify-content-between";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "btn-close";
    close.setAttribute("aria-label", "Fermer");
    close.addEventListener("click", () => overlay.remove());
    header.append(title, close);

    const form = document.createElement("form");
    form.className = "gesco-form";
    const body = document.createElement("div");
    body.className = "card-body";
    const error = document.createElement("div");
    error.className = "alert alert-danger d-none";
    error.setAttribute("role", "alert");
    body.append(error);

    const [salesResult, clientsResult] = await Promise.all([api.getVentes(), api.getClients()]);
    const clientNames = new Map(list(clientsResult).map((client) => [Number(client.id), client.nom]));
    const sales = list(salesResult).filter((sale) => sale.statut !== "annulee");

    const saleSelect = document.createElement("select");
    saleSelect.className = "form-select";
    saleSelect.required = true;
    saleSelect.append(new Option("Sélectionner une vente", ""));
    sales.forEach((sale) => {
      const date = sale.dateVente ? new Date(sale.dateVente).toLocaleDateString("fr-FR") : "";
      const client = sale.idClient ? (clientNames.get(Number(sale.idClient)) ?? "Client comptoir") : "Client comptoir";
      saleSelect.append(new Option(`${sale.reference} — ${client} — ${date} — ${money(sale.montantTotal)}`, sale.id));
    });
    const saleLabel = document.createElement("label");
    saleLabel.className = "form-label fw-semibold";
    saleLabel.textContent = "Vente concernée";
    saleLabel.append(saleSelect);
    body.append(saleLabel);

    const linesTitle = document.createElement("h3");
    linesTitle.className = "h6 mb-2 mt-4";
    linesTitle.textContent = "Produits à retourner";
    const table = document.createElement("table");
    table.className = "table table-sm table-bordered align-middle";
    table.innerHTML = "<thead><tr><th>Produit</th><th class='text-center' style='width:110px'>Qté vendue</th><th class='text-center' style='width:120px'>Déjà retourné</th><th style='width:150px'>Qté à retourner</th><th class='text-end' style='width:150px'>Montant</th></tr></thead>";
    const tableBody = document.createElement("tbody");
    table.append(tableBody);
    const emptyMessage = "Sélectionnez une vente pour afficher ses produits.";
    const setEmpty = (message) => {
      tableBody.innerHTML = "";
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.className = "text-center text-secondary py-4";
      cell.textContent = message;
      row.append(cell);
      tableBody.append(row);
    };
    setEmpty(emptyMessage);

    const lines = [];
    const total = document.createElement("strong");
    total.className = "fs-5";
    total.textContent = money(0);

    const updateTotal = () => {
      let amount = 0;
      lines.forEach((line) => {
        const qty = Math.max(0, Number(line.quantity.value) || 0);
        const lineTotal = qty * line.unitPrice;
        line.amount.textContent = money(lineTotal);
        amount += lineTotal;
      });
      total.textContent = money(amount);
    };

    const renderLines = (saleLines) => {
      lines.length = 0;
      tableBody.innerHTML = "";
      if (!saleLines.length) {
        setEmpty("Cette vente ne contient aucune ligne.");
        updateTotal();
        return;
      }
      saleLines.forEach((saleLine) => {
        const restante = Number(saleLine.quantiteRestante ?? saleLine.quantite ?? 0);
        const row = document.createElement("tr");

        const productCell = document.createElement("td");
        productCell.textContent = saleLine.designation;

        const soldCell = document.createElement("td");
        soldCell.className = "text-center";
        soldCell.textContent = String(saleLine.quantite);

        const returnedCell = document.createElement("td");
        returnedCell.className = "text-center";
        returnedCell.textContent = String(saleLine.quantiteRetournee ?? 0);

        const qtyCell = document.createElement("td");
        const quantity = document.createElement("input");
        quantity.type = "number";
        quantity.className = "form-control form-control-sm";
        quantity.min = "0";
        quantity.max = String(restante);
        quantity.step = "1";
        quantity.value = "0";
        quantity.disabled = restante <= 0;
        qtyCell.append(quantity);
        if (restante <= 0) qtyCell.append(Object.assign(document.createElement("small"), { className: "text-secondary", textContent: "Déjà tout retourné" }));

        const amountCell = document.createElement("td");
        amountCell.className = "text-end text-nowrap";
        amountCell.textContent = money(0);

        row.append(productCell, soldCell, returnedCell, qtyCell, amountCell);
        tableBody.append(row);

        const line = { idLigneVente: saleLine.id, unitPrice: Number(saleLine.prixUnitaire), quantity, amount: amountCell, restante };
        quantity.addEventListener("input", () => {
          let value = Math.floor(Number(quantity.value) || 0);
          if (value < 0) value = 0;
          if (value > restante) value = restante;
          quantity.value = String(value);
          updateTotal();
        });
        lines.push(line);
      });
      updateTotal();
    };

    const totalBar = document.createElement("div");
    totalBar.className = "d-flex justify-content-between align-items-center border-top pt-3 mt-3";
    const totalLabel = document.createElement("span");
    totalLabel.className = "text-secondary";
    totalLabel.textContent = "Montant à rembourser";
    totalBar.append(totalLabel, total);

    const motif = document.createElement("textarea");
    motif.className = "form-control";
    motif.rows = 2;
    motif.required = true;
    motif.placeholder = "Motif du retour (ex : produit défectueux, erreur de commande...)";
    const motifLabel = document.createElement("label");
    motifLabel.className = "form-label mt-3";
    motifLabel.textContent = "Motif";
    motifLabel.append(motif);

    body.append(linesTitle, table, totalBar, motifLabel);

    saleSelect.addEventListener("change", async () => {
      error.classList.add("d-none");
      lines.length = 0;
      if (!saleSelect.value) {
        setEmpty(emptyMessage);
        updateTotal();
        return;
      }
      setEmpty("Chargement des produits…");
      try {
        const result = await api.getVenteRetournable(Number(saleSelect.value));
        renderLines(list(result?.lignes ?? result));
      } catch (loadError) {
        setEmpty("Impossible de charger les produits de cette vente.");
        error.textContent = loadError.message || "Impossible de charger les produits de cette vente.";
        error.classList.remove("d-none");
      }
    });

    const actions = document.createElement("div");
    actions.className = "card-footer d-flex justify-content-end gap-2";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn btn-outline-secondary";
    cancel.textContent = "Annuler";
    cancel.addEventListener("click", () => overlay.remove());
    const save = document.createElement("button");
    save.type = "submit";
    save.className = "btn btn-primary";
    save.textContent = "Enregistrer le retour";
    actions.append(cancel, save);
    form.append(body, actions);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.classList.add("d-none");
      if (!saleSelect.value) {
        error.textContent = "Sélectionnez la vente concernée.";
        error.classList.remove("d-none");
        return;
      }
      const selected = lines
        .map((line) => ({ idLigneVente: line.idLigneVente, quantite: Math.floor(Number(line.quantity.value) || 0) }))
        .filter((line) => line.quantite > 0);
      if (!selected.length) {
        error.textContent = "Indiquez au moins une quantité à retourner.";
        error.classList.remove("d-none");
        return;
      }
      if (!motif.value.trim()) {
        error.textContent = "Renseignez le motif du retour.";
        error.classList.remove("d-none");
        return;
      }
      save.disabled = true;
      try {
        await api.createRetour({ idVente: Number(saleSelect.value), motif: motif.value.trim(), lignes: selected });
        overlay.remove();
        await loadPage(target);
      } catch (submitError) {
        error.textContent = submitError.message || "Échec de l'enregistrement du retour.";
        error.classList.remove("d-none");
        save.disabled = false;
      }
    });

    panel.append(header, form);
    overlay.append(panel);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) overlay.remove();
    });
    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") overlay.remove();
    });
    document.body.append(overlay);
    saleSelect.focus();
    return form;
  }

  const referenceSources = {
    idCategorie: [api.getCategories, "label"],
    idFournisseur: [api.getFournisseurs, "nom"],
    idClient: [api.getClients, "nom"],
    idUtilisateur: [api.getUtilisateurs, "nomUtilisateur"],
    idProduit: [api.getProduits, "designation"],
    idCommande: [api.getCommandes, "reference"],
    idVente: [api.getVentes, "reference"],
    idFacture: [api.getFactures, "reference"],
  };
  const referenceCache = new Map();

  async function loadReferenceMap(key) {
    if (!referenceCache.has(key)) {
      const [loader, labelField] = referenceSources[key];
      const promise = Promise.resolve()
        .then(() => loader())
        .then((result) => new Map(list(result).map((item) => [String(item.id), item[labelField] ?? item.id])))
        .catch((error) => {
          referenceCache.delete(key);
          throw error;
        });
      referenceCache.set(key, promise);
    }
    return referenceCache.get(key);
  }

  async function resolveReferences(rows, columns) {
    const keys = [...new Set(columns.map(([, key]) => key).filter((key) => referenceSources[key]))];
    const maps = await Promise.all(keys.map(async (key) => [key, await loadReferenceMap(key)]));
    const references = new Map(maps);
    return rows.map((row) => {
      const resolved = { ...row };
      references.forEach((labels, key) => {
        if (resolved[key] !== null && resolved[key] !== undefined) {
          resolved[`${key}Label`] = labels.get(String(resolved[key])) ?? resolved[key];
        }
      });
      if ("stock" in resolved) {
        const stock = Number(resolved.stock ?? 0);
        const threshold = Number(resolved.seuilMinimum ?? 0);
        resolved.stockState = stock <= 0 ? "Rupture" : stock <= threshold ? "Stock faible" : "En stock";
      }
      return resolved;
    });
  }

  function normalize(record, key, formatter) {
    let value = record[key];
    if (referenceSources[key]) value = record[`${key}Label`] ?? value;
    if (key === "solde") value = Number(record.montantTotal || 0) - Number(record.montantPaye || 0);
    if (key === "idClient") value = record.idClientLabel ?? value ?? "Client comptoir";
    if (key === "actif") value = value ? "Actif" : "Inactif";
    if (key === "details" && value && typeof value === "object") value = JSON.stringify(value);
    if (formatter === "money") return money(value);
    if (formatter === "date") return date(value);
    if (formatter === "paymentMethod") {
      return ({
        especes: "Espèces",
        mobile_money: "Mobile Money",
        carte: "Carte",
        virement: "Virement",
        cheque: "Chèque",
      })[value] ?? (value ? esc(value) : "—");
    }
    if (formatter === "status") {
      return ({
        brouillon: "Brouillon",
        envoyee: "Envoyée",
        partielle: "Partiellement reçue",
        recue: "Reçue",
        annulee: "Annulée",
        confirme: "Confirmé",
      })[value] ?? (value ? esc(value) : "—");
    }
    if (formatter === "userRole") {
      const labels = { admin: "Administrateur", caissiere: "Caissière", comptable: "Comptable", user: "Utilisateur standard" };
      return labels[value] ?? (value ? esc(value) : "—");
    }
    if (formatter === "saleStatus") {
      return ({
        payee: "Payée",
        partiellement_payee: "Partiellement payée",
        annulee: "Annulée",
      })[value] ?? (value ? esc(value) : "—");
    }
    if (formatter === "returnType") {
      return ({ retour: "Retour", annulation: "Annulation" })[value] ?? (value ? esc(value) : "—");
    }
    if (formatter === "returnStatus") {
      return ({
        en_attente: "En attente",
        rembourse: "Remboursé",
        echange: "Échangé",
        refuse: "Refusé",
        annulee: "Annulée",
        confirme: "Confirmé",
      })[value] ?? (value ? esc(value) : "—");
    }
    if (formatter === "receptionProgress") {
      return `${Number(record.quantiteRecue || 0)} / ${Number(record.quantiteAttendue || 0)}`;
    }
    if (formatter === "receptionStatus") {
      return ({ complete: "Complète", partielle: "Partielle" })[value] ?? (value ? esc(value) : "—");
    }
    if (formatter === "inventoryStatus") {
      return ({ en_cours: "En cours", termine: "Validé", annule: "Annulé" })[value] ?? (value ? esc(value) : "—");
    }
    if (key === "articleCount") return `${Number(value || 0)} article${Number(value || 0) === 1 ? "" : "s"}`;
    if (formatter === "movementType") {
      return ({
        stock_initial: "Stock initial",
        entree: "Entrée",
        reception: "Réception",
        retour: "Retour client",
        vente: "Vente",
        sortie: "Sortie",
        perte: "Perte",
        casse: "Casse",
        vol: "Vol",
        ajustement_positif: "Ajustement positif",
        ajustement_negatif: "Ajustement négatif",
        annulation_vente: "Annulation de vente",
      })[value] ?? (value ? String(value).replaceAll("_", " ") : "—");
    }
    if (formatter === "quantity") {
      const quantity = Number(value);
      return Number.isFinite(quantity) && quantity > 0 ? `+${quantity}` : esc(value ?? "—");
    }
    return value === null || value === undefined || value === "" ? "—" : esc(value);
  }

  function renderTable(table, rows, columns, target) {
    if (!table) return;
    const body = table.tBodies[0];
    if (!body) return;
    const headers = Array.from(table.tHead?.rows[0]?.cells ?? []);
    const hasActions = headers.length > 0
      && headers[headers.length - 1].textContent.toLocaleLowerCase("fr").includes("action");
    const dataColumnCount = hasActions ? headers.length - 1 : Math.max(headers.length, columns.length);
    body.replaceChildren();
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      columns.slice(0, dataColumnCount).forEach(([, key, formatter], index) => {
        const td = document.createElement("td");
        const header = headers[index];
        if (header?.className) td.className = header.className;
        if (formatter === "inventoryProgress") {
          const counted = Number(row.articlesComptes || 0);
          const total = Number(row.lignesTotal || 0);
          td.classList.add("text-center");
          td.textContent = `${counted} / ${total}`;
          td.setAttribute("aria-label", `${counted} article${counted === 1 ? "" : "s"} compté${counted === 1 ? "" : "s"} sur ${total}`);
        } else if (formatter === "status" || formatter === "movementType" || formatter === "saleStatus" || formatter === "returnStatus" || formatter === "receptionStatus" || formatter === "inventoryStatus") {
          const badge = document.createElement("span");
          const statusClasses = {
            "En stock": "text-bg-success",
            "Stock faible": "text-bg-warning",
            "Rupture": "text-bg-danger",
            "Actif": "text-bg-success",
            "Inactif": "text-bg-secondary",
            "ouverte": "text-bg-success",
            "cloturee": "text-bg-secondary",
            "payee": "text-bg-success",
            "partiellement_payee": "text-bg-warning",
            "impayee": "text-bg-danger",
            "Stock initial": "text-bg-theme-1",
            "Entrée": "text-bg-success",
            "Réception": "text-bg-success",
            "Retour client": "text-bg-success",
            "Vente": "text-bg-theme-1",
            "Sortie": "text-bg-theme-1",
            "Perte": "text-bg-danger",
            "Ajustement positif": "text-bg-success",
            "Ajustement négatif": "text-bg-warning",
            "Annulation de vente": "text-bg-info",
            "Payée": "text-bg-success",
            "Partiellement payée": "text-bg-warning",
            "Annulée": "text-bg-danger",
            "Brouillon": "text-bg-secondary",
            "Envoyée": "text-bg-primary",
            "Partiellement reçue": "text-bg-warning",
            "Reçue": "text-bg-success",
            "Confirmé": "text-bg-success",
            "En attente": "text-bg-warning",
            "Remboursé": "text-bg-success",
            "Échangé": "text-bg-primary",
            "Refusé": "text-bg-danger",
            "Complète": "text-bg-success",
            "Partielle": "text-bg-warning",
            "En cours": "text-bg-warning",
            "Validé": "text-bg-success",
            "Annulé": "text-bg-danger",
          };
          const label = normalize(row, key, formatter);
          badge.className = `badge badge-light ${statusClasses[label] ?? "text-bg-secondary"}`;
          badge.textContent = label;
          td.append(badge);
        } else if (formatter === "quantity") {
          const quantity = Number(row[key]);
          td.classList.add("fw-bold", quantity > 0 ? "text-success" : quantity < 0 ? "text-danger" : "text-secondary");
          td.textContent = normalize(row, key, formatter);
        } else if (key === "invoiceReference" && row.id) {
          const link = document.createElement("a");
          link.href = row.idFacture
            ? `gesco-facturation-detail.html?id=${encodeURIComponent(row.idFacture)}`
            : `gesco-facturation-detail.html?venteId=${encodeURIComponent(row.id)}`;
          link.textContent = normalize(row, key, formatter);
          td.append(link);
        } else if (key === "venteReference" && row.idVente) {
          const link = document.createElement("a");
          link.href = `gesco-ventes-detail.html?id=${encodeURIComponent(row.idVente)}`;
          link.textContent = normalize(row, key, formatter);
          td.append(link);
        } else if (target.key === "produit" && key === "designation") {
          const product = document.createElement("div");
          product.className = "d-flex align-items-center gap-2";
          const icon = document.createElement("span");
          icon.className = "avatar avatar-32 rounded bg-theme-1-subtle text-theme-1 d-flex align-items-center justify-content-center";
          icon.innerHTML = '<i class="bi bi-box-seam" aria-hidden="true"></i>';
          const name = document.createElement("span");
          name.className = "fw-medium";
          name.textContent = normalize(row, key, formatter);
          product.append(icon, name);
          td.append(product);
        } else {
          td.textContent = normalize(row, key, formatter);
        }
        tr.append(td);
      });
      while (tr.cells.length < dataColumnCount) tr.append(document.createElement("td"));
      const actions = document.createElement("td");
      actions.className = "text-end text-nowrap";
      const openPath = target.detail;
      if (openPath && row.id) {
        const open = document.createElement("a");
        open.className = "btn btn-sm btn-square btn-link";
        open.href = `${openPath}?id=${encodeURIComponent(row.id)}`;
        open.title = "Consulter";
        open.setAttribute("aria-label", "Consulter");
        open.innerHTML = '<i class="bi bi-eye" aria-hidden="true"></i>';
        actions.append(open);
      }
      if (target.key === "commande" && row.id && ["envoyee", "partielle"].includes(row.statut)) {
        const receive = document.createElement("button");
        receive.type = "button";
        receive.className = "btn btn-sm btn-outline-success ms-1";
        receive.textContent = "Réceptionner";
        receive.addEventListener("click", () => showReceptionForm(row.id, target));
        actions.append(receive);
      }
      if (target.key === "reception" && row.idCommande) {
        const open = document.createElement("a");
        open.className = "btn btn-sm btn-square btn-link";
        open.href = `gesco-approvisionnement-commande-detail.html?id=${encodeURIComponent(row.idCommande)}`;
        open.title = "Voir la commande";
        open.setAttribute("aria-label", "Voir la commande");
        open.innerHTML = '<i class="bi bi-eye" aria-hidden="true"></i>';
        actions.append(open);
      }
      if (target.key === "retour" && row.type === "retour" && row.statut === "en_attente" && row.id) {
        [["rembourse", "Rembourser", "btn-outline-success"], ["echange", "Échanger", "btn-outline-primary"], ["refuse", "Refuser", "btn-outline-danger"]]
          .forEach(([statut, label, variant]) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `btn btn-sm ${variant} ms-1`;
            button.textContent = label;
            button.addEventListener("click", async () => {
              if (!(await confirmAction({
                title: `${label} le retour`,
                message: `Confirmez-vous « ${label.toLowerCase()} » pour le retour ${row.reference} ?`,
                confirmLabel: label,
                tone: statut === "refuse" ? "danger" : "primary",
              }))) return;
              try {
                await api.setRetourStatut(row.id, statut);
                await loadPage(target);
              } catch (error) {
                window.alert(error.message);
              }
            });
            actions.append(button);
          });
      }
      if (target.key === "retour" && row.type === "annulation" && row.idVente) {
        const open = document.createElement("a");
        open.className = "btn btn-sm btn-square btn-link";
        open.href = `gesco-ventes-detail.html?id=${encodeURIComponent(row.idVente)}`;
        open.title = "Voir la vente";
        open.setAttribute("aria-label", "Voir la vente");
        open.innerHTML = '<i class="bi bi-eye" aria-hidden="true"></i>';
        actions.append(open);
      }
      if (target.key === "vente" && row.statut !== "annulee" && row.id) {
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "btn btn-sm btn-square btn-link text-danger";
        cancel.title = "Annuler la vente";
        cancel.setAttribute("aria-label", "Annuler la vente");
        cancel.innerHTML = '<i class="bi bi-x-circle" aria-hidden="true"></i>';
        cancel.addEventListener("click", async () => {
          if (!(await confirmAction({
            title: "Annuler la vente",
            message: `La vente ${row.reference} sera annulée. Cette action est définitive.`,
            confirmLabel: "Annuler la vente",
            tone: "danger",
          }))) return;
          try {
            await api.cancelVente(row.id);
            await loadPage(target);
          } catch (error) {
            window.alert(error.message);
          }
        });
        actions.append(cancel);
      }
      if (target.key === "utilisateur" && row.id) {
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "btn btn-sm btn-square btn-link";
        edit.title = "Modifier l'utilisateur";
        edit.setAttribute("aria-label", "Modifier l'utilisateur");
        edit.innerHTML = '<i class="bi bi-pencil" aria-hidden="true"></i>';
        edit.addEventListener("click", () => showForm("utilisateur", target, row));
        actions.append(edit);

        const active = Boolean(row.actif);
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = `btn btn-sm btn-square btn-link ${active ? "text-danger" : "text-success"}`;
        toggle.title = active ? "Désactiver l'utilisateur" : "Réactiver l'utilisateur";
        toggle.setAttribute("aria-label", toggle.title);
        toggle.innerHTML = `<i class="bi ${active ? "bi-person-x" : "bi-person-check"}" aria-hidden="true"></i>`;
        toggle.addEventListener("click", async () => {
          const action = active ? "désactiver" : "réactiver";
          if (!(await confirmAction({
            title: active ? "Désactiver le compte" : "Réactiver le compte",
            message: `Voulez-vous ${action} le compte de ${row.nomUtilisateur} ?`,
            confirmLabel: active ? "Désactiver" : "Réactiver",
            tone: active ? "danger" : "primary",
          }))) return;
          try {
            await api.updateUtilisateur(row.id, { actif: !active });
            await loadPage(target);
          } catch (error) {
            window.alert(error.message || "Impossible de modifier le compte.");
          }
        });
        actions.append(toggle);
      }
      if (target.key === "inventaire" && row.id) {
        const count = document.createElement("button");
        count.type = "button";
        count.className = "btn btn-sm btn-square btn-link";
        count.title = row.statut === "en_cours" ? "Compter les articles" : "Consulter l'inventaire";
        count.setAttribute("aria-label", count.title);
        count.innerHTML = row.statut === "en_cours"
          ? '<i class="bi bi-clipboard-check" aria-hidden="true"></i>'
          : '<i class="bi bi-eye" aria-hidden="true"></i>';
        count.addEventListener("click", () => openInventoryCount(row.id, target));
        actions.append(count);

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "btn btn-sm btn-square btn-link text-danger";
        remove.title = "Supprimer l'inventaire";
        remove.setAttribute("aria-label", "Supprimer l'inventaire");
        remove.innerHTML = '<i class="bi bi-trash" aria-hidden="true"></i>';
        remove.addEventListener("click", async () => {
          const message = row.statut === "termine"
            ? `Les ajustements de stock appliqués par l'inventaire ${row.reference} seront annulés.`
            : `L'inventaire ${row.reference} et son comptage seront supprimés.`;
          if (!(await confirmAction({
            title: "Supprimer l'inventaire",
            message,
            confirmLabel: "Supprimer",
            tone: "danger",
          }))) return;
          remove.disabled = true;
          try {
            await api.deleteInventory(row.id);
            await loadPage(target);
          } catch (error) {
            remove.disabled = false;
            window.alert(error.message || "Impossible de supprimer l'inventaire.");
          }
        });
        actions.append(remove);
      }
      if (hasActions) tr.append(actions);
      body.append(tr);
    });
    if (rows.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = headers.length || columns.length;
      td.className = "text-center text-secondary py-4";
      td.textContent = "Aucune donnée enregistrée.";
      tr.append(td);
      body.append(tr);
    }
  }

  async function loadPage(config) {
    for (let index = 0; index < config.tables.length; index += 1) {
      const table = mainTable(index);
      const columns = config.tables[index].columns;
      const rows = await resolveReferences(list(await config.tables[index].load()), columns);
      renderTable(table, rows, columns, config);
      if (page === "gesco-administration.html" && index === 0) setupUserManagement(rows);
      if (page === "gesco-approvisionnement-commandes.html" && index === 0) setupOrderHistory(rows, config);
      if (page === "gesco-approvisionnement-receptions.html" && index === 0) setupReceptions(rows, config);
      if (page === "gesco-stock-produits.html" && index === 0) await setupProductCatalogue(rows, config);
      if (page === "gesco-stock-mouvements.html" && index === 0) setupStockMovements(rows, config);
      if (page === "gesco-stock-inventaires.html" && index === 0) setupInventories(rows, config);
      if (page === "gesco-ventes.html" && index === 0) setupSalesHistory(rows, config);
      if (page === "gesco-ventes-retours.html" && index === 0) await setupReturns(rows, config);
      if (page === "gesco-facturation.html" && index === 0) setupInvoices(rows, config);
    }
  }

  let xlsxLoader = null;

  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!xlsxLoader) {
      xlsxLoader = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "assets/js/vendor/xlsx.full.min.js";
        script.async = true;
        script.onload = () => {
          if (window.XLSX) resolve(window.XLSX);
          else reject(new Error("Le module Excel n'a pas pu être initialisé."));
        };
        script.onerror = () => {
          xlsxLoader = null;
          reject(new Error("Impossible de charger le module Excel."));
        };
        document.head.appendChild(script);
      });
    }
    return xlsxLoader;
  }

  const stockMovementTypeLabels = {
    stock_initial: "Stock initial",
    entree: "Entrée",
    reception: "Réception",
    retour: "Retour client",
    vente: "Vente",
    sortie: "Sortie",
    perte: "Perte",
    casse: "Casse",
    vol: "Vol",
    ajustement_positif: "Ajustement positif",
    ajustement_negatif: "Ajustement négatif",
    annulation_vente: "Annulation de vente",
  };

  const stockMovementTypeLabel = (value) => stockMovementTypeLabels[value]
    ?? (value ? String(value).replaceAll("_", " ") : "—");

  const sortStockMovements = (left, right) => {
    const rightTime = new Date(right.createdAt).getTime();
    const leftTime = new Date(left.createdAt).getTime();
    return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
  };

  const padDatePart = (value) => String(value).padStart(2, "0");

  function formatDateTime(date) {
    return `${padDatePart(date.getDate())}/${padDatePart(date.getMonth() + 1)}/${date.getFullYear()} ${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;
  }

  function dateInputValue(date) {
    const parsed = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(parsed.getTime())) return "";
    return `${parsed.getFullYear()}-${padDatePart(parsed.getMonth() + 1)}-${padDatePart(parsed.getDate())}`;
  }

  function parseDateInputValue(value, endOfDay = false) {
    const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const parsed = new Date(
      +match[1],
      +match[2] - 1,
      +match[3],
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0,
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function dateBounds(rows, key) {
    let min = null;
    let max = null;
    rows.forEach((row) => {
      const date = new Date(row?.[key]);
      if (Number.isNaN(date.getTime())) return;
      if (!min || date < min) min = date;
      if (!max || date > max) max = date;
    });
    const today = new Date();
    return { min: min || today, max: max || today };
  }

  function renderListPagination(nav, page, totalPages, onPage) {
    if (!nav) return;
    nav.classList.remove("d-none");
    const list = document.createElement("ul");
    list.className = "pagination mb-0";
    const addItem = (label, targetPage, options = {}) => {
      const item = document.createElement("li");
      item.className = `page-item${options.active ? " active" : ""}${options.disabled ? " disabled" : ""}`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "page-link";
      button.textContent = label;
      if (options.ariaLabel) button.setAttribute("aria-label", options.ariaLabel);
      if (options.active) button.setAttribute("aria-current", "page");
      if (options.disabled) button.disabled = true;
      else button.addEventListener("click", () => onPage(targetPage));
      item.append(button);
      list.append(item);
    };
    const addEllipsis = () => {
      const item = document.createElement("li");
      item.className = "page-item disabled";
      const span = document.createElement("span");
      span.className = "page-link";
      span.textContent = "…";
      item.append(span);
      list.append(item);
    };

    addItem("«", page - 1, {
      disabled: page <= 1,
      ariaLabel: "Page précédente",
    });
    const pages = [];
    if (totalPages <= 7) {
      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) pages.push(pageNumber);
    } else {
      pages.push(1);
      const start = Math.max(2, page - 2);
      const end = Math.min(totalPages - 1, page + 2);
      if (start > 2) pages.push("...");
      for (let pageNumber = start; pageNumber <= end; pageNumber += 1) pages.push(pageNumber);
      if (end < totalPages - 1) pages.push("...");
      pages.push(totalPages);
    }
    pages.forEach((pageNumber) => {
      if (pageNumber === "...") addEllipsis();
      else addItem(String(pageNumber), pageNumber, { active: pageNumber === page });
    });
    addItem("»", page + 1, {
      disabled: page >= totalPages,
      ariaLabel: "Page suivante",
    });
    nav.replaceChildren(list);
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadCsv(filename, header, rows) {
    const escape = (value) => {
      const text = String(value ?? "");
      return /[";\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    };
    const content = `\uFEFF${[header, ...rows].map((row) => row.map(escape).join(";")).join("\r\n")}`;
    triggerDownload(new Blob([content], { type: "text/csv;charset=utf-8;" }), filename);
  }

  async function downloadExcel(filename, header, rows) {
    const XLSX = await loadXlsx();
    const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
    worksheet["!cols"] = header.map((_, index) => ({ wch: index === 2 ? 36 : index === 4 ? 20 : 18 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Données");
    XLSX.writeFile(workbook, filename);
  }

  function stockMovementExportRow(row) {
    const date = new Date(row.createdAt);
    return [
      Number.isNaN(date.getTime()) ? "" : formatDateTime(date),
      stockMovementTypeLabel(row.type),
      row.idProduitLabel ?? row.idProduit ?? "",
      Number(row.quantite ?? 0),
      row.reference ?? "",
      row.motif ?? "",
    ];
  }

  async function exportStockMovements(rows, format, start, end) {
    const header = ["Date", "Type", "Produit", "Quantité", "Référence", "Motif"];
    const data = rows.map(stockMovementExportRow);
    const filename = `mouvements_${dateInputValue(start)}_${dateInputValue(end)}`;
    if (format === "csv") {
      downloadCsv(`${filename}.csv`, header, data);
      return;
    }
    await downloadExcel(`${filename}.xlsx`, header, data);
  }

  function productExportRow(row) {
    return [
      row.designation ?? "",
      row.idCategorieLabel ?? row.idCategorie ?? "",
      Number(row.prixVente ?? 0),
      Number(row.stock ?? 0),
      Number(row.seuilMinimum ?? 0),
      row.stockState ?? "",
    ];
  }

  async function exportProducts(rows, format) {
    const header = ["Désignation", "Catégorie", "Prix de vente", "Stock", "Seuil", "État"];
    const data = rows.map(productExportRow);
    const filename = `produits_${dateInputValue(new Date())}`;
    if (format === "csv") {
      downloadCsv(`${filename}.csv`, header, data);
      return;
    }
    await downloadExcel(`${filename}.xlsx`, header, data);
  }

  function saleExportRow(row) {
    return [
      row.reference ?? "",
      date(row.dateVente),
      row.idClientLabel ?? row.idClient ?? "",
      Number(row.articleCount ?? 0),
      Number(row.montantTotal ?? 0),
      normalize(row, "modePaiement", "paymentMethod"),
      normalize(row, "statut", "saleStatus"),
      row.invoiceReference ?? "",
    ];
  }

  async function exportSales(rows, format, start, end) {
    const header = ["N° vente", "Date", "Client", "Articles", "Total", "Paiement", "Statut", "Facture"];
    const data = rows.map(saleExportRow);
    const filename = `ventes_${dateInputValue(start)}_${dateInputValue(end)}`;
    if (format === "csv") {
      downloadCsv(`${filename}.csv`, header, data);
      return;
    }
    await downloadExcel(`${filename}.xlsx`, header, data);
  }

  function setupStockMovements(movements, config) {
    const main = document.querySelector("main");
    const table = mainTable(0);
    if (!main || !table) return;
    const search = main.querySelector("#mouvements-search") ?? main.querySelector('input[placeholder*="Rechercher"]');
    const typeSelect = main.querySelector("#mouvements-type-filter") ?? main.querySelector("select.form-select");
    const pageSizeSelect = main.querySelector("#mouvements-page-size");
    const count = main.querySelector("#mouvements-count")
      ?? main.querySelector(".row.gx-3.align-items-center.mt-3 .small.text-secondary");
    const paginationNav = main.querySelector("#mouvements-pagination")
      ?? main.querySelector(".pagination")?.closest("nav");
    const exportModal = document.getElementById("exportMouvements");
    const exportForm = document.getElementById("export-mouvements-form");
    const exportStart = document.getElementById("export-mouvements-debut");
    const exportEnd = document.getElementById("export-mouvements-fin");
    const exportFormat = document.getElementById("export-mouvements-format");
    const exportError = document.getElementById("export-mouvements-error");
    const exportSummary = document.getElementById("export-mouvements-summary");
    const exportSubmit = exportForm?.querySelector('button[type="submit"]');
    const columns = config.tables[0].columns;

    const state = main._gescoStockState ?? {
      page: 1,
      pageSize: 10,
      search: "",
      type: "",
      uiBound: false,
    };
    state.config = config;
    state.movements = movements.slice().sort(sortStockMovements);
    main._gescoStockState = state;

    if (search) state.search = search.value;
    if (pageSizeSelect) {
      const optionValues = Array.from(pageSizeSelect.options).map((option) => Number(option.value));
      if (!optionValues.includes(state.pageSize)) state.pageSize = Number(pageSizeSelect.value) || 10;
      pageSizeSelect.value = String(state.pageSize);
    }

    const refreshStats = () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const currentMonth = state.movements.filter((movement) => {
        const created = new Date(movement.createdAt);
        return !Number.isNaN(created.getTime()) && created >= monthStart;
      });
      const totalEntries = currentMonth.reduce((sum, movement) => sum + Math.max(0, Number(movement.quantite || 0)), 0);
      const totalExits = currentMonth.reduce((sum, movement) => sum + Math.max(0, -Number(movement.quantite || 0)), 0);
      const totalLosses = currentMonth
        .filter((movement) => ["perte", "casse", "vol"].includes(movement.type))
        .reduce((sum, movement) => sum + Math.abs(Number(movement.quantite || 0)), 0);
      const indicators = main.querySelectorAll(".row.g-3.mb-4 .card-body h3");
      if (indicators?.length >= 4) {
        indicators[0].textContent = currentMonth.length.toLocaleString("fr-FR");
        indicators[1].textContent = `+${totalEntries.toLocaleString("fr-FR")}`;
        indicators[2].textContent = `−${totalExits.toLocaleString("fr-FR")}`;
        indicators[3].textContent = `−${totalLosses.toLocaleString("fr-FR")}`;
      }
    };

    const refreshTypeOptions = () => {
      if (!typeSelect) return;
      const previous = state.type || typeSelect.value || "";
      const labels = new Map();
      state.movements.forEach((movement) => {
        if (movement.type) labels.set(movement.type, stockMovementTypeLabel(movement.type));
      });
      typeSelect.replaceChildren(new Option("Tous les types", ""));
      [...labels].sort((left, right) => left[1].localeCompare(right[1], "fr"))
        .forEach(([value, label]) => typeSelect.append(new Option(label, value)));
      typeSelect.value = labels.has(previous) ? previous : "";
      state.type = typeSelect.value;
    };

    const getFilteredMovements = () => {
      const query = String(state.search ?? "").trim().toLocaleLowerCase("fr");
      return state.movements.filter((movement) => {
        const searchable = [
          movement.idProduitLabel,
          movement.idProduit,
          stockMovementTypeLabel(movement.type),
          movement.reference,
          movement.motif,
          movement.utilisateur,
        ].map((value) => String(value ?? "")).join(" ").toLocaleLowerCase("fr");
        return (!query || searchable.includes(query))
          && (!state.type || movement.type === state.type);
      });
    };

    state.render = () => {
      const filtered = getFilteredMovements();
      const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
      if (state.page > totalPages) state.page = totalPages;
      if (state.page < 1) state.page = 1;
      const startIndex = (state.page - 1) * state.pageSize;
      const pageRows = filtered.slice(startIndex, startIndex + state.pageSize);
      renderTable(table, pageRows, columns, state.config);
      const headerCount = table.tHead?.rows[0]?.cells.length ?? 0;
      Array.from(table.tBodies[0]?.rows ?? []).forEach((row) => {
        while (headerCount && row.cells.length > headerCount) row.lastElementChild?.remove();
      });
      if (count) {
        const endIndex = Math.min(filtered.length, startIndex + pageRows.length);
        count.textContent = filtered.length === 0
          ? "Aucun mouvement à afficher"
          : `Affichage de ${startIndex + 1} à ${endIndex} sur ${filtered.length} mouvement${filtered.length === 1 ? "" : "s"}`;
      }
      renderListPagination(paginationNav, state.page, totalPages, (targetPage) => {
        state.page = targetPage;
        state.render();
      });
    };

    const showExportError = (message) => {
      if (!exportError) return;
      exportError.textContent = message;
      exportError.classList.remove("d-none");
    };

    const updateExportSummary = () => {
      if (!exportSummary) return;
      const start = parseDateInputValue(exportStart?.value);
      const end = parseDateInputValue(exportEnd?.value, true);
      if (!start || !end || start > end) {
        exportSummary.textContent = "";
        return;
      }
      const total = getFilteredMovements().filter((movement) => {
        const date = new Date(movement.createdAt);
        return !Number.isNaN(date.getTime()) && date >= start && date <= end;
      }).length;
      exportSummary.textContent = `${total} mouvement${total === 1 ? "" : "s"} dans la période sélectionnée.`;
    };

    state.prepareExport = () => {
      const bounds = dateBounds(state.movements, "createdAt");
      if (exportStart && !exportStart.value) exportStart.value = dateInputValue(bounds.min);
      if (exportEnd && !exportEnd.value) exportEnd.value = dateInputValue(bounds.max);
      exportError?.classList.add("d-none");
      updateExportSummary();
    };

    if (!state.uiBound) {
      search?.addEventListener("input", () => {
        state.search = search.value;
        state.page = 1;
        state.render();
      });
      typeSelect?.addEventListener("change", () => {
        state.type = typeSelect.value;
        state.page = 1;
        state.render();
      });
      pageSizeSelect?.addEventListener("change", () => {
        state.pageSize = Number(pageSizeSelect.value) || 10;
        state.page = 1;
        state.render();
      });
      [exportStart, exportEnd].forEach((input) => input?.addEventListener("change", updateExportSummary));
      exportModal?.addEventListener("show.bs.modal", () => state.prepareExport());
      exportForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        exportError?.classList.add("d-none");
        const start = parseDateInputValue(exportStart?.value);
        const end = parseDateInputValue(exportEnd?.value, true);
        if (!start || !end) {
          showExportError("Veuillez renseigner la date de début et la date de fin.");
          return;
        }
        if (start > end) {
          showExportError("La date de début doit précéder la date de fin.");
          return;
        }
        const rows = getFilteredMovements().filter((movement) => {
          const date = new Date(movement.createdAt);
          return !Number.isNaN(date.getTime()) && date >= start && date <= end;
        }).sort(sortStockMovements);
        if (!rows.length) {
          showExportError("Aucun mouvement n'est disponible sur cette période.");
          return;
        }
        const originalLabel = exportSubmit?.innerHTML;
        if (exportSubmit) {
          exportSubmit.disabled = true;
          exportSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Exportation...';
        }
        try {
          await exportStockMovements(rows, exportFormat?.value || "xlsx", start, end);
          window.bootstrap?.Modal?.getOrCreateInstance(exportModal)?.hide();
        } catch (error) {
          console.error("Export des mouvements :", error);
          showExportError(error.message || "Impossible d'exporter les mouvements.");
        } finally {
          if (exportSubmit) {
            exportSubmit.disabled = false;
            exportSubmit.innerHTML = originalLabel;
          }
        }
      });
      state.uiBound = true;
    }

    refreshStats();
    refreshTypeOptions();
    if (search) search.value = state.search;
    if (typeSelect) typeSelect.value = state.type;
    state.render();
  }

  function setupInvoices(invoices, config) {
    const main = document.querySelector("main");
    const table = mainTable(0);
    const search = document.getElementById("factures-search");
    const count = document.getElementById("factures-count");
    const columns = config.tables[0].columns;

    const render = () => {
      const query = String(search?.value ?? "").trim().toLocaleLowerCase("fr");
      const filtered = invoices.filter((invoice) => {
        if (!query) return true;
        const searchable = [
          invoice.reference,
          invoice.idClientLabel,
          invoice.statut,
          normalize(invoice, "statut"),
          normalize(invoice, "idClient"),
        ].join(" ").toLocaleLowerCase("fr");
        return searchable.includes(query);
      });
      renderTable(table, filtered, columns, config);
      if (count) {
        count.textContent = `Affichage de ${filtered.length} document${filtered.length === 1 ? "" : "s"} sur ${invoices.length}`;
      }
      main?.querySelector(".pagination")?.closest("nav")?.classList.add("d-none");
    };

    search?.addEventListener("input", render);
    render();
  }

  async function setupLossDialog(config) {
    const modal = document.getElementById("declarerPerte");
    if (!modal) return;
    const productSelect = modal.querySelector("#perte-produit");
    const typeSelect = modal.querySelector("#perte-type");
    const quantityInput = modal.querySelector("#perte-quantite");
    const motifInput = modal.querySelector("#perte-motif");
    const submit = modal.querySelector("#perte-enregistrer");
    const error = modal.querySelector("#perte-error");
    const showError = (message) => {
      if (!error) return;
      error.textContent = message;
      error.classList.remove("d-none");
    };
    try {
      const products = list(await api.getProduits());
      products.forEach((product) => {
        productSelect?.append(new Option(`${product.designation} — stock : ${product.stock ?? 0}`, product.id));
      });
    } catch (loadError) {
      showError(loadError.message || "Impossible de charger la liste des produits.");
    }
    submit?.addEventListener("click", async () => {
      error?.classList.add("d-none");
      const idProduit = Number(productSelect?.value);
      if (!idProduit) {
        showError("Veuillez sélectionner un produit.");
        return;
      }
      submit.disabled = true;
      try {
        await api.createStockMovement({
          idProduit,
          type: typeSelect?.value || "perte",
          quantite: Number(quantityInput?.value || 1),
          motif: motifInput?.value?.trim() || null,
        });
        if (productSelect) productSelect.value = "";
        if (quantityInput) quantityInput.value = 1;
        if (motifInput) motifInput.value = "";
        if (window.bootstrap?.Modal) window.bootstrap.Modal.getOrCreateInstance(modal).hide();
        await loadPage(apiPages[page]);
      } catch (submitError) {
        showError(submitError.message || "Échec de l'enregistrement.");
        submit.disabled = false;
      }
    });
  }

  function setupInventories(inventories, config) {
    const main = document.querySelector("main");
    const table = mainTable(0);
    if (!main || !table) return;
    const search = main.querySelector("#inventaires-recherche");
    const statusSelect = main.querySelector("#inventaires-statut");
    const state = table._gescoInventoryState ?? { inventories: [], config, attached: false };
    state.inventories = inventories;
    state.config = config;
    table._gescoInventoryState = state;
    const indicators = main?.querySelectorAll(".row.g-3.mb-4 .card-body h3");
    const currentYear = new Date().getFullYear();
    if (indicators?.length >= 4) {
      const thisYear = state.inventories.filter((item) => new Date(item.dateInventaire).getFullYear() === currentYear);
      const ongoing = state.inventories.filter((item) => item.statut === "en_cours");
      const validated = state.inventories.filter((item) => item.statut === "termine");
      const totalEcarts = state.inventories.reduce((sum, item) => sum + Number(item.ecarts || 0), 0);
      indicators[0].textContent = thisYear.length.toLocaleString("fr-FR");
      indicators[1].textContent = ongoing.length.toLocaleString("fr-FR");
      indicators[2].textContent = validated.length.toLocaleString("fr-FR");
      indicators[3].textContent = totalEcarts.toLocaleString("fr-FR");
    }

    if (statusSelect) {
      const selectedStatus = statusSelect.value;
      statusSelect.replaceChildren(
        new Option("Tous les statuts", ""),
        new Option("En cours", "en_cours"),
        new Option("Validé", "termine"),
      );
      statusSelect.value = selectedStatus;
    }

    const render = () => {
      const query = String(search?.value ?? "").trim().toLocaleLowerCase("fr");
      const filtered = state.inventories.filter((inventory) => {
        const searchable = [inventory.reference, inventory.responsable, inventory.notes]
          .join(" ").toLocaleLowerCase("fr");
        return (!query || searchable.includes(query))
          && (!statusSelect?.value || inventory.statut === statusSelect.value);
      });
      renderTable(table, filtered, state.config.tables[0].columns, state.config);
      const count = main?.querySelector(".row.gx-3.align-items-center.mt-3 .small.text-secondary");
      if (count) {
        count.textContent = `${filtered.length} inventaire${filtered.length === 1 ? "" : "s"} affiché${filtered.length === 1 ? "" : "s"} sur ${state.inventories.length}`;
      }
    };
    if (!state.attached) {
      search?.addEventListener("input", render);
      statusSelect?.addEventListener("change", render);
      state.attached = true;
    }
    main?.querySelector(".pagination")?.closest("nav")?.classList.add("d-none");
    render();
  }

  async function openInventoryCount(id, target) {
    const modalEl = document.getElementById("inventaireComptage");
    if (!modalEl || !id) return;
    const title = modalEl.querySelector("#inventaire-comptage-titre");
    const subtitle = modalEl.querySelector("#inventaire-comptage-sous-titre");
    const body = modalEl.querySelector("#inventaire-comptage-corps");
    const search = modalEl.querySelector("#inventaire-comptage-recherche");
    const alertBox = modalEl.querySelector("#inventaire-comptage-alerte");
    const closeHelp = modalEl.querySelector("#inventaire-comptage-aide-cloture");
    const saveButton = modalEl.querySelector("#inventaire-comptage-enregistrer");
    const closeButton = modalEl.querySelector("#inventaire-comptage-cloturer");
    const showAlert = (message) => {
      if (!alertBox) return;
      alertBox.textContent = message;
      alertBox.classList.remove("d-none");
    };
    alertBox?.classList.add("d-none");

    let inventory;
    let productNames;
    try {
      [inventory, productNames] = await Promise.all([
        api.getInventory(id),
        loadReferenceMap("idProduit"),
      ]);
    } catch (error) {
      showAlert(error.message || "Impossible de charger l'inventaire.");
      window.bootstrap?.Modal?.getOrCreateInstance(modalEl).show();
      return;
    }
    const lines = list(inventory.lignes);
    const editable = inventory.statut === "en_cours";
    if (title) title.textContent = `Comptage — ${inventory.reference}`;
    if (search) search.value = "";
    const refreshProgress = () => {
      const inputs = Array.from(body?.querySelectorAll('input[type="number"]') ?? []);
      const counts = inputs.filter((input) => input.value !== "").length;
      if (subtitle) {
        subtitle.textContent = `${date(inventory.dateInventaire)} · ${counts}/${lines.length} article${lines.length === 1 ? "" : "s"} compté${counts === 1 ? "" : "s"}${editable ? "" : " · inventaire validé"}`;
      }
      if (saveButton) saveButton.disabled = !editable || counts === 0;
      if (closeButton) closeButton.disabled = !editable || !lines.length;
      if (closeHelp) {
        closeHelp.textContent = !lines.length
          ? "Aucun article ne figure dans cet inventaire."
          : counts === lines.length
            ? "Tous les articles sont comptés. La clôture appliquera les écarts au stock."
            : `La clôture nécessite une quantité pour chaque article (${counts}/${lines.length} comptés).`;
      }
    };
    body?.replaceChildren();
    lines.forEach((line) => {
      const tr = document.createElement("tr");
      const name = document.createElement("td");
      name.textContent = productNames.get(String(line.idProduit)) ?? `Produit ${line.idProduit}`;
      tr.dataset.productName = name.textContent.toLocaleLowerCase("fr");
      const theoretical = document.createElement("td");
      theoretical.className = "text-center text-secondary";
      theoretical.textContent = String(line.quantiteTheorique);
      const counted = document.createElement("td");
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.step = "1";
      input.className = "form-control form-control-sm text-center";
      input.value = line.quantiteComptee === null ? "" : String(line.quantiteComptee);
      input.disabled = !editable;
      counted.append(input);
      const gap = document.createElement("td");
      gap.className = "text-center fw-bold";
      const refreshGap = () => {
        if (input.value === "") {
          gap.textContent = "—";
          gap.className = "text-center fw-bold text-secondary";
          return;
        }
        const ecart = Number(input.value) - Number(line.quantiteTheorique);
        gap.textContent = ecart > 0 ? `+${ecart}` : String(ecart);
        gap.className = `text-center fw-bold ${ecart > 0 ? "text-success" : ecart < 0 ? "text-danger" : "text-secondary"}`;
      };
      input.addEventListener("input", () => {
        refreshGap();
        refreshProgress();
      });
      refreshGap();
      tr.append(name, theoretical, counted, gap);
      body?.append(tr);
    });
    if (!lines.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 4;
      td.className = "text-center text-secondary py-4";
      td.textContent = "Aucun article dans cet inventaire.";
      tr.append(td);
      body?.append(tr);
    }
    refreshProgress();
    if (search) {
      search.oninput = () => {
        const query = search.value.trim().toLocaleLowerCase("fr");
        Array.from(body?.rows ?? []).forEach((row) => {
          row.hidden = Boolean(query) && !String(row.dataset.productName ?? "").includes(query);
        });
      };
    }

    const collectLines = () => {
      const requests = [];
      lines.forEach((line, index) => {
        const input = body?.querySelectorAll("input[type=number]")[index];
        if (!input || input.value === "") return;
        requests.push({ idProduit: line.idProduit, quantiteComptee: Number(input.value) });
      });
      return requests;
    };

    if (saveButton) {
      saveButton.onclick = async () => {
        const requests = collectLines();
        alertBox?.classList.add("d-none");
        if (!requests.length) {
          showAlert("Saisissez au moins une quantité comptée.");
          return;
        }
        saveButton.disabled = true;
        try {
          await api.countInventory(id, { lignes: requests });
          await loadPage(target);
          await openInventoryCount(id, target);
        } catch (error) {
          showAlert(error.message || "Échec de l'enregistrement du comptage.");
          saveButton.disabled = false;
        }
      };
    }
    if (closeButton) {
      closeButton.onclick = async () => {
        const requests = collectLines();
        alertBox?.classList.add("d-none");
        if (requests.length !== lines.length) {
          showAlert("Comptez tous les articles avant de clôturer l'inventaire.");
          return;
        }
        if (!(await confirmAction({
          title: "Clôturer l'inventaire",
          message: `Clôturer l'inventaire ${inventory.reference} ? Le stock sera ajusté selon les écarts saisis.`,
          confirmLabel: "Clôturer",
          tone: "primary",
        }))) return;
        closeButton.disabled = true;
        try {
          await api.closeInventory(id, { lignes: requests });
          window.bootstrap?.Modal?.getOrCreateInstance(modalEl).hide();
          await loadPage(target);
        } catch (error) {
          showAlert(error.message || "Échec de la clôture de l'inventaire.");
          closeButton.disabled = false;
        }
      };
    }
    window.bootstrap?.Modal?.getOrCreateInstance(modalEl).show();
  }

  async function setupProductCatalogue(products, config) {
    const main = document.querySelector("main");
    const table = mainTable(0);
    if (!main || !table) return;
    const search = main.querySelector("#products-search") ?? main.querySelector('input[type="search"], input[placeholder*="Rechercher"]');
    const selects = Array.from(main.querySelectorAll("select.form-select"));
    const categorySelect = main.querySelector("#products-category-filter") ?? selects[0];
    const stateSelect = main.querySelector("#products-state-filter") ?? selects[1];
    const pageSizeSelect = main.querySelector("#products-page-size");
    const paginationNav = main.querySelector("#products-pagination") ?? main.querySelector(".pagination")?.closest("nav");
    const headerCount = main.querySelector("#products-result-count");
    const footerCount = main.querySelector("#products-count-footer");
    const exportModal = document.getElementById("exportProduits");
    const exportForm = document.getElementById("export-produits-form");
    const exportFormat = document.getElementById("export-produits-format");
    const exportError = document.getElementById("export-produits-error");
    const exportSummary = document.getElementById("export-produits-summary");
    const exportSubmit = exportForm?.querySelector('button[type="submit"]');
    const columns = config.tables[0].columns;

    const state = table._gescoProductsState ?? { page: 1, pageSize: 10, uiBound: false };
    state.products = products;
    state.config = config;
    table._gescoProductsState = state;

    if (pageSizeSelect) {
      const optionValues = Array.from(pageSizeSelect.options).map((option) => Number(option.value));
      if (!optionValues.includes(state.pageSize)) state.pageSize = Number(pageSizeSelect.value) || 10;
      pageSizeSelect.value = String(state.pageSize);
    }

    if (categorySelect) {
      const categories = await loadReferenceMap("idCategorie");
      categorySelect.replaceChildren(new Option("Toutes catégories", ""));
      [...categories].forEach(([id, label]) => categorySelect.append(new Option(label, id)));
    }
    if (stateSelect) {
      stateSelect.replaceChildren(
        new Option("Tous les états", ""),
        new Option("En stock", "En stock"),
        new Option("Stock faible", "Stock faible"),
        new Option("Rupture", "Rupture"),
      );
    }

    const getFilteredProducts = () => {
      const query = String(search?.value ?? "").trim().toLocaleLowerCase("fr");
      return state.products.filter((item) => {
        const matchesQuery = !query || `${item.designation ?? ""}`
          .toLocaleLowerCase("fr").includes(query);
        const matchesCategory = !categorySelect?.value || String(item.idCategorie) === categorySelect.value;
        const matchesState = !stateSelect?.value || item.stockState === stateSelect.value;
        return matchesQuery && matchesCategory && matchesState;
      });
    };

    const render = () => {
      const filtered = getFilteredProducts();
      const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
      if (state.page > totalPages) state.page = totalPages;
      if (state.page < 1) state.page = 1;
      const startIndex = (state.page - 1) * state.pageSize;
      const pageRows = filtered.slice(startIndex, startIndex + state.pageSize);
      renderTable(table, pageRows, columns, config);
      const endIndex = Math.min(filtered.length, startIndex + pageRows.length);
      if (headerCount) {
        headerCount.textContent = `${filtered.length} référence${filtered.length === 1 ? "" : "s"} affichée${filtered.length === 1 ? "" : "s"} sur ${state.products.length}`;
      }
      if (footerCount) {
        footerCount.textContent = filtered.length === 0
          ? "Aucun produit à afficher"
          : `Affichage de ${startIndex + 1} à ${endIndex} sur ${filtered.length} référence${filtered.length === 1 ? "" : "s"}`;
      }
      renderListPagination(paginationNav, state.page, totalPages, (targetPage) => {
        state.page = targetPage;
        render();
      });
    };

    const updateExportSummary = () => {
      if (!exportSummary) return;
      const total = getFilteredProducts().length;
      exportSummary.textContent = `${total} produit${total === 1 ? "" : "s"} sera${total === 1 ? "" : "ont"} exporté${total === 1 ? "" : "s"}.`;
    };

    if (!state.uiBound) {
      search?.addEventListener("input", () => {
        state.page = 1;
        render();
      });
      categorySelect?.addEventListener("change", () => {
        state.page = 1;
        render();
      });
      stateSelect?.addEventListener("change", () => {
        state.page = 1;
        render();
      });
      pageSizeSelect?.addEventListener("change", () => {
        state.pageSize = Number(pageSizeSelect.value) || 10;
        state.page = 1;
        render();
      });
      exportModal?.addEventListener("show.bs.modal", () => {
        exportError?.classList.add("d-none");
        updateExportSummary();
      });
      exportForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        exportError?.classList.add("d-none");
        const rows = getFilteredProducts();
        if (!rows.length) {
          if (exportError) {
            exportError.textContent = "Aucun produit ne correspond aux filtres actuels.";
            exportError.classList.remove("d-none");
          }
          return;
        }
        const originalLabel = exportSubmit?.innerHTML;
        if (exportSubmit) {
          exportSubmit.disabled = true;
          exportSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Exportation...';
        }
        try {
          await exportProducts(rows, exportFormat?.value || "xlsx");
          window.bootstrap?.Modal?.getOrCreateInstance(exportModal)?.hide();
        } catch (error) {
          console.error("Export des produits :", error);
          if (exportError) {
            exportError.textContent = error.message || "Impossible d'exporter les produits.";
            exportError.classList.remove("d-none");
          }
        } finally {
          if (exportSubmit) {
            exportSubmit.disabled = false;
            exportSubmit.innerHTML = originalLabel;
          }
        }
      });
      state.uiBound = true;
    }

    const values = main.querySelectorAll(".row.g-3.mb-4 .card-body h3");
    if (values?.length >= 4) {
      const stockValue = state.products.reduce((total, item) => total + Number(item.prixVente || 0) * Number(item.stock || 0), 0);
      const lowStock = state.products.filter((item) => Number(item.stock || 0) > 0 && Number(item.stock || 0) <= Number(item.seuilMinimum || 0)).length;
      const outOfStock = state.products.filter((item) => Number(item.stock || 0) <= 0).length;
      values[0].textContent = state.products.length.toLocaleString("fr-FR");
      values[1].textContent = `${new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 2 }).format(stockValue)} FCFA`;
      values[2].textContent = String(lowStock);
      values[3].textContent = String(outOfStock);
    }
    render();
  }

  async function loadClientDetail() {
    const id = findId();
    const titleElement = document.getElementById("client-page-title");
    if (!id || !titleElement) return;
    const editButton = document.getElementById("clientModifierBtn");
    if (editButton) editButton.onclick = () => { window.location.href = `gesco-clients-modifier.html?id=${encodeURIComponent(id)}`; };

    const setText = (elementId, value) => {
      const element = document.getElementById(elementId);
      if (element) element.textContent = value;
    };
    const orNa = (value) => (value === null || value === undefined || value === "" ? "N/A" : value);
    const modeLabel = (mode) => ({
      especes: "Espèces",
      mobile_money: "Mobile Money",
      carte: "Carte",
      virement: "Virement",
      cheque: "Chèque",
    })[mode] ?? (mode ? String(mode) : "—");
    const invoiceBadge = (statut) => {
      const map = {
        payee: ["Payée", "text-bg-success"],
        partiellement_payee: ["Partiellement payée", "text-bg-warning"],
        impayee: ["Impayée", "text-bg-danger"],
        envoyee: ["Envoyée", "text-bg-primary"],
        brouillon: ["Brouillon", "text-bg-secondary"],
        annulee: ["Annulée", "text-bg-danger"],
      };
      const [label, cls] = map[statut] ?? [statut ? String(statut) : "—", "text-bg-secondary"];
      return `<span class="badge badge-light ${cls}">${esc(label)}</span>`;
    };
    const renderRows = (tbodyId, count, rows, rowHtml) => {
      const body = document.getElementById(tbodyId);
      if (!body) return;
      body.innerHTML = rows.length
        ? rows.map(rowHtml).join("")
        : `<tr><td colspan="${count}" class="text-center text-secondary py-4">Aucune donnée</td></tr>`;
    };
    const byDateDesc = (getter) => (a, b) => new Date(getter(b) || 0) - new Date(getter(a) || 0);

    try {
      const [clientResult, statsResult, salesResult, invoicesResult, paymentsResult] = await Promise.all([
        api.getClient(id),
        api.getClientStats(id),
        api.getVentes(),
        api.getFactures(),
        api.getPaiements(),
      ]);
      const client = clientResult.client ?? clientResult.data ?? clientResult;
      const stats = statsResult.data ?? statsResult;
      const type = String(client.type ?? "").trim().toLowerCase();
      const isEntreprise = type.startsWith("entr");
      const nom = orNa(client.nom);

      setText("client-breadcrumb", nom);
      setText("client-page-title", nom);
      setText("client-avatar", String(client.nom || "").trim().slice(0, 2).toUpperCase() || "NA");
      setText("client-name", nom);
      const created = client.createdAt ? new Date(client.createdAt) : null;
      const since = created && !Number.isNaN(created.getTime())
        ? created.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
        : null;
      const role = isEntreprise ? "Client entreprise" : type.startsWith("particulier") ? "Client particulier" : "Client";
      setText("client-subtitle", since ? `${role} depuis ${since}` : role);
      const badge = document.getElementById("client-type-badge");
      if (badge) {
        badge.textContent = isEntreprise ? "Entreprise" : type.startsWith("particulier") ? "Particulier" : "N/A";
        badge.className = `badge badge-light ${isEntreprise ? "text-bg-theme-1" : "text-bg-secondary"}`;
      }
      setText("client-email", orNa(client.email));
      setText("client-tel", orNa(client.tel));
      setText("client-adresse", [client.adresse, client.ville].filter(Boolean).join(", ") || "N/A");
      setText("client-nif", orNa(client.nif));

      const totalAchats = Number(stats.totalAchats || 0);
      const nbVentes = Number(stats.nombreVentes || 0);
      const solde = Number(stats.soldeDu || 0);
      setText("stat-total-achats", money(totalAchats));
      setText("stat-ventes", String(nbVentes));
      setText("stat-panier-moyen", money(nbVentes ? totalAchats / nbVentes : 0));
      setText("stat-dernier-achat", stats.dernierAchat ? date(stats.dernierAchat) : "N/A");
      setText("client-solde-amount", money(solde));
      setText("client-solde-detail", solde > 0 ? "Montant restant à régler par le client" : "");
      const soldeCard = document.getElementById("client-solde-card");
      if (soldeCard) soldeCard.classList.toggle("d-none", solde <= 0);

      const sales = list(salesResult)
        .filter((sale) => Number(sale.idClient) === Number(id))
        .sort(byDateDesc((sale) => sale.dateVente));
      const saleIds = new Set(sales.map((sale) => Number(sale.id)));
      renderRows("client-ventes-body", 4, sales, (sale) => `
        <tr>
          <td><a href="gesco-ventes-detail.html?id=${encodeURIComponent(sale.id)}">${esc(sale.reference)}</a></td>
          <td class="small">${date(sale.dateVente)}</td>
          <td class="text-end fw-medium">${money(sale.montantTotal)}</td>
          <td class="small">${esc(modeLabel(sale.modePaiement))}</td>
        </tr>`);

      const invoices = list(invoicesResult)
        .filter((invoice) => Number(invoice.idClient) === Number(id) || saleIds.has(Number(invoice.idVente)))
        .sort(byDateDesc((invoice) => invoice.dateFacture));
      renderRows("client-factures-body", 4, invoices, (invoice) => `
        <tr>
          <td><a href="gesco-facturation-detail.html?id=${encodeURIComponent(invoice.id)}">${esc(invoice.reference)}</a></td>
          <td class="small">${date(invoice.dateFacture)}</td>
          <td class="text-end fw-medium">${money(invoice.montantTotal)}</td>
          <td>${invoiceBadge(invoice.statut)}</td>
        </tr>`);

      const invoiceIds = new Set(invoices.map((invoice) => Number(invoice.id)));
      const payments = list(paymentsResult)
        .filter((payment) => invoiceIds.has(Number(payment.idFacture)))
        .sort(byDateDesc((payment) => payment.datePaiement));
      renderRows("client-paiements-body", 4, payments, (payment) => `
        <tr>
          <td class="small">${esc(payment.reference)}</td>
          <td class="small">${date(payment.datePaiement)}</td>
          <td class="text-end fw-medium text-success">+${money(payment.montant)}</td>
          <td class="small">${esc(modeLabel(payment.modePaiement))}</td>
        </tr>`);
    } catch (error) {
      console.error("Erreur chargement client :", error);
      setText("client-page-title", "Client introuvable");
      setText("client-name", error.message || "Erreur");
    }
  }

  function setupSalesHistory(sales, config) {
    const main = document.querySelector("main");
    const table = mainTable(0);
    if (!main || !table) return;
    const search = document.getElementById("sales-search");
    const statusFilter = document.getElementById("sales-status-filter");
    const paymentFilter = document.getElementById("sales-payment-filter");
    const pageSizeSelect = document.getElementById("sales-page-size");
    const paginationNav = document.getElementById("sales-pagination")
      ?? main.querySelector(".pagination")?.closest("nav");
    const headerCount = document.getElementById("sales-result-count");
    const footerCount = document.getElementById("sales-result-count-footer");
    const exportModal = document.getElementById("exportVentes");
    const exportForm = document.getElementById("export-ventes-form");
    const exportStart = document.getElementById("export-ventes-debut");
    const exportEnd = document.getElementById("export-ventes-fin");
    const exportFormat = document.getElementById("export-ventes-format");
    const exportError = document.getElementById("export-ventes-error");
    const exportSummary = document.getElementById("export-ventes-summary");
    const exportSubmit = exportForm?.querySelector('button[type="submit"]');
    const columns = config.tables[0].columns;

    const state = table._gescoSalesState ?? { sales: [], page: 1, pageSize: 10, attached: false };
    state.sales = sales;
    state.config = config;
    table._gescoSalesState = state;

    if (pageSizeSelect) {
      const optionValues = Array.from(pageSizeSelect.options).map((option) => Number(option.value));
      if (!optionValues.includes(state.pageSize)) state.pageSize = Number(pageSizeSelect.value) || 10;
      pageSizeSelect.value = String(state.pageSize);
    }

    const todayKey = new Date().toLocaleDateString("fr-CA");
    const todaySales = state.sales.filter((sale) => new Date(sale.dateVente).toLocaleDateString("fr-CA") === todayKey);
    const completedToday = todaySales.filter((sale) => sale.statut !== "annulee");
    const indicators = main.querySelectorAll(".row.g-3.mb-4 .card-body h3");
    if (indicators.length >= 4) {
      const revenue = completedToday.reduce((sum, sale) => sum + Number(sale.montantPaye || 0), 0);
      indicators[0].textContent = String(completedToday.length);
      indicators[1].textContent = money(revenue);
      const todaySalesTotal = completedToday.reduce((sum, sale) => sum + Number(sale.montantTotal || 0), 0);
      indicators[2].textContent = money(completedToday.length ? todaySalesTotal / completedToday.length : 0);
      indicators[3].textContent = String(state.sales.filter((sale) => sale.statut === "annulee").length);
    }

    const getFilteredSales = () => {
      const query = String(search?.value ?? "").trim().toLocaleLowerCase("fr");
      return state.sales.filter((sale) => {
        const searchable = `${sale.reference} ${sale.idClientLabel} ${sale.invoiceReference ?? ""}`.toLocaleLowerCase("fr");
        return (!query || searchable.includes(query))
          && (!statusFilter?.value || sale.statut === statusFilter.value)
          && (!paymentFilter?.value || sale.modePaiement === paymentFilter.value);
      });
    };

    const render = () => {
      const filtered = getFilteredSales();
      const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
      if (state.page > totalPages) state.page = totalPages;
      if (state.page < 1) state.page = 1;
      const startIndex = (state.page - 1) * state.pageSize;
      const pageRows = filtered.slice(startIndex, startIndex + state.pageSize);
      renderTable(table, pageRows, columns, state.config);
      const endIndex = Math.min(filtered.length, startIndex + pageRows.length);
      const countText = filtered.length === 0
        ? "Aucune vente à afficher"
        : `Affichage de ${startIndex + 1} à ${endIndex} sur ${filtered.length} vente${filtered.length === 1 ? "" : "s"}`;
      if (headerCount) headerCount.textContent = `${filtered.length} vente${filtered.length === 1 ? "" : "s"} affichée${filtered.length === 1 ? "" : "s"} sur ${state.sales.length}`;
      if (footerCount) footerCount.textContent = countText;
      renderListPagination(paginationNav, state.page, totalPages, (targetPage) => {
        state.page = targetPage;
        render();
      });
    };

    const showExportError = (message) => {
      if (!exportError) return;
      exportError.textContent = message;
      exportError.classList.remove("d-none");
    };

    const getExportRows = () => {
      const start = parseDateInputValue(exportStart?.value);
      const end = parseDateInputValue(exportEnd?.value, true);
      if (!start || !end || start > end) return null;
      return getFilteredSales().filter((sale) => {
        const date = new Date(sale.dateVente);
        return !Number.isNaN(date.getTime()) && date >= start && date <= end;
      });
    };

    const updateExportSummary = () => {
      if (!exportSummary) return;
      const start = parseDateInputValue(exportStart?.value);
      const end = parseDateInputValue(exportEnd?.value, true);
      if (!start || !end || start > end) {
        exportSummary.textContent = "";
        return;
      }
      const total = getFilteredSales().filter((sale) => {
        const date = new Date(sale.dateVente);
        return !Number.isNaN(date.getTime()) && date >= start && date <= end;
      }).length;
      exportSummary.textContent = `${total} vente${total === 1 ? "" : "s"} dans la période sélectionnée.`;
    };

    state.prepareExport = () => {
      const bounds = dateBounds(state.sales, "dateVente");
      if (exportStart && !exportStart.value) exportStart.value = dateInputValue(bounds.min);
      if (exportEnd && !exportEnd.value) exportEnd.value = dateInputValue(bounds.max);
      exportError?.classList.add("d-none");
      updateExportSummary();
    };

    if (!state.attached) {
      search?.addEventListener("input", () => {
        state.page = 1;
        render();
      });
      statusFilter?.addEventListener("change", () => {
        state.page = 1;
        render();
      });
      paymentFilter?.addEventListener("change", () => {
        state.page = 1;
        render();
      });
      pageSizeSelect?.addEventListener("change", () => {
        state.pageSize = Number(pageSizeSelect.value) || 10;
        state.page = 1;
        render();
      });
      [exportStart, exportEnd].forEach((input) => input?.addEventListener("change", updateExportSummary));
      exportModal?.addEventListener("show.bs.modal", () => state.prepareExport());
      exportForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        exportError?.classList.add("d-none");
        const start = parseDateInputValue(exportStart?.value);
        const end = parseDateInputValue(exportEnd?.value, true);
        if (!start || !end) {
          showExportError("Veuillez renseigner la date de début et la date de fin.");
          return;
        }
        if (start > end) {
          showExportError("La date de début doit précéder la date de fin.");
          return;
        }
        const rows = getExportRows();
        if (!rows?.length) {
          showExportError("Aucune vente n'est disponible sur cette période.");
          return;
        }
        const originalLabel = exportSubmit?.innerHTML;
        if (exportSubmit) {
          exportSubmit.disabled = true;
          exportSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Exportation...';
        }
        try {
          await exportSales(rows, exportFormat?.value || "xlsx", start, end);
          window.bootstrap?.Modal?.getOrCreateInstance(exportModal)?.hide();
        } catch (error) {
          console.error("Export des ventes :", error);
          showExportError(error.message || "Impossible d'exporter les ventes.");
        } finally {
          if (exportSubmit) {
            exportSubmit.disabled = false;
            exportSubmit.innerHTML = originalLabel;
          }
        }
      });
      state.attached = true;
    }
    render();
  }

  async function setupReturns(returns, config) {
    const main = document.querySelector("main");
    const table = mainTable(0);
    if (!main || !table) return;
    const state = table._gescoReturnsState ?? { rows: [], config, attached: false };
    state.rows = returns;
    state.config = config;
    table._gescoReturnsState = state;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const inMonth = (value) => {
      const parsed = new Date(value);
      return !Number.isNaN(parsed.getTime()) && parsed >= monthStart;
    };
    const monthlyReturns = returns.filter((row) => row.type === "retour" && inMonth(row.date));
    const refunded = monthlyReturns.reduce((sum, row) => sum + Number(row.montant || 0), 0);
    const cancelled = returns.filter((row) => row.type === "annulation" && inMonth(row.date)).length;
    const pending = returns.filter((row) => row.type === "retour" && row.statut === "en_attente").length;
    const indicators = main.querySelectorAll(".row.g-3.mb-4 .card-body h3");
    if (indicators.length >= 4) {
      indicators[0].textContent = String(monthlyReturns.length);
      indicators[1].textContent = money(refunded);
      indicators[2].textContent = String(cancelled);
      indicators[3].textContent = String(pending);
    }

    const search = main.querySelector("#returns-search");
    const statusFilter = main.querySelector("#returns-status-filter");
    const render = () => {
      const query = String(search?.value ?? "").trim().toLocaleLowerCase("fr");
      const filtered = state.rows.filter((row) => {
        const searchable = `${row.reference ?? ""} ${row.venteReference ?? ""} ${row.motif ?? ""}`.toLocaleLowerCase("fr");
        return (!query || searchable.includes(query))
          && (!statusFilter?.value || row.statut === statusFilter.value);
      });
      renderTable(table, filtered, state.config.tables[0].columns, state.config);
      const count = main.querySelector("#returns-result-count");
      if (count) {
        count.textContent = `${filtered.length} opération${filtered.length === 1 ? "" : "s"} affichée${filtered.length === 1 ? "" : "s"} sur ${state.rows.length}`;
      }
    };
    if (!state.attached) {
      search?.addEventListener("input", render);
      statusFilter?.addEventListener("change", render);
      state.attached = true;
    }
    render();

    const cancelButton = main.querySelector("#cancel-sale-btn");
    if (cancelButton && !cancelButton._gescoBound) {
      cancelButton._gescoBound = true;
      cancelButton.addEventListener("click", () => showCancelSaleForm(config));
    }
  }

  async function setupReceptions(receipts, config) {
    const main = document.querySelector("main");
    const table = mainTable(0);
    if (!main || !table) return;
    const state = table._gescoReceptionsState ?? { rows: [], config, attached: false };
    state.rows = receipts;
    state.config = config;
    table._gescoReceptionsState = state;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const inMonth = (value) => {
      const parsed = new Date(value);
      return !Number.isNaN(parsed.getTime()) && parsed >= monthStart;
    };
    const monthly = receipts.filter((row) => inMonth(row.dateReception));
    const monthlyQuantity = monthly.reduce((sum, row) => sum + Number(row.quantiteRecue || 0), 0);
    const monthlyValue = monthly.reduce((sum, row) => sum + Number(row.montantRecu || 0), 0);
    const partial = receipts.filter((row) => row.receptionStatut === "partielle").length;
    const indicators = main.querySelectorAll(".row.g-3.mb-4 .card-body h3");
    if (indicators.length >= 4) {
      indicators[0].textContent = String(monthly.length);
      indicators[1].textContent = monthlyQuantity.toLocaleString("fr-FR");
      indicators[2].textContent = String(partial);
      indicators[3].textContent = money(monthlyValue);
    }

    const search = main.querySelector("#receptions-search");
    const statusFilter = main.querySelector("#receptions-status-filter");
    const render = () => {
      const query = String(search?.value ?? "").trim().toLocaleLowerCase("fr");
      const filtered = state.rows.filter((row) => {
        const searchable = `${row.reference ?? ""} ${row.idCommandeLabel ?? ""} ${row.fournisseurNom ?? ""}`.toLocaleLowerCase("fr");
        return (!query || searchable.includes(query))
          && (!statusFilter?.value || row.receptionStatut === statusFilter.value);
      });
      renderTable(table, filtered, state.config.tables[0].columns, state.config);
      const count = main.querySelector("#receptions-result-count");
      if (count) {
        count.textContent = `${filtered.length} réception${filtered.length === 1 ? "" : "s"} affichée${filtered.length === 1 ? "" : "s"} sur ${state.rows.length}`;
      }
    };
    if (!state.attached) {
      search?.addEventListener("input", render);
      statusFilter?.addEventListener("change", render);
      state.attached = true;
    }
    render();
  }

  async function showCancelSaleForm(target) {
    const overlay = document.createElement("div");
    overlay.className = "gesco-modal-backdrop";
    overlay.setAttribute("role", "presentation");
    const panel = document.createElement("section");
    panel.className = "card adminuiux-card gesco-form-dialog shadow";
    panel.style.width = "min(40rem, 100%)";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");

    const title = document.createElement("h2");
    title.className = "h5 mb-0";
    title.textContent = "Annuler une vente";
    const header = document.createElement("div");
    header.className = "card-header d-flex align-items-center justify-content-between";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "btn-close";
    close.setAttribute("aria-label", "Fermer");
    close.addEventListener("click", () => overlay.remove());
    header.append(title, close);

    const form = document.createElement("form");
    form.className = "gesco-form";
    const body = document.createElement("div");
    body.className = "card-body";
    const error = document.createElement("div");
    error.className = "alert alert-danger d-none";
    error.setAttribute("role", "alert");
    const warning = document.createElement("p");
    warning.className = "small text-secondary";
    warning.textContent = "L'annulation remet les produits en stock et rembourse la vente.";
    body.append(error, warning);

    const sales = list(await api.getVentes()).filter((sale) => sale.statut !== "annulee");
    const saleSelect = document.createElement("select");
    saleSelect.className = "form-select";
    saleSelect.required = true;
    saleSelect.append(new Option("Sélectionner une vente", ""));
    sales.forEach((sale) => {
      const date = sale.dateVente ? new Date(sale.dateVente).toLocaleDateString("fr-FR") : "";
      saleSelect.append(new Option(`${sale.reference} — ${date} — ${money(sale.montantTotal)}`, sale.id));
    });
    const saleLabel = document.createElement("label");
    saleLabel.className = "form-label fw-semibold mt-3";
    saleLabel.textContent = "Vente à annuler";
    saleLabel.append(saleSelect);
    body.append(saleLabel);

    const actions = document.createElement("div");
    actions.className = "card-footer d-flex justify-content-end gap-2";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn btn-outline-secondary";
    cancel.textContent = "Annuler";
    cancel.addEventListener("click", () => overlay.remove());
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "btn btn-danger";
    submit.textContent = "Confirmer l'annulation";
    actions.append(cancel, submit);
    form.append(body, actions);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.classList.add("d-none");
      if (!saleSelect.value) {
        error.textContent = "Sélectionnez la vente à annuler.";
        error.classList.remove("d-none");
        return;
      }
      submit.disabled = true;
      try {
        await api.cancelVente(Number(saleSelect.value));
        overlay.remove();
        await loadPage(target);
      } catch (submitError) {
        error.textContent = submitError.message || "Échec de l'annulation.";
        error.classList.remove("d-none");
        submit.disabled = false;
      }
    });

    panel.append(header, form);
    overlay.append(panel);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) overlay.remove();
    });
    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") overlay.remove();
    });
    document.body.append(overlay);
    saleSelect.focus();
    return form;
  }

  async function loadPointOfSale() {
    const grid = document.getElementById("pos-product-grid");
    const cartContainer = document.getElementById("pos-cart-items");
    if (!grid || !cartContainer) return;
    const [products, clients, categories, settings] = await Promise.all([
      api.getProduits(),
      api.getClients(),
      api.getCategories(),
      api.getParametres(),
    ]);
    const [productRows, clientRows, categoryRows] = [products, clients, categories].map(list);
    const cart = new Map();
    const search = document.getElementById("pos-search");
    const clientSelect = document.getElementById("pos-client");
    const categoryContainer = document.getElementById("pos-categories");
    const emptyCatalog = document.getElementById("pos-empty-catalog");
    const errorBox = document.getElementById("pos-error");
    const checkout = document.getElementById("pos-checkout-btn");
    const receivedInput = document.getElementById("pos-received");
    const changeInput = document.getElementById("pos-change");
    const validityInput = document.getElementById("pos-validity");
    const guaranteeInput = document.getElementById("pos-guarantee");
    const paymentRadios = Array.from(document.querySelectorAll('input[name="payment"]'));
    const currentCategory = { id: "" };
    const taxRate = Number(settings?.tauxTaxe ?? 18);
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      throw new Error("Le taux de taxe configuré doit être compris entre 0 et 100 %.");
    }
    const applyTaxToggle = document.getElementById("pos-apply-tax");

    if (clientSelect) {
      clientSelect.replaceChildren(new Option("Client comptoir", ""));
      clientRows.forEach((client) => clientSelect.append(new Option(client.nom, client.id)));
    }
    function showError(message) {
      if (!errorBox) {
        window.alert(message);
        return;
      }
      errorBox.textContent = message;
      errorBox.classList.remove("d-none");
    }
    function clearError() {
      if (!errorBox) return;
      errorBox.textContent = "";
      errorBox.classList.add("d-none");
    }
    function paymentMethod() {
      if (document.getElementById("pay-momo")?.checked) return "mobile_money";
      if (document.getElementById("pay-card")?.checked) return "carte";
      return "especes";
    }
    function discountPercent() {
      const parsed = Number(document.getElementById("pos-discount")?.value || 0);
      return Math.min(100, Math.max(0, Number.isFinite(parsed) ? parsed : 0));
    }
    function totals() {
      const subtotal = roundedMoney([...cart.values()].reduce(
        (sum, item) => sum + Number(item.prixVente) * item.quantite, 0,
      ));
      const discount = roundedMoney(subtotal * discountPercent() / 100);
      const montantHT = roundedMoney(subtotal - discount);
      const applyTax = applyTaxToggle?.checked ?? true;
      const taxe = applyTax ? roundedMoney(montantHT * taxRate / 100) : 0;
      return { subtotal, discount, montantHT, taxe, total: roundedMoney(montantHT + taxe) };
    }
    function drawCategories() {
      if (!categoryContainer) return;
      const all = categoryContainer.querySelector('[data-cat="tous"]');
      categoryContainer.replaceChildren();
      if (all) categoryContainer.append(all);
      categoryRows.forEach((category) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn-sm btn-outline-secondary category-pill";
        button.dataset.categoryId = String(category.id);
        button.textContent = category.label;
        categoryContainer.append(button);
      });
    }
    function addProduct(product) {
      const stock = Number(product.stock ?? 0);
      const item = cart.get(product.id) ?? { ...product, quantite: 0 };
      if (item.quantite >= stock) {
        showError(`Stock insuffisant pour ${product.designation}.`);
        return false;
      }
      item.quantite += 1;
      cart.set(product.id, item);
      clearError();
      drawCart();
      return true;
    }
    function drawProducts() {
      grid.replaceChildren();
      const query = String(search?.value ?? "").trim().toLocaleLowerCase("fr");
      const filtered = productRows.filter((item) => {
        const searchable = `${item.designation ?? ""}`;
        return searchable.toLocaleLowerCase("fr").includes(query)
          && (!currentCategory.id || String(item.idCategorie) === currentCategory.id);
      });
      emptyCatalog?.classList.toggle("d-none", filtered.length > 0);
      filtered.forEach((product) => {
        const stock = Number(product.stock ?? 0);
        const column = document.createElement("div");
        column.className = "col-6 col-md-4 col-xl-3";
        const button = document.createElement("button");
        button.type = "button";
        button.className = `card adminuiux-card border-0 shadow-sm w-100 h-100 text-start p-3 pos-product-card${stock <= 0 ? " out-of-stock" : ""}`;
        button.disabled = stock <= 0;
        const name = document.createElement("strong");
        name.textContent = product.designation;
        const price = document.createElement("span");
        price.className = "mt-2 fw-bold";
        price.textContent = money(product.prixVente);
        const available = document.createElement("small");
        available.className = stock > 0 ? "text-success mt-1" : "text-danger mt-1";
        available.textContent = stock > 0 ? `Stock disponible : ${stock}` : "Rupture de stock";
        button.append(name, price, available);
        button.addEventListener("click", () => addProduct(product));
        column.append(button);
        grid.append(column);
      });
    }
    function drawCart() {
      cartContainer.replaceChildren();
      const count = [...cart.values()].reduce((sum, item) => sum + item.quantite, 0);
      if (!count) {
        const empty = document.createElement("p");
        empty.className = "text-secondary small text-center py-4";
        empty.textContent = "Panier vide — sélectionnez un produit";
        cartContainer.append(empty);
      }
      cart.forEach((item) => {
        const row = document.createElement("div");
        row.className = "d-flex justify-content-between align-items-center gap-2 py-2 border-bottom";
        const name = document.createElement("span");
        name.className = "pos-cart-line-name small";
        name.textContent = item.designation;
        const lineTotal = document.createElement("span");
        lineTotal.className = "small text-nowrap";
        lineTotal.textContent = money(Number(item.prixVente) * item.quantite);
        const controls = document.createElement("div");
        controls.className = "d-flex align-items-center gap-1";
        const minus = document.createElement("button");
        minus.type = "button";
        minus.className = "btn btn-sm btn-outline-secondary";
        minus.textContent = "−";
        minus.setAttribute("aria-label", `Retirer un ${item.designation}`);
        minus.addEventListener("click", () => {
          item.quantite -= 1;
          if (item.quantite < 1) cart.delete(item.id);
          drawCart();
        });
        const quantity = document.createElement("span");
        quantity.className = "small";
        quantity.textContent = String(item.quantite);
        const plus = document.createElement("button");
        plus.type = "button";
        plus.className = "btn btn-sm btn-outline-secondary";
        plus.textContent = "+";
        plus.setAttribute("aria-label", `Ajouter un ${item.designation}`);
        plus.disabled = item.quantite >= Number(item.stock || 0);
        plus.addEventListener("click", () => {
          if (item.quantite < Number(item.stock || 0)) item.quantite += 1;
          drawCart();
        });
        controls.append(minus, quantity, plus);
        row.append(name, controls, lineTotal);
        cartContainer.append(row);
      });
      const { subtotal, discount, taxe, total } = totals();
      document.getElementById("pos-cart-count").textContent = String(count);
      document.getElementById("pos-subtotal").textContent = money(subtotal);
      document.getElementById("pos-tax").textContent = money(taxe);
      document.getElementById("pos-total").textContent = money(total);
      const discountAmount = document.getElementById("pos-discount-amount");
      if (discountAmount) discountAmount.textContent = discount ? `(${money(discount)})` : "";
      const taxApplied = applyTaxToggle?.checked ?? true;
      document.getElementById("pos-tax-label").textContent = taxApplied ? `TVA (${taxRate}%)` : "TVA — non appliquée";
      const isCash = paymentMethod() === "especes";
      document.getElementById("pos-cash-row")?.classList.toggle("d-none", !isCash);
      const received = Number(receivedInput?.value || 0);
      if (changeInput) changeInput.value = money(isCash ? Math.max(0, received - total) : 0);
      if (checkout) checkout.disabled = count === 0 || (isCash && received < total);
      const checkoutHelp = document.getElementById("pos-checkout-help");
      if (checkoutHelp) {
        checkoutHelp.textContent = count === 0
          ? "Ajoutez un produit au panier pour continuer."
          : isCash && received < total
            ? `Saisissez au moins ${money(total)} dans « Montant reçu ».`
            : "";
      }
    }
    function resetSale() {
      cart.clear();
      document.getElementById("pos-discount").value = "0";
      if (applyTaxToggle) applyTaxToggle.checked = true;
      if (receivedInput) receivedInput.value = "";
      if (validityInput) validityInput.value = "";
      if (guaranteeInput) guaranteeInput.value = "";
      drawCart();
    }
    search?.addEventListener("input", drawProducts);
    search?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const scannedCode = search.value.trim().toLocaleLowerCase("fr");
      if (!scannedCode) return;
      const product = productRows.find((item) =>
        String(item.designation ?? "").trim().toLocaleLowerCase("fr") === scannedCode,
      );
      if (!product) {
        showError(`Aucun produit trouvé pour le code « ${search.value.trim()} ».`);
        return;
      }
      if (addProduct(product)) {
        search.value = "";
        drawProducts();
      }
    });
    document.getElementById("pos-discount")?.addEventListener("input", (event) => {
      const input = event.currentTarget;
      const value = Number(input.value);
      if (Number.isFinite(value)) input.value = String(Math.min(100, Math.max(0, value)));
      drawCart();
    });
    receivedInput?.addEventListener("input", drawCart);
    applyTaxToggle?.addEventListener("change", drawCart);
    paymentRadios.forEach((radio) => radio.addEventListener("change", drawCart));
    categoryContainer?.addEventListener("click", (event) => {
      const button = event.target.closest(".category-pill");
      if (!button) return;
      currentCategory.id = button.dataset.categoryId ?? "";
      categoryContainer.querySelectorAll(".category-pill").forEach((pill) => {
        pill.classList.toggle("active", pill === button);
        pill.classList.toggle("btn-theme", pill === button);
        pill.classList.toggle("btn-outline-secondary", pill !== button);
      });
      drawProducts();
    });
    document.getElementById("pos-new-sale-btn")?.addEventListener("click", resetSale);
    checkout?.addEventListener("click", async () => {
      clearError();
      if (!cart.size) {
        showError("Ajoutez au moins un produit.");
        return;
      }
      const { discount, total } = totals();
      const received = Number(receivedInput?.value || 0);
      const modePaiement = paymentMethod();
      if (modePaiement === "especes" && received < total) {
        showError("Le montant reçu est inférieur au total à payer.");
        return;
      }
      const discountRate = discountPercent();
      let discountAllocated = 0;
      const lines = [...cart.values()].map((item, index, all) => {
        const gross = roundedMoney(Number(item.prixVente) * item.quantite);
        const remise = index === all.length - 1
          ? roundedMoney(discount - discountAllocated)
          : roundedMoney(gross * discountRate / 100);
        discountAllocated = roundedMoney(discountAllocated + remise);
        return {
          idProduit: item.id,
          designation: item.designation,
          quantite: item.quantite,
          prixUnitaire: Number(item.prixVente),
          remise,
        };
      });
      const buttonText = checkout.innerHTML;
      checkout.disabled = true;
      checkout.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Enregistrement…';
      try {
        const response = await api.createVente({
          idClient: clientSelect?.value ? Number(clientSelect.value) : null,
          tauxTaxe: taxRate,
          tvaAppliquee: applyTaxToggle?.checked ?? true,
          montantPaye: total,
          ...(modePaiement === "especes" ? { montantRecu: received } : {}),
          modePaiement,
          donneesDocument: {
            validity: validityInput?.value.trim() || "",
            guarantee: guaranteeInput?.value.trim() || "",
          },
          lignes: lines,
        });
        const sale = response.data ?? response;
        document.getElementById("ticket-number").textContent = sale.reference;
        document.getElementById("ticket-date").textContent = new Date(sale.dateVente ?? Date.now()).toLocaleString("fr-FR");
        document.getElementById("ticket-total").textContent = money(sale.montantTotal ?? total);
        document.getElementById("ticket-payment").textContent = ({
          especes: "Espèces",
          mobile_money: "Mobile Money",
          carte: "Carte",
        })[modePaiement];
        document.getElementById("ticket-client").textContent = clientSelect?.selectedOptions[0]?.text ?? "Client comptoir";
        const cashDetail = document.getElementById("ticket-cash-detail");
        if (cashDetail) {
          cashDetail.classList.toggle("d-none", modePaiement !== "especes");
          cashDetail.textContent = modePaiement === "especes"
            ? `Reçu : ${money(received)} — Monnaie rendue : ${money(Math.max(0, received - total))}`
            : "";
        }
        const ticketLines = document.getElementById("ticket-lines");
        ticketLines.replaceChildren();
        lines.forEach((line) => {
          const element = document.createElement("li");
          element.className = "list-group-item d-flex justify-content-between px-0";
          const label = document.createElement("span");
          label.textContent = `${line.quantite} × ${line.designation}`;
          const amount = document.createElement("span");
          amount.textContent = money(roundedMoney(line.quantite * line.prixUnitaire - line.remise));
          element.append(label, amount);
          ticketLines.append(element);
        });
        const trackingNote = document.getElementById("pos-tracking-note");
        trackingNote.textContent = `Vente ${sale.reference} enregistrée.`;
        const invoiceButton = document.getElementById("pos-view-invoice-btn");
        if (invoiceButton) {
          invoiceButton.href = `gesco-facturation-detail.html?venteId=${encodeURIComponent(sale.id)}`;
          invoiceButton.classList.remove("d-none");
        }
        const deliveryButton = document.getElementById("pos-view-delivery-btn");
        if (deliveryButton) {
          deliveryButton.href = `gesco-livraison-detail.html?venteId=${encodeURIComponent(sale.id)}`;
          deliveryButton.classList.remove("d-none");
        }
        resetSale();
        drawCart();
        bootstrap.Modal.getOrCreateInstance(document.getElementById("modalTicket")).show();
      } catch (error) {
        showError(error.message || "Impossible d'enregistrer la vente.");
      } finally {
        checkout.innerHTML = buttonText;
        drawCart();
      }
    });

    drawCategories();
    drawProducts();
    drawCart();
    const preselectId = Number(new URLSearchParams(location.search).get("product"));
    if (Number.isSafeInteger(preselectId) && preselectId > 0) {
      const preselected = productRows.find((item) => Number(item.id) === preselectId);
      if (preselected && Number(preselected.stock ?? 0) > 0) {
        addProduct(preselected);
        cartContainer.scrollIntoView?.({ block: "nearest" });
      }
    }
  }

  async function setupProductDetail() {
    const id = findId();
    if (!id) return;
    const main = document.querySelector("main");
    let product;
    try {
      const result = await api.getProduit(id);
      product = result?.data ?? result;
    } catch (error) {
      window.alert(error.message || "Produit introuvable.");
      location.href = "gesco-stock-produits.html";
      return;
    }
    if (!product?.id) {
      window.alert("Produit introuvable.");
      location.href = "gesco-stock-produits.html";
      return;
    }

    const setText = (selector, value) => {
      const element = main?.querySelector(selector) ?? document.getElementById(selector.replace(/^#/, ""));
      if (element) element.textContent = value ?? "—";
    };
    const [categoryLabels, supplierLabels] = await Promise.all([
      loadReferenceMap("idCategorie"),
      loadReferenceMap("idFournisseur"),
    ]);

    const designation = product.designation || "Produit";
    document.title = `GESCO — ${designation} | SOLUTECH`;
    setText("#pd-breadcrumb", designation);
    setText("#pd-title", designation);
    setText("#pd-category", categoryLabels.get(String(product.idCategorie)) ?? (product.idCategorie ? `Catégorie ${product.idCategorie}` : "—"));
    setText(
      "#pd-supplier",
      product.idFournisseur
        ? (supplierLabels.get(String(product.idFournisseur)) ?? `Fournisseur ${product.idFournisseur}`)
        : "Aucun fournisseur",
    );

    const stock = Number(product.stock ?? 0);
    const seuil = Number(product.seuilMinimum ?? 0);
    setText("#pd-stock", String(stock));
    setText("#pd-price-sell", money(product.prixVente));

    const thresholdCard = document.getElementById("pd-alert-card");
    const thresholdMessage = document.getElementById("pd-threshold-message");
    if (thresholdCard) thresholdCard.classList.toggle("d-none", seuil <= 0);
    if (thresholdMessage) {
      thresholdMessage.replaceChildren(
        document.createTextNode(`Réapprovisionner sous ${seuil} unité${seuil === 1 ? "" : "s"} en stock. Actuellement : `),
      );
      const strong = document.createElement("strong");
      strong.textContent = String(stock);
      thresholdMessage.append(strong, document.createTextNode("."));
    }
    const sell = document.getElementById("pd-sell");
    if (sell) sell.href = `gesco-ventes-terminal.html?product=${encodeURIComponent(product.id)}`;
    const edit = document.getElementById("pd-edit");
    if (edit) edit.href = `gesco-stock-nouveau-produit.html?id=${encodeURIComponent(product.id)}`;

    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let sold = 0;
    try {
      const movements = list(await api.getStockMovements()).filter((row) => row.idProduit === Number(id));
      for (const row of movements) {
        const createdAt = new Date(row.createdAt).getTime();
        if (!Number.isFinite(createdAt) || createdAt < since) continue;
        if (row.type === "vente") sold += Math.abs(Number(row.quantite ?? 0));
        else if (row.type === "annulation_vente") sold -= Math.abs(Number(row.quantite ?? 0));
      }
    } catch {
      sold = 0;
    }
    setText("#pd-sold30", String(Math.max(0, sold)));

    if (product.archive) {
      setText("#pd-archived", "Archivé");
      document.getElementById("pd-archived")?.classList.remove("d-none");
      document.getElementById("pd-delete")?.classList.add("d-none");
      document.getElementById("pd-sell")?.setAttribute("aria-disabled", "true");
      document.getElementById("pd-sell")?.classList.add("disabled");
      return;
    }

    const deleteButton = document.getElementById("pd-delete");
    const deleteModalElement = document.getElementById("pd-delete-modal");
    const motifInput = document.getElementById("pd-delete-motif");
    const errorBox = document.getElementById("pd-delete-error");
    const confirmButton = document.getElementById("pd-delete-confirm");
    if (!deleteButton || !deleteModalElement || !motifInput || !confirmButton) return;
    const modal = window.bootstrap?.Modal?.getOrCreateInstance(deleteModalElement)
      ?? new (window.bootstrap.Modal)(deleteModalElement);
    deleteButton.addEventListener("click", () => {
      motifInput.value = "";
      errorBox?.classList.add("d-none");
      confirmButton.disabled = false;
      modal.show();
    });
    confirmButton.addEventListener("click", async () => {
      const motif = String(motifInput.value ?? "").trim();
      if (motif.length < 3) {
        if (errorBox) {
          errorBox.textContent = "Veuillez indiquer le motif de suppression.";
          errorBox.classList.remove("d-none");
        }
        motifInput.focus();
        return;
      }
      confirmButton.disabled = true;
      try {
        await api.deleteProduit(product.id, { motif });
        location.href = "gesco-stock-produits.html";
      } catch (error) {
        if (errorBox) {
          errorBox.textContent = error.message || "Impossible de supprimer le produit.";
          errorBox.classList.remove("d-none");
        }
        confirmButton.disabled = false;
      }
    });
  }

  async function loadProductCreationForm() {
    const form = document.getElementById("product-form");
    if (!form) return;
    const categorySelect = document.getElementById("product-category");
    const supplierSelect = document.getElementById("product-supplier");
    const [categories, suppliers] = await Promise.all([
      api.getCategories(),
      api.getFournisseurs(),
    ]);
    categorySelect.replaceChildren(new Option("Sélectionner une catégorie", ""));
    list(categories).forEach((category) => {
      categorySelect.append(new Option(category.label, category.id));
    });
    supplierSelect.replaceChildren(new Option("Aucun fournisseur", ""));
    list(suppliers).forEach((supplier) => {
      supplierSelect.append(new Option(supplier.nom, supplier.id));
    });

    // Bouton "ajouter une catégorie" : soumission de la modale + rafraîchissement
    const addCategoryForm = document.getElementById("add-category-form");
    if (addCategoryForm) {
      addCategoryForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const alertEl = document.getElementById("add-category-alert");
        const submitBtn = document.getElementById("add-category-submit");
        const input = document.getElementById("new-category-label");
        const label = input.value.trim();
        if (!label) {
          alertEl.textContent = "Indiquez un nom de catégorie.";
          alertEl.classList.remove("d-none");
          return;
        }
        alertEl.classList.add("d-none");
        submitBtn.disabled = true;
        try {
          const result = await api.createCategorie({ label });
          const created = result?.data ?? result;
          if (created?.id) {
            categorySelect.append(new Option(created.label, created.id));
            categorySelect.value = String(created.id);
          }
          input.value = "";
          const modalEl = document.getElementById("addCategoryModal");
          if (window.bootstrap && bootstrap.Modal) {
            bootstrap.Modal.getOrCreateInstance(modalEl).hide();
          }
        } catch (error) {
          alertEl.textContent = error.message || "Impossible de créer la catégorie.";
          alertEl.classList.remove("d-none");
        } finally {
          submitBtn.disabled = false;
        }
      });
    }

    const editId = findId();
    let product = null;
    if (editId) {
      try {
        const result = await api.getProduit(editId);
        product = result?.data ?? result;
      } catch (error) {
        window.alert(error.message || "Produit introuvable.");
        location.href = "/gesco-stock-produits.html";
        return;
      }
      if (!product?.id) {
        window.alert("Produit introuvable.");
        location.href = "/gesco-stock-produits.html";
        return;
      }
      const setValue = (field, value) => {
        const element = document.getElementById(field);
        if (element) element.value = value ?? "";
      };
      setValue("product-designation", product.designation);
      categorySelect.value = product.idCategorie ?? "";
      setValue("product-description", product.description);
      setValue("product-price", product.prixVente);
      setValue("product-stock", product.stock);
      setValue("product-threshold", product.seuilMinimum);
      supplierSelect.value = product.idFournisseur ?? "";
      document.title = `GESCO — ${product.designation} (modification) | SOLUTECH`;
      const pageTitle = document.getElementById("product-page-title");
      const breadcrumb = document.getElementById("product-breadcrumb");
      const submit = form.querySelector('button[type="submit"]');
      if (pageTitle) pageTitle.textContent = "Modifier le produit";
      if (breadcrumb) breadcrumb.textContent = "Modifier le produit";
      if (submit) submit.textContent = "Enregistrer les modifications";
    }

    const alertBox = document.createElement("div");
    alertBox.className = "alert d-none";
    alertBox.setAttribute("role", "alert");
    form.querySelector(".card-body").prepend(alertBox);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      alertBox.className = "alert d-none";
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      try {
        const payload = {
          designation: document.getElementById("product-designation").value.trim(),
          idCategorie: categorySelect.value,
          description: document.getElementById("product-description").value.trim(),
          prixVente: document.getElementById("product-price").value,
          seuilMinimum: document.getElementById("product-threshold").value || "0",
          idFournisseur: supplierSelect.value,
        };
        const stockValue = document.getElementById("product-stock").value || "0";
        if (!product || Number(stockValue) !== Number(product.stock ?? 0)) {
          payload.stockInitial = stockValue;
        }
        if (product) {
          await api.updateProduit(product.id, payload);
          location.href = `/gesco-stock-produit-detail.html?id=${encodeURIComponent(product.id)}`;
          return;
        }
        await api.createProduit(payload);
        location.href = "/gesco-stock-produits.html";
      } catch (error) {
        alertBox.textContent = error.message
          || (product ? "Impossible d'enregistrer les modifications." : "Impossible de créer le produit.");
        alertBox.className = "alert alert-danger";
        submit.disabled = false;
      }
    });
  }

  async function init() {
    try {
      const config = apiPages[page];
      if (config) {
        config.key = config.create ?? config.key;
        config.detail = {
          "gesco-stock-produits.html": "gesco-stock-produit-detail.html",
          "gesco-approvisionnement-fournisseurs.html": "gesco-approvisionnement-fournisseur-detail.html",
          "gesco-approvisionnement-commandes.html": "gesco-approvisionnement-commande-detail.html",
          "gesco-ventes.html": "gesco-ventes-detail.html",
          "gesco-facturation.html": "gesco-facturation-detail.html",
        }[page];
        await loadPage(config);
        if (config.create) createButton(config.create, config);
        if (page === "gesco-stock-mouvements.html") await setupLossDialog(config);
      }
      if (page === "gesco-clients-detail.html") await loadClientDetail();
      if (page === "gesco-stock-produit-detail.html") await setupProductDetail();
      if (page === "gesco-caisse.html" || page === "gesco-ventes-terminal.html") await loadPointOfSale();
      if (page === "gesco-stock-nouveau-produit.html") await loadProductCreationForm();
      if (page === "gesco-administration.html") {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn-theme";
        button.textContent = forms.parametres.title;
        button.addEventListener("click", async () => {
          const settings = await api.getParametres();
          const form = await showForm("parametres", { tables: [], settings });
          if (settings) {
            Object.entries(settings).forEach(([name, value]) => {
              const input = form.elements.namedItem(name);
              if (input) input.value = value ?? "";
            });
          }
        });
        const main = document.querySelector("main");
        const toolbar = main?.querySelector(".container-fluid > .row");
        const actions = toolbar?.querySelector(".col-auto");
        if (actions) actions.append(button);
        else if (main) main.prepend(button);
      }
    } catch (error) {
      console.error("Erreur de chargement des données GESCO :", error);
      const alertBox = document.createElement("div");
      alertBox.className = "alert alert-danger";
      alertBox.textContent = error.message || "Impossible de charger les données.";
      document.querySelector("main")?.prepend(alertBox);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
