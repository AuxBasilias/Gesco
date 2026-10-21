(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    const api = window.AA;
    if (!api) return;
    const money = (v) => `${Number(v || 0).toLocaleString("fr-FR")} FCFA`;
    const num = (v) => Number(v || 0).toLocaleString("fr-FR");
    const tbody = document.getElementById("fournisseurs-tbody");
    const fStat = document.querySelector('[data-stat="fournisseurs"]');
    const cStat = document.querySelector('[data-stat="commandes"]');
    const aStat = document.querySelector('[data-stat="achats"]');
    const pag = document.getElementById("fournisseurs-pagination");

    const form = document.getElementById("formFournisseur");
    const formError = document.getElementById("fournisseurFormError");
    const saveBtn = document.getElementById("btnSaveFournisseur");
    const deleteBtn = document.getElementById("btnConfirmDeleteFournisseur");
    const deleteText = document.getElementById("modalDeleteFournisseurText");
    let editingId = null;
    let deletingId = null;

    function list(v) { return Array.isArray(v) ? v : Array.isArray(v && v.data) ? v.data : []; }

    function getModal(id) {
      const el = document.getElementById(id);
      if (!el || !window.bootstrap || !window.bootstrap.Modal) return null;
      return window.bootstrap.Modal.getOrCreateInstance(el);
    }

    function hideModal(id) {
      const modal = getModal(id);
      if (modal) modal.hide();
    }

    function showError(message) {
      if (!formError) {
        window.alert(message);
        return;
      }
      formError.textContent = message;
      formError.classList.remove("d-none");
    }

    function clearError() {
      if (!formError) return;
      formError.textContent = "";
      formError.classList.add("d-none");
    }

    function fillForm(sup) {
      document.getElementById("fournisseur-nom").value = sup.nom || "";
      document.getElementById("fournisseur-tel").value = sup.tel || "";
      document.getElementById("fournisseur-email").value = sup.email || "";
      document.getElementById("fournisseur-adresse").value = sup.adresse || "";
      document.getElementById("fournisseur-nif").value = sup.nif || "";
    }

    function openEditModal(sup) {
      editingId = sup.id;
      fillForm(sup);
      clearError();
      const modal = getModal("modalFournisseur");
      if (modal) modal.show();
    }

    function openDeleteModal(sup) {
      deletingId = sup.id;
      if (deleteText) {
        deleteText.textContent = `Êtes-vous sûr de vouloir supprimer le fournisseur "${sup.nom || "ce fournisseur"}" ?`;
      }
      const modal = getModal("modalConfirmDeleteFournisseur");
      if (modal) modal.show();
    }

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!editingId) return;
      const payload = {
        nom: document.getElementById("fournisseur-nom").value.trim(),
        tel: document.getElementById("fournisseur-tel").value.trim(),
        email: document.getElementById("fournisseur-email").value.trim(),
        adresse: document.getElementById("fournisseur-adresse").value.trim(),
        nif: document.getElementById("fournisseur-nif").value.trim(),
      };
      if (!payload.nom) {
        showError("Le nom du fournisseur est obligatoire.");
        return;
      }
      clearError();
      if (saveBtn) saveBtn.disabled = true;
      try {
        await api.updateFournisseur(editingId, payload);
        editingId = null;
        hideModal("modalFournisseur");
        await load();
      } catch (err) {
        console.error(err);
        showError(err.message || "Impossible de modifier le fournisseur.");
      } finally {
        if (saveBtn) saveBtn.disabled = false;
      }
    });

    deleteBtn?.addEventListener("click", async () => {
      if (!deletingId) return;
      const originalLabel = deleteBtn.textContent;
      deleteBtn.disabled = true;
      deleteBtn.textContent = "Suppression...";
      try {
        await api.deleteFournisseur(deletingId);
        deletingId = null;
        hideModal("modalConfirmDeleteFournisseur");
        await load();
      } catch (err) {
        console.error(err);
        window.alert(err.message || "Impossible de supprimer ce fournisseur.");
      } finally {
        deleteBtn.disabled = false;
        deleteBtn.textContent = originalLabel;
      }
    });

    async function load() {
      try {
        const [fournisseurs, commandes] = await Promise.all([api.getFournisseurs(), api.getCommandes()]);
        const f = list(fournisseurs);
        const c = list(commandes);
        if (fStat) fStat.textContent = num(f.length);
        if (cStat) cStat.textContent = num(c.length);
        const totalAchats = c.reduce((s, row) => s + Number(row.montantTotal || 0), 0);
        if (aStat) aStat.textContent = totalAchats >= 1000000 ? `${(totalAchats / 1000000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}M` : money(totalAchats);
        if (!tbody) return;
        tbody.innerHTML = "";
        if (f.length === 0) {
          const tr = document.createElement("tr");
          const td = document.createElement("td");
          td.colSpan = 6;
          td.className = "text-center text-secondary py-4";
          td.textContent = "Aucun fournisseur enregistré.";
          tr.append(td);
          tbody.append(tr);
          if (pag) pag.textContent = "Affichage de 0 fournisseur";
          return;
        }
        const cmdByF = {};
        c.forEach((row) => {
          const id = row.idFournisseur;
          if (!cmdByF[id]) cmdByF[id] = { count: 0, total: 0 };
          cmdByF[id].count += 1;
          cmdByF[id].total += Number(row.montantTotal || 0);
        });
        f.forEach((sup) => {
          const agg = cmdByF[sup.id] || { count: 0, total: 0 };
          const tr = document.createElement("tr");
          const tdNom = document.createElement("td");
          const link = document.createElement("a");
          link.href = `gesco-approvisionnement-fournisseur-detail.html?id=${encodeURIComponent(sup.id)}`;
          link.className = "fw-medium";
          link.textContent = sup.nom || "—";
          tdNom.append(link);
          const tdTel = document.createElement("td");
          tdTel.className = "small";
          tdTel.textContent = sup.tel || "—";
          const tdEmail = document.createElement("td");
          tdEmail.className = "small";
          tdEmail.textContent = sup.email || "—";
          const tdAdr = document.createElement("td");
          tdAdr.className = "small";
          tdAdr.textContent = sup.adresse || "—";
          const tdNif = document.createElement("td");
          tdNif.className = "small";
          tdNif.textContent = sup.nif || "—";
          const tdActions = document.createElement("td");
          tdActions.className = "text-end text-nowrap";
          const detail = document.createElement("a");
          detail.href = `gesco-approvisionnement-fournisseur-detail.html?id=${encodeURIComponent(sup.id)}`;
          detail.className = "btn btn-sm btn-square btn-link";
          detail.title = "Consulter";
          detail.setAttribute("aria-label", `Consulter ${sup.nom || "ce fournisseur"}`);
          detail.innerHTML = '<i class="bi bi-eye"></i>';
          const edit = document.createElement("button");
          edit.type = "button";
          edit.className = "btn btn-sm btn-square btn-link";
          edit.title = "Modifier";
          edit.setAttribute("aria-label", `Modifier ${sup.nom || "ce fournisseur"}`);
          edit.innerHTML = '<i class="bi bi-pencil"></i>';
          edit.addEventListener("click", () => openEditModal(sup));
          const del = document.createElement("button");
          del.type = "button";
          del.className = "btn btn-sm btn-square btn-link text-danger";
          del.title = "Supprimer";
          del.setAttribute("aria-label", `Supprimer ${sup.nom || "ce fournisseur"}`);
          del.innerHTML = '<i class="bi bi-trash"></i>';
          del.addEventListener("click", () => openDeleteModal(sup));
          tdActions.append(detail, edit, del);
          tr.append(tdNom, tdTel, tdEmail, tdAdr, tdNif, tdActions);
          tbody.append(tr);
        });
        if (pag) pag.textContent = `Affichage de 1 à ${f.length} sur ${f.length} fournisseur${f.length > 1 ? "s" : ""}`;
      } catch (e) {
        console.error("Chargement fournisseurs :", e);
        if (tbody) {
          tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Erreur lors du chargement des fournisseurs.</td></tr>';
        }
      }
    }
    load();
  });
})();
