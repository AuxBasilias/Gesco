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
      tables: [{ load: api.getProduits, columns: [["Référence", "numeroSerie"], ["Désignation", "designation"], ["Catégorie", "idCategorie"], ["Prix de vente", "prixVente", "money"], ["Stock", "stock"], ["Seuil", "seuilMinimum"], ["État", "stockState", "status"]] }],
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
      tables: [{ load: api.getFournisseurs, columns: [["Fournisseur", "nom"], ["Téléphone", "tel"], ["E-mail", "email"], ["Adresse", "adresse"], ["NIF", "nif"]] }],
      create: "fournisseur",
    },
    "gesco-approvisionnement-fournisseur-detail.html": {
      tables: [
        { load: async () => {
          const id = findId();
          if (!id) return [];
          const supplierId = Number(id);
          return list(await api.getCommandes()).filter((row) => row.idFournisseur === supplierId);
        }, columns: [["N° commande", "reference"], ["Date", "dateCommande", "date"], ["Montant", "montantTotal", "money"], ["Statut", "statut"]] },
        { load: async () => {
          const id = findId();
          if (!id) return [];
          const supplierId = Number(id);
          return list(await api.getStocks()).filter((row) => row.idFournisseur === supplierId);
        }, columns: [["Produit", "designation"], ["Référence", "numeroSerie"], ["Prix d'achat", "prixAchat", "money"], ["Stock", "stock"]] },
      ],
    },
    "gesco-stock-produit-detail.html": {
      tables: [
        { load: async () => {
          const id = findId();
          if (!id) return [];
          return list(await api.getStockMovements()).filter((row) => row.idProduit === Number(id));
        }, columns: [["Date", "createdAt", "date"], ["Type", "type"], ["Quantité", "quantite"], ["Référence", "reference"], ["Motif", "motif"]] },
        { load: async () => {
          const id = findId();
          if (!id) return [];
          const productId = Number(id);
          const sales = list(await api.getVentes());
          const details = await Promise.all(sales.map((sale) => api.getVente(sale.id)));
          return details.flatMap((sale) => (sale.lignes ?? []).filter((line) => line.idProduit === productId).map((line) => ({ ...line, reference: sale.reference, dateVente: sale.dateVente, idClient: sale.idClient })));
        }, columns: [["Vente", "reference"], ["Date", "dateVente", "date"], ["Quantité", "quantite"], ["Prix", "prixUnitaire", "money"], ["Montant", "montantTotal", "money"]] },
      ],
    },
    "gesco-approvisionnement-commandes.html": {
      tables: [{ load: loadOrderHistory, columns: [["N° commande", "reference"], ["Date", "dateCommande", "date"], ["Fournisseur", "idFournisseur"], ["Articles", "articleCount"], ["Montant", "montantTotal", "money"], ["Statut", "statut", "status"], ["Livraison prévue", "dateLivraisonPrevue", "date"]] }],
      create: "commande",
    },
    "gesco-approvisionnement-receptions.html": {
      tables: [{ load: api.getReceptions, columns: [["N° réception", "reference"], ["Date", "dateReception", "date"], ["Commande", "idCommande"], ["Statut", "statut"], ["Réceptionné par", "idUtilisateur"]] }],
    },
    "gesco-stock-mouvements.html": {
      tables: [{ load: api.getStockMovements, columns: [["Date", "createdAt", "date"], ["Type", "type", "movementType"], ["Produit", "idProduit"], ["Quantité", "quantite", "quantity"], ["Référence", "reference"], ["Motif", "motif"]] }],
      create: "mouvement",
    },
    "gesco-stock-inventaires.html": {
      tables: [{ load: api.getInventories, columns: [["Référence", "reference"], ["Date", "dateInventaire", "date"], ["Responsable", "idUtilisateur"], ["Statut", "statut"]] }],
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
        return result.lignes ?? [];
      }, columns: [["Produit", "designation"], ["Quantité", "quantite"], ["Prix unitaire", "prixUnitaire", "money"], ["Montant", "montantTotal", "money"]] }],
    },
    "gesco-ventes-retours.html": {
      tables: [{ load: api.getRetours, columns: [["N° retour", "reference"], ["Date", "dateRetour", "date"], ["Vente", "idVente"], ["Motif", "motif"], ["Montant remboursé", "montantRembourse", "money"], ["Statut", "statut"]] }],
      create: "retour",
    },
    "gesco-ventes-sessions.html": {
      tables: [{ load: api.getSessionsCaisse, columns: [["Session", "reference"], ["Ouverture", "dateOuverture", "date"], ["Clôture", "dateFermeture", "date"], ["Caissier", "idUtilisateur"], ["Fond", "fondOuverture", "money"], ["Attendu", "montantAttendu", "money"], ["Écart", "ecart", "money"], ["Statut", "statut"]] }],
      create: "session",
    },
    "gesco-caisse-historique.html": {
      tables: [{ load: api.getFactures, columns: [["N° document", "reference"], ["Date", "dateFacture", "date"], ["Client", "idClient"], ["Total", "montantTotal", "money"], ["Payé", "montantPaye", "money"], ["Solde", "solde", "money"], ["Statut", "statut"]] }],
    },
    "gesco-facturation.html": {
      tables: [{ load: api.getFactures, columns: [["N° document", "reference"], ["Date", "dateFacture", "date"], ["Client", "idClient"], ["Total TTC", "montantTotal", "money"], ["Payé", "montantPaye", "money"], ["Solde", "solde", "money"], ["Statut", "statut"], ["Échéance", "dateEcheance", "date"]] }],
      create: "facture",
    },
    "gesco-facturation-paiements.html": {
      tables: [
        { load: api.getPaiements, columns: [["Référence", "reference"], ["Date", "datePaiement", "date"], ["Facture", "idFacture"], ["Montant", "montant", "money"], ["Mode", "modePaiement"], ["Enregistré par", "idUtilisateur"]] },
        { load: api.getFactures, columns: [["Facture", "reference"], ["Client", "idClient"], ["Montant total", "montantTotal", "money"], ["Solde", "solde", "money"], ["Échéance", "dateEcheance", "date"]] },
      ],
      create: "paiement",
    },
    "gesco-administration-rapports.html": {
      tables: [
        { load: async () => (await api.getStocks()).map((row) => ({ ...row, marge: Number(row.prixVente) - Number(row.prixAchat) })), columns: [["Produit", "designation"], ["Stock", "stock"], ["Prix de vente", "prixVente", "money"], ["Marge", "marge", "money"]] },
        { load: async () => {
          const report = await api.getRapport({});
          return report.clients || [];
        }, columns: [["Client", "nom"], ["Achats", "totalAchats", "money"], ["Solde dû", "soldeDu", "money"], ["Dernier achat", "dernierAchat", "date"]] },
      ],
    },
    "gesco-administration.html": {
      tables: [
        { load: api.getUtilisateurs, columns: [["Utilisateur", "nomUtilisateur"], ["E-mail", "email"], ["Téléphone", "telephone"], ["Rôle", "role", "userRole"], ["État", "actif", "status"]] },
        { load: api.getSessionsCaisse, columns: [["Session", "reference"], ["Caissier", "idUtilisateur"], ["Ouverture", "dateOuverture", "date"], ["Statut", "statut"]] },
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
        ["numeroSerie", "Référence", "text"],
        ["idCategorie", "Catégorie", "category", true],
        ["codeBarres", "Code-barres", "text"],
        ["description", "Description", "textarea"],
        ["prixAchat", "Prix d'achat", "number", true],
        ["prixVente", "Prix de vente", "number", true],
        ["stockInitial", "Stock initial", "number"],
        ["seuilMinimum", "Seuil minimum", "number"],
        ["idFournisseur", "Fournisseur principal", "supplier"],
        ["garantie", "Garantie", "text"],
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
      fields: [["notes", "Notes", "textarea"]],
    },
    retour: {
      title: "Enregistrer un retour",
      method: api.createRetour,
      fields: [["idVente", "Vente concernée", "sale", true], ["motif", "Motif", "textarea", true], ["lignes", "Lignes (JSON : idLigneVente, quantite)", "textarea", true]],
    },
    session: {
      title: "Ouvrir une caisse",
      method: api.openSessionCaisse,
      fields: [["fondOuverture", "Fond d'ouverture", "number", true]],
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
      fields: [["nomUtilisateur", "Nom d'utilisateur", "text", true], ["email", "E-mail", "email", true], ["telephone", "Téléphone"], ["motDePasse", "Mot de passe (8 caractères minimum)", "password", true], ["role", "Rôle", "select", true, [["user", "Utilisateur standard"], ["admin", "Administrateur"]]]],
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
      session: ["Ouvrir une session"],
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
      return list(await api.getFactures()).map((item) => [item.id, item.reference]);
    }
    return [];
  }

  async function showForm(key, target, editUser = null) {
    if (key === "commande") return showOrderForm(target);
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
    save.textContent = "Enregistrer";
    actions.append(cancel, save);
    form.append(body, actions);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.classList.add("d-none");
      save.disabled = true;
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
          await definition.method(data);
        }
        overlay.remove();
        await loadPage(target);
      } catch (submitError) {
        error.textContent = submitError.message || "Échec de l'enregistrement.";
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
        const reference = product.numeroSerie ? ` · ${product.numeroSerie}` : "";
        const stock = Number(product.stock ?? 0);
        const minimum = Number(product.seuilMinimum ?? 0);
        productSelect.append(new Option(
          `${product.designation}${reference} — Stock : ${stock} (minimum ${minimum})`,
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
        if (selected) price.value = String(Number(selected.prixAchat) || 0);
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
      referenceCache.set(key, loader().then((result) => new Map(
        list(result).map((item) => [String(item.id), item[labelField] ?? item.id]),
      )));
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
      })[value] ?? (value ? esc(value) : "—");
    }
    if (formatter === "userRole") {
      return value === "admin" ? "Administrateur" : value === "user" ? "Utilisateur standard" : esc(value || "—");
    }
    if (formatter === "saleStatus") {
      return ({
        payee: "Payée",
        partiellement_payee: "Partiellement payée",
        annulee: "Annulée",
      })[value] ?? (value ? esc(value) : "—");
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
        if (formatter === "status" || formatter === "movementType" || formatter === "saleStatus") {
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
        } else if (target.key === "produit" && key === "numeroSerie" && target.detail && row.id) {
          const link = document.createElement("a");
          link.className = "fw-medium";
          link.href = `${target.detail}?id=${encodeURIComponent(row.id)}`;
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
      if (target.key === "commande" && row.id) {
        const receive = document.createElement("button");
        receive.type = "button";
        receive.className = "btn btn-sm btn-outline-success ms-1";
        receive.textContent = "Réceptionner";
        receive.addEventListener("click", async () => {
          const raw = prompt("Saisissez les lignes réceptionnées au format JSON : [{\"idLigneCommande\":1,\"quantiteRecue\":1}]");
          if (!raw) return;
          try {
            await api.receiveCommande(row.id, { lignes: JSON.parse(raw) });
            await loadPage(target);
          } catch (error) {
            alert(error.message);
          }
        });
        actions.append(receive);
      }
      if (target.key === "session" && row.statut === "ouverte") {
        const close = document.createElement("button");
        close.type = "button";
        close.className = "btn btn-sm btn-outline-danger ms-1";
        close.textContent = "Clôturer";
        close.addEventListener("click", async () => {
          const montantCompte = prompt("Montant compté en caisse :");
          if (montantCompte === null) return;
          try {
            await api.closeSessionCaisse(row.id, { montantCompte: Number(montantCompte) });
            await loadPage(target);
          } catch (error) {
            alert(error.message);
          }
        });
        actions.append(close);
      }
      if (target.key === "vente" && row.statut !== "annulee" && row.id) {
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "btn btn-sm btn-square btn-link text-danger";
        cancel.title = "Annuler la vente";
        cancel.setAttribute("aria-label", "Annuler la vente");
        cancel.innerHTML = '<i class="bi bi-x-circle" aria-hidden="true"></i>';
        cancel.addEventListener("click", async () => {
          if (!window.confirm(`Annuler la vente ${row.reference} ?`)) return;
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
          if (!window.confirm(`Voulez-vous ${action} le compte ${row.nomUtilisateur} ?`)) return;
          try {
            await api.updateUtilisateur(row.id, { actif: !active });
            await loadPage(target);
          } catch (error) {
            window.alert(error.message || "Impossible de modifier le compte.");
          }
        });
        actions.append(toggle);
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
      if (page === "gesco-stock-produits.html" && index === 0) await setupProductCatalogue(rows, config);
      if (page === "gesco-stock-mouvements.html" && index === 0) setupStockMovements(rows, config);
      if (page === "gesco-ventes.html" && index === 0) setupSalesHistory(rows, config);
    }
  }

  function setupStockMovements(movements, config) {
    const main = document.querySelector("main");
    const table = mainTable(0);
    const search = main?.querySelector('input[placeholder*="Rechercher"]');
    const typeSelect = main?.querySelector("select.form-select");
    const columns = config.tables[0].columns;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const currentMonth = movements.filter((movement) => {
      const created = new Date(movement.createdAt);
      return !Number.isNaN(created.getTime()) && created >= monthStart;
    });
    const totalEntries = currentMonth.reduce((sum, movement) => sum + Math.max(0, Number(movement.quantite || 0)), 0);
    const totalExits = currentMonth.reduce((sum, movement) => sum + Math.max(0, -Number(movement.quantite || 0)), 0);
    const totalLosses = currentMonth
      .filter((movement) => movement.type === "perte")
      .reduce((sum, movement) => sum + Math.abs(Number(movement.quantite || 0)), 0);
    const indicators = main?.querySelectorAll(".row.g-3.mb-4 .card-body h3");
    if (indicators?.length >= 4) {
      indicators[0].textContent = currentMonth.length.toLocaleString("fr-FR");
      indicators[1].textContent = `+${totalEntries.toLocaleString("fr-FR")}`;
      indicators[2].textContent = `−${totalExits.toLocaleString("fr-FR")}`;
      indicators[3].textContent = `−${totalLosses.toLocaleString("fr-FR")}`;
    }

    if (typeSelect) {
      const labels = new Map();
      movements.forEach((movement) => {
        const label = normalize(movement, "type", "movementType");
        labels.set(movement.type, label);
      });
      typeSelect.replaceChildren(new Option("Tous les types", ""));
      [...labels].sort((left, right) => left[1].localeCompare(right[1], "fr"))
        .forEach(([value, label]) => typeSelect.append(new Option(label, value)));
    }

    const render = () => {
      const query = String(search?.value ?? "").trim().toLocaleLowerCase("fr");
      const filtered = movements.filter((movement) => {
        const searchable = [
          movement.idProduitLabel,
          normalize(movement, "type", "movementType"),
          movement.reference,
          movement.motif,
        ].join(" ").toLocaleLowerCase("fr");
        return (!query || searchable.includes(query))
          && (!typeSelect?.value || movement.type === typeSelect.value);
      });
      renderTable(table, filtered, columns, config);
      const count = main?.querySelector(".row.gx-3.align-items-center.mt-3 .small.text-secondary");
      if (count) {
        count.textContent = `Affichage de ${filtered.length} mouvement${filtered.length === 1 ? "" : "s"} sur ${movements.length}`;
      }
    };
    search?.addEventListener("input", render);
    typeSelect?.addEventListener("change", render);
    main?.querySelector(".pagination")?.closest("nav")?.classList.add("d-none");
    render();
  }

  async function setupProductCatalogue(products, config) {
    const main = document.querySelector("main");
    const search = main?.querySelector('input[type="search"], input[placeholder*="Rechercher"]');
    const selects = main ? Array.from(main.querySelectorAll("select.form-select")) : [];
    const [categorySelect, stateSelect] = selects;
    const table = mainTable(0);
    const render = (filtered) => renderTable(table, filtered, config.tables[0].columns, config);

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

    const update = () => {
      const query = String(search?.value ?? "").trim().toLocaleLowerCase("fr");
      const filtered = products.filter((item) => {
        const matchesQuery = !query || `${item.designation ?? ""} ${item.numeroSerie ?? ""} ${item.codeBarres ?? ""}`
          .toLocaleLowerCase("fr").includes(query);
        const matchesCategory = !categorySelect?.value || String(item.idCategorie) === categorySelect.value;
        const matchesState = !stateSelect?.value || item.stockState === stateSelect.value;
        return matchesQuery && matchesCategory && matchesState;
      });
      render(filtered);
      const count = main?.querySelector(".row.gx-3.align-items-center.mb-3 .small.text-secondary");
      if (count) {
        count.textContent = `${filtered.length} référence${filtered.length === 1 ? "" : "s"} affichée${filtered.length === 1 ? "" : "s"} sur ${products.length}`;
      }
      const footerCount = main?.querySelector(".row.gx-3.align-items-center.mt-3 .small.text-secondary");
      if (footerCount) {
        footerCount.textContent = `Affichage de ${filtered.length} résultat${filtered.length === 1 ? "" : "s"} sur ${products.length} référence${products.length === 1 ? "" : "s"}`;
      }
    };
    search?.addEventListener("input", update);
    categorySelect?.addEventListener("change", update);
    stateSelect?.addEventListener("change", update);

    const values = main?.querySelectorAll(".row.g-3.mb-4 .card-body h3");
    if (values?.length >= 4) {
      const stockValue = products.reduce((total, item) => total + Number(item.prixAchat || 0) * Number(item.stock || 0), 0);
      const lowStock = products.filter((item) => Number(item.stock || 0) > 0 && Number(item.stock || 0) <= Number(item.seuilMinimum || 0)).length;
      const outOfStock = products.filter((item) => Number(item.stock || 0) <= 0).length;
      values[0].textContent = products.length.toLocaleString("fr-FR");
      values[1].textContent = `${new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 2 }).format(stockValue)} FCFA`;
      values[2].textContent = String(lowStock);
      values[3].textContent = String(outOfStock);
    }
    const pagination = main?.querySelector(".pagination")?.closest("nav");
    if (pagination) pagination.classList.add("d-none");
    update();
  }

  async function loadClientDetail() {
    const id = findId();
    const container = document.getElementById("clientInfo");
    if (!id || !container) return;
    try {
      const [client, stats] = await Promise.all([api.getClient(id), api.getClientStats(id)]);
      const data = client.client ?? client;
      const title = document.createElement("h2");
      title.className = "h4";
      title.textContent = data.nom;
      const fields = [
        ["Type", data.type], ["E-mail", data.email], ["Téléphone", data.tel],
        ["Ville", data.ville], ["Adresse", data.adresse], ["NIF", data.nif],
        ["Achats", money(stats.totalAchats)], ["Solde dû", money(stats.soldeDu)],
        ["Dernier achat", date(stats.dernierAchat)],
      ];
      const listElement = document.createElement("dl");
      listElement.className = "row";
      fields.forEach(([label, value]) => {
        const dt = document.createElement("dt");
        dt.className = "col-sm-4";
        dt.textContent = label;
        const dd = document.createElement("dd");
        dd.className = "col-sm-8";
        dd.textContent = esc(value || "—");
        listElement.append(dt, dd);
      });
      container.replaceChildren(title, listElement);
    } catch (error) {
      container.textContent = error.message;
    }
  }

  function setupSalesHistory(sales, config) {
    const main = document.querySelector("main");
    const table = mainTable(0);
    if (!main || !table) return;
    const state = table._gescoSalesState ?? { sales: [], config, attached: false };
    state.sales = sales;
    state.config = config;
    table._gescoSalesState = state;
    const search = document.getElementById("sales-search");
    const statusFilter = document.getElementById("sales-status-filter");
    const paymentFilter = document.getElementById("sales-payment-filter");

    const todayKey = new Date().toLocaleDateString("fr-CA");
    const todaySales = sales.filter((sale) => new Date(sale.dateVente).toLocaleDateString("fr-CA") === todayKey);
    const completedToday = todaySales.filter((sale) => sale.statut !== "annulee");
    const indicators = main.querySelectorAll(".row.g-3.mb-4 .card-body h3");
    if (indicators.length >= 4) {
      const revenue = completedToday.reduce((sum, sale) => sum + Number(sale.montantPaye || 0), 0);
      indicators[0].textContent = String(completedToday.length);
      indicators[1].textContent = money(revenue);
      const todaySalesTotal = completedToday.reduce((sum, sale) => sum + Number(sale.montantTotal || 0), 0);
      indicators[2].textContent = money(completedToday.length ? todaySalesTotal / completedToday.length : 0);
      indicators[3].textContent = String(sales.filter((sale) => sale.statut === "annulee").length);
    }

    const render = () => {
      const query = String(search?.value ?? "").trim().toLocaleLowerCase("fr");
      const filtered = state.sales.filter((sale) => {
        const searchable = `${sale.reference} ${sale.idClientLabel} ${sale.invoiceReference ?? ""}`.toLocaleLowerCase("fr");
        return (!query || searchable.includes(query))
          && (!statusFilter?.value || sale.statut === statusFilter.value)
          && (!paymentFilter?.value || sale.modePaiement === paymentFilter.value);
      });
      renderTable(table, filtered, state.config.tables[0].columns, state.config);
      const count = main.querySelector("#sales-result-count");
      const countText = `${filtered.length} vente${filtered.length === 1 ? "" : "s"} affichée${filtered.length === 1 ? "" : "s"} sur ${state.sales.length}`;
      if (count) count.textContent = countText;
      const footerCount = main.querySelector("#sales-result-count-footer");
      if (footerCount) footerCount.textContent = countText;
    };
    if (!state.attached) {
      search?.addEventListener("input", render);
      statusFilter?.addEventListener("change", render);
      paymentFilter?.addEventListener("change", render);
      state.attached = true;
    }
    main.querySelector(".pagination")?.closest("nav")?.classList.add("d-none");
    render();
  }

  async function loadPointOfSale() {
    const grid = document.getElementById("pos-product-grid");
    const cartContainer = document.getElementById("pos-cart-items");
    if (!grid || !cartContainer) return;
    const [products, clients, categories, sessions, settings] = await Promise.all([
      api.getProduits(),
      api.getClients(),
      api.getCategories(),
      api.getSessionsCaisse(),
      api.getParametres(),
    ]);
    const [productRows, clientRows, categoryRows, sessionRows] = [products, clients, categories, sessions].map(list);
    const cart = new Map();
    const search = document.getElementById("pos-search");
    const clientSelect = document.getElementById("pos-client");
    const categoryContainer = document.getElementById("pos-categories");
    const emptyCatalog = document.getElementById("pos-empty-catalog");
    const errorBox = document.getElementById("pos-error");
    const checkout = document.getElementById("pos-checkout-btn");
    const receivedInput = document.getElementById("pos-received");
    const changeInput = document.getElementById("pos-change");
    const paymentRadios = Array.from(document.querySelectorAll('input[name="payment"]'));
    const closeButton = document.getElementById("caisse-close-btn");
    const openButton = document.getElementById("caisse-open-btn");
    const inlineOpenButton = document.getElementById("pos-session-open-inline");
    const sessionRequired = document.getElementById("pos-session-required");
    const closeModal = document.getElementById("modalFermerCaisse");
    const openModal = document.getElementById("modalOuvrirCaisse");
    const currentCategory = { id: "" };
    const taxRate = Number(settings?.tauxTaxe ?? 18);
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      throw new Error("Le taux de taxe configuré doit être compris entre 0 et 100 %.");
    }
    let cashSession = sessionRows.find((item) => item.statut === "ouverte") ?? null;

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
      const taxe = roundedMoney(montantHT * taxRate / 100);
      return { subtotal, discount, montantHT, taxe, total: roundedMoney(montantHT + taxe) };
    }
    function updateSessionStatus() {
      const badge = document.getElementById("caisse-status-badge");
      if (badge) {
        badge.className = cashSession
          ? "badge badge-light text-bg-success px-3 py-2"
          : "badge badge-light text-bg-warning px-3 py-2";
        badge.textContent = cashSession
          ? `Caisse ouverte — fond ${money(cashSession.fondOuverture)} — attendu ${money(cashSession.montantAttendu)}`
          : "Aucune caisse ouverte";
      }
      if (openButton) openButton.classList.toggle("d-none", Boolean(cashSession));
      if (closeButton) closeButton.classList.toggle("d-none", !cashSession);
      if (checkout) checkout.disabled = !cashSession || cart.size === 0;
      sessionRequired?.classList.toggle("d-none", Boolean(cashSession));
      const expected = closeModal?.querySelector("#pos-cash-expected");
      if (expected) expected.value = cashSession ? money(cashSession.montantAttendu) : "—";
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
        const searchable = `${item.designation ?? ""} ${item.numeroSerie ?? ""} ${item.codeBarres ?? ""}`;
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
        const referenceText = document.createElement("small");
        referenceText.className = "text-secondary";
        referenceText.textContent = product.numeroSerie || product.codeBarres || "Référence non renseignée";
        const price = document.createElement("span");
        price.className = "mt-2 fw-bold";
        price.textContent = money(product.prixVente);
        const available = document.createElement("small");
        available.className = stock > 0 ? "text-success mt-1" : "text-danger mt-1";
        available.textContent = stock > 0 ? `Stock disponible : ${stock}` : "Rupture de stock";
        button.append(name, referenceText, price, available);
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
      document.getElementById("pos-tax-label")?.replaceChildren(document.createTextNode(`TVA (${taxRate}%)`));
      const isCash = paymentMethod() === "especes";
      document.getElementById("pos-cash-row")?.classList.toggle("d-none", !isCash);
      const received = Number(receivedInput?.value || 0);
      if (changeInput) changeInput.value = money(isCash ? Math.max(0, received - total) : 0);
      if (checkout) checkout.disabled = !cashSession || count === 0 || (isCash && received < total);
      const checkoutHelp = document.getElementById("pos-checkout-help");
      if (checkoutHelp) {
        checkoutHelp.textContent = !cashSession
          ? "Ouvrez d'abord une session de caisse."
          : count === 0
            ? "Ajoutez un produit au panier pour continuer."
            : isCash && received < total
              ? `Saisissez au moins ${money(total)} dans « Montant reçu ».`
              : "";
      }
    }
    function resetSale() {
      cart.clear();
      document.getElementById("pos-discount").value = "0";
      if (receivedInput) receivedInput.value = "";
      drawCart();
    }
    search?.addEventListener("input", drawProducts);
    search?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const scannedCode = search.value.trim().toLocaleLowerCase("fr");
      if (!scannedCode) return;
      const product = productRows.find((item) =>
        [item.codeBarres, item.numeroSerie].some((value) =>
          String(value ?? "").trim().toLocaleLowerCase("fr") === scannedCode,
        ),
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
      if (!cart.size || !cashSession) {
        showError(!cashSession ? "Ouvrez une session de caisse avant d'encaisser." : "Ajoutez au moins un produit.");
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
          idSessionCaisse: cashSession.id,
          tauxTaxe: taxRate,
          montantPaye: total,
          ...(modePaiement === "especes" ? { montantRecu: received } : {}),
          modePaiement,
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
        if (modePaiement === "especes") {
          cashSession = {
            ...cashSession,
            montantAttendu: roundedMoney(Number(cashSession.montantAttendu) + Number(sale.montantPaye ?? total)),
          };
        }
        resetSale();
        updateSessionStatus();
        drawCart();
        bootstrap.Modal.getOrCreateInstance(document.getElementById("modalTicket")).show();
      } catch (error) {
        showError(error.message || "Impossible d'enregistrer la vente.");
      } finally {
        checkout.innerHTML = buttonText;
        updateSessionStatus();
        drawCart();
      }
    });

    const showOpenSession = () => {
      clearError();
      bootstrap.Modal.getOrCreateInstance(openModal).show();
    };
    openButton?.addEventListener("click", showOpenSession);
    inlineOpenButton?.addEventListener("click", showOpenSession);
    const openSessionSubmit = document.getElementById("pos-open-session-submit");
    openSessionSubmit?.addEventListener("click", async () => {
      const fondOuverture = Number(document.getElementById("pos-opening-fund")?.value);
      if (!Number.isFinite(fondOuverture) || fondOuverture < 0) {
        showError("Saisissez un fond de caisse valide.");
        return;
      }
      const originalLabel = openSessionSubmit.textContent;
      openSessionSubmit.disabled = true;
      openSessionSubmit.textContent = "Ouverture en cours…";
      try {
        const response = await api.openSessionCaisse({ fondOuverture });
        cashSession = response.data ?? response;
        bootstrap.Modal.getOrCreateInstance(openModal).hide();
        updateSessionStatus();
        drawCart();
      } catch (error) {
        showError(error.message || "Impossible d'ouvrir la caisse.");
        updateSessionStatus();
      } finally {
        openSessionSubmit.disabled = false;
        openSessionSubmit.textContent = originalLabel;
      }
    });
    document.getElementById("pos-close-session-submit")?.addEventListener("click", async () => {
      if (!cashSession) return;
      const montantCompte = Number(document.getElementById("pos-counted-cash")?.value);
      if (!Number.isFinite(montantCompte) || montantCompte < 0) {
        showError("Saisissez le montant compté dans la caisse.");
        return;
      }
      try {
        await api.closeSessionCaisse(cashSession.id, { montantCompte });
        cashSession = null;
        bootstrap.Modal.getOrCreateInstance(closeModal).hide();
        updateSessionStatus();
        drawCart();
      } catch (error) {
        showError(error.message || "Impossible de clôturer la caisse.");
      }
    });
    closeButton?.addEventListener("click", () => {
      const expected = closeModal?.querySelector("#pos-cash-expected");
      if (expected && cashSession) expected.value = money(cashSession.montantAttendu);
    });

    drawCategories();
    updateSessionStatus();
    drawProducts();
    drawCart();
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
          numeroSerie: document.getElementById("product-reference").value.trim(),
          idCategorie: categorySelect.value,
          codeBarres: document.getElementById("product-barcode").value.trim(),
          description: document.getElementById("product-description").value.trim(),
          prixAchat: document.getElementById("product-cost").value,
          prixVente: document.getElementById("product-price").value,
          stockInitial: document.getElementById("product-stock").value || "0",
          seuilMinimum: document.getElementById("product-threshold").value || "0",
          idFournisseur: supplierSelect.value,
          garantie: document.getElementById("product-warranty").value.trim(),
        };
        await api.createProduit(payload);
        location.href = "/gesco-stock-produits.html";
      } catch (error) {
        alertBox.textContent = error.message || "Impossible de créer le produit.";
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
      }
      if (page === "gesco-clients-detail.html") await loadClientDetail();
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
