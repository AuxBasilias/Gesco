(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    const api = window.AA;
    if (!api) return;

    const LIST_URL = "gesco-approvisionnement-fournisseurs.html";
    const COMMANDES_URL = "gesco-approvisionnement-commandes.html";
    const DETAIL_COMMANDE_URL = "gesco-approvisionnement-commande-detail.html";

    const money = (v) => `${Number(v || 0).toLocaleString("fr-FR")} FCFA`;
    const num = (v) => Number(v || 0).toLocaleString("fr-FR");
    const escapeHtml = (v) =>
      String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    const STATUTS = {
      brouillon: ["Brouillon", "text-bg-secondary"],
      envoyee: ["Envoyée", "text-bg-primary"],
      partielle: ["Partiellement reçue", "text-bg-warning"],
      recue: ["Reçue", "text-bg-success"],
      annulee: ["Annulée", "text-bg-danger"],
    };

    const el = {
      error: document.getElementById("fournisseurDetailError"),
      breadcrumb: document.getElementById("breadcrumbFournisseur"),
      titre: document.getElementById("fournisseurTitre"),
      avatar: document.getElementById("fournisseurAvatar"),
      cardNom: document.getElementById("fournisseurCardNom"),
      depuis: document.getElementById("fournisseurDepuis"),
      statut: document.getElementById("fournisseurStatut"),
      email: document.getElementById("fournisseurEmail"),
      emailRow: document.getElementById("fournisseurEmailRow"),
      tel: document.getElementById("fournisseurTel"),
      telRow: document.getElementById("fournisseurTelRow"),
      adresse: document.getElementById("fournisseurAdresse"),
      adresseRow: document.getElementById("fournisseurAdresseRow"),
      nif: document.getElementById("fournisseurNif"),
      nifRow: document.getElementById("fournisseurNifRow"),
      statCommandes: document.getElementById("statCommandes"),
      statAchats: document.getElementById("statAchats"),
      statEnCours: document.getElementById("statEnCours"),
      statDerniere: document.getElementById("statDerniere"),
      tbodyCommandes: document.getElementById("commandesFournisseur-tbody"),
      tbodyProduits: document.getElementById("produitsFournisseur-tbody"),
      btnEdit: document.getElementById("btnEditFournisseur"),
      btnDelete: document.getElementById("btnDeleteFournisseur"),
      form: document.getElementById("formFournisseur"),
      formError: document.getElementById("fournisseurFormError"),
      saveBtn: document.getElementById("btnSaveFournisseur"),
      deleteBtn: document.getElementById("btnConfirmDeleteFournisseur"),
      deleteText: document.getElementById("modalDeleteFournisseurText"),
      deleteWarning: document.getElementById("modalDeleteFournisseurWarning"),
    };

    const id = Number(new URLSearchParams(window.location.search).get("id"));
    let fournisseur = null;
    let stats = null;

    function getModal(modalId) {
      const node = document.getElementById(modalId);
      if (!node || !window.bootstrap || !window.bootstrap.Modal) return null;
      return window.bootstrap.Modal.getOrCreateInstance(node);
    }

    function hideModal(modalId) {
      const modal = getModal(modalId);
      if (modal) modal.hide();
    }

    function showError(message) {
      if (!el.error) {
        window.alert(message);
        return;
      }
      el.error.textContent = message;
      el.error.classList.remove("d-none");
    }

    function clearError() {
      if (!el.error) return;
      el.error.textContent = "";
      el.error.classList.add("d-none");
    }

    function formatDate(value) {
      if (!value) return "—";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "—";
      return date.toLocaleDateString("fr-FR");
    }

    function formatMonthYear(value) {
      if (!value) return "—";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "—";
      return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    }

    function compactMoney(value) {
      const total = Number(value || 0);
      if (total >= 1000000) {
        return `${(total / 1000000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}M`;
      }
      return money(total);
    }

    function fillContact(node, row, value, fallback) {
      if (!node) return;
      if (value) {
        node.textContent = value;
        row?.classList.remove("d-none");
      } else {
        node.textContent = fallback;
        row?.classList.add("d-none");
      }
    }

    function renderFournisseur(data) {
      fournisseur = data;
      const nom = data.nom || "Fournisseur";
      if (el.breadcrumb) el.breadcrumb.textContent = nom;
      if (el.titre) el.titre.textContent = nom;
      if (el.cardNom) el.cardNom.textContent = nom;
      if (el.avatar) {
        const initiales = nom
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0].toUpperCase())
          .join("");
        el.avatar.innerHTML = initiales
          ? `<span class="fw-bold">${escapeHtml(initiales)}</span>`
          : '<i class="bi bi-truck fs-3"></i>';
      }
      if (el.depuis) {
        el.depuis.textContent = data.createdAt
          ? `Fournisseur depuis ${formatMonthYear(data.createdAt)}`
          : "Fournisseur";
      }
      fillContact(el.email, el.emailRow, data.email, "");
      fillContact(el.tel, el.telRow, data.tel, "");
      fillContact(el.adresse, el.adresseRow, data.adresse, "");
      fillContact(el.nif, el.nifRow, data.nif, "");
      if (el.statut) el.statut.textContent = "Actif";
      if (el.btnEdit) el.btnEdit.disabled = false;
      if (el.btnDelete) el.btnDelete.disabled = false;
    }

    function renderStats(data) {
      stats = data || null;
      const totaux = data?.totaux ?? {};
      if (el.statCommandes) el.statCommandes.textContent = num(totaux.nbCommandes ?? 0);
      if (el.statAchats) el.statAchats.textContent = compactMoney(totaux.totalAchats ?? 0);
      if (el.statEnCours) el.statEnCours.textContent = num(totaux.enCours ?? 0);
      if (el.statDerniere) {
        el.statDerniere.textContent = totaux.derniereCommande ? formatDate(totaux.derniereCommande) : "—";
      }
    }

    function renderCommandes(commandes) {
      if (!el.tbodyCommandes) return;
      el.tbodyCommandes.innerHTML = "";
      if (!commandes || commandes.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 4;
        td.className = "text-center text-secondary py-4";
        td.textContent = "Aucune commande pour ce fournisseur.";
        tr.append(td);
        el.tbodyCommandes.append(tr);
        return;
      }
      commandes.forEach((commande) => {
        const tr = document.createElement("tr");

        const tdRef = document.createElement("td");
        const link = document.createElement("a");
        link.href = `${DETAIL_COMMANDE_URL}?id=${encodeURIComponent(commande.id)}`;
        link.textContent = commande.reference || "—";
        tdRef.append(link);

        const tdDate = document.createElement("td");
        tdDate.className = "small";
        tdDate.textContent = formatDate(commande.dateCommande);

        const tdMontant = document.createElement("td");
        tdMontant.className = "text-end fw-medium";
        tdMontant.textContent = money(commande.montantTotal);

        const tdStatut = document.createElement("td");
        const [label, cls] = STATUTS[commande.statut] ?? [commande.statut || "—", "text-bg-secondary"];
        const badge = document.createElement("span");
        badge.className = `badge badge-light ${cls}`;
        badge.textContent = label;
        tdStatut.append(badge);

        tr.append(tdRef, tdDate, tdMontant, tdStatut);
        el.tbodyCommandes.append(tr);
      });
    }

    function renderProduits(produits) {
      if (!el.tbodyProduits) return;
      el.tbodyProduits.innerHTML = "";
      if (!produits || produits.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 3;
        td.className = "text-center text-secondary py-4";
        td.textContent = "Aucun produit commandé pour le moment.";
        tr.append(td);
        el.tbodyProduits.append(tr);
        return;
      }
      produits.forEach((produit) => {
        const tr = document.createElement("tr");

        const tdDesignation = document.createElement("td");
        tdDesignation.className = "small";
        tdDesignation.textContent = produit.designation || "—";

        const tdQuantite = document.createElement("td");
        tdQuantite.className = "text-center small";
        tdQuantite.textContent = num(produit.quantite);

        const tdPrix = document.createElement("td");
        tdPrix.className = "text-end small";
        tdPrix.textContent = money(produit.dernierPrix);

        tr.append(tdDesignation, tdQuantite, tdPrix);
        el.tbodyProduits.append(tr);
      });
    }

    function fillForm(data) {
      document.getElementById("fournisseur-nom").value = data.nom || "";
      document.getElementById("fournisseur-tel").value = data.tel || "";
      document.getElementById("fournisseur-email").value = data.email || "";
      document.getElementById("fournisseur-adresse").value = data.adresse || "";
      document.getElementById("fournisseur-nif").value = data.nif || "";
    }

    function showFormError(message) {
      if (!el.formError) {
        window.alert(message);
        return;
      }
      el.formError.textContent = message;
      el.formError.classList.remove("d-none");
    }

    function clearFormError() {
      if (!el.formError) return;
      el.formError.textContent = "";
      el.formError.classList.add("d-none");
    }

    el.btnEdit?.addEventListener("click", () => {
      if (!fournisseur) return;
      fillForm(fournisseur);
      clearFormError();
      getModal("modalFournisseur")?.show();
    });

    el.btnDelete?.addEventListener("click", () => {
      if (!fournisseur) return;
      const nbCommandes = Number(stats?.totaux?.nbCommandes ?? 0);
      if (el.deleteText) {
        el.deleteText.textContent = `Êtes-vous sûr de vouloir supprimer le fournisseur "${fournisseur.nom || "ce fournisseur"}" ?`;
      }
      if (el.deleteWarning) {
        el.deleteWarning.textContent = nbCommandes > 0
          ? `Attention : ${nbCommandes} commande(s) sont rattachées à ce fournisseur. La suppression sera refusée.`
          : "Cette action est irréversible.";
      }
      getModal("modalConfirmDeleteFournisseur")?.show();
    });

    el.form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!fournisseur) return;
      const payload = {
        nom: document.getElementById("fournisseur-nom").value.trim(),
        tel: document.getElementById("fournisseur-tel").value.trim(),
        email: document.getElementById("fournisseur-email").value.trim(),
        adresse: document.getElementById("fournisseur-adresse").value.trim(),
        nif: document.getElementById("fournisseur-nif").value.trim(),
      };
      if (!payload.nom) {
        showFormError("Le nom du fournisseur est obligatoire.");
        return;
      }
      clearFormError();
      if (el.saveBtn) el.saveBtn.disabled = true;
      try {
        const response = await api.updateFournisseur(fournisseur.id, payload);
        const updated = response?.data ?? { ...fournisseur, ...payload };
        renderFournisseur(updated);
        hideModal("modalFournisseur");
        showError("");
        clearError();
        await load();
      } catch (err) {
        console.error(err);
        showFormError(err.message || "Impossible de modifier le fournisseur.");
      } finally {
        if (el.saveBtn) el.saveBtn.disabled = false;
      }
    });

    el.deleteBtn?.addEventListener("click", async () => {
      if (!fournisseur) return;
      const originalLabel = el.deleteBtn.textContent;
      el.deleteBtn.disabled = true;
      el.deleteBtn.textContent = "Suppression...";
      try {
        await api.deleteFournisseur(fournisseur.id);
        window.location.href = LIST_URL;
      } catch (err) {
        console.error(err);
        hideModal("modalConfirmDeleteFournisseur");
        showError(err.message || "Impossible de supprimer ce fournisseur.");
      } finally {
        el.deleteBtn.disabled = false;
        el.deleteBtn.textContent = originalLabel;
      }
    });

    async function load() {
      if (!id || Number.isNaN(id)) {
        showError("Aucun fournisseur sélectionné. Veuillez revenir à la liste des fournisseurs.");
        if (el.titre) el.titre.textContent = "Fournisseur introuvable";
        return;
      }
      try {
        const [supplierResponse, statsResponse] = await Promise.all([
          api.getFournisseur(id),
          api.getFournisseurStats(id).catch(() => null),
        ]);
        const data = supplierResponse?.data ?? supplierResponse;
        if (!data) {
          showError("Fournisseur introuvable.");
          return;
        }
        renderFournisseur(data);
        const statsData = statsResponse?.data ?? statsResponse;
        if (statsData) {
          renderStats(statsData);
          renderCommandes(statsData.commandes ?? []);
          renderProduits(statsData.produits ?? []);
        } else {
          renderStats({});
          renderCommandes([]);
          renderProduits([]);
        }
        clearError();
      } catch (e) {
        console.error("Chargement du fournisseur :", e);
        showError(e.message || "Erreur lors du chargement du fournisseur.");
        if (el.titre) el.titre.textContent = "Fournisseur introuvable";
      }
    }

    load();
  });
})();
