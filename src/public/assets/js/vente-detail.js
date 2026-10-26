(function () {
  "use strict";

  const api = window.AA;
  if (!api) return;

  const esc = (v) => String(v ?? "");
  const money = (v) => `${Number(v || 0).toLocaleString("fr-FR")} FCFA`;
  const dateTime = (v) => {
    if (!v) return "—";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return esc(v);
    return d.toLocaleString("fr-FR");
  };
  const date = (v) => {
    if (!v) return "—";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return esc(v);
    return d.toLocaleDateString("fr-FR");
  };

  function getId() {
    const q = new URLSearchParams(location.search).get("id");
    if (q) return q;
    const m = location.pathname.match(/-(\d+)\.html$/);
    return m?.[1] || null;
  }

  let currentVente = null;
  let livraisonType = null;

  function buildLivraisonRows(vente) {
    const body = document.getElementById("livraison-lignes-body");
    if (!body) return;
    body.replaceChildren();
    (vente.lignes || []).forEach((line) => {
      const tr = document.createElement("tr");
      const quantite = Number(line.quantite || 0);
      tr.innerHTML = `
        <td>${esc(line.designation)}</td>
        <td class="text-center">${quantite}</td>
        <td class="text-center" style="max-width:120px;">
          <input type="number" class="form-control form-control-sm text-center" min="0" max="${quantite}" value="${quantite}" data-id-ligne="${esc(line.id)}" data-max="${quantite}">
        </td>
      `;
      body.appendChild(tr);
    });
  }

  function openLivraisonModal() {
    if (!currentVente) return;
    livraisonType = null;
    const partielleBlock = document.getElementById("livraison-partielle-block");
    const errorEl = document.getElementById("livraison-error");
    const validateBtn = document.getElementById("btn-livraison-valider");
    if (partielleBlock) partielleBlock.classList.add("d-none");
    if (errorEl) { errorEl.classList.add("d-none"); errorEl.textContent = ""; }
    if (validateBtn) validateBtn.disabled = true;
    document.querySelectorAll("[data-livraison-type]").forEach((btn) => btn.classList.remove("active", "btn-theme"));
    buildLivraisonRows(currentVente);
    const modalEl = document.getElementById("modalLivraison");
    if (modalEl && window.bootstrap) bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  function selectLivraisonType(type) {
    livraisonType = type;
    document.querySelectorAll("[data-livraison-type]").forEach((btn) => {
      const active = btn.dataset.livraisonType === type;
      btn.classList.toggle("active", active);
      btn.classList.toggle("btn-theme", active);
      btn.classList.toggle("btn-outline-secondary", !active);
    });
    const partielleBlock = document.getElementById("livraison-partielle-block");
    const validateBtn = document.getElementById("btn-livraison-valider");
    if (partielleBlock) partielleBlock.classList.toggle("d-none", type !== "partielle");
    if (validateBtn) validateBtn.disabled = false;
  }

  function submitLivraison() {
    if (!currentVente || !livraisonType) return;
    const errorEl = document.getElementById("livraison-error");
    const base = `gesco-livraison-detail.html?venteId=${encodeURIComponent(currentVente.id)}`;
    if (livraisonType === "complete") {
      window.location.href = `${base}&type=complete`;
      return;
    }
    const inputs = Array.from(document.querySelectorAll("#livraison-lignes-body input[data-id-ligne]"));
    const parts = [];
    let hasPartial = false;
    let error = "";
    inputs.forEach((input) => {
      const max = Number(input.dataset.max || 0);
      const value = Number(input.value);
      if (!Number.isInteger(value) || value < 0 || value > max) {
        error = "Chaque quantité à livrer doit être un entier entre 0 et la quantité commandée.";
        return;
      }
      if (value < max) hasPartial = true;
      parts.push(`${input.dataset.idLigne}:${value}`);
    });
    if (error) {
      if (errorEl) { errorEl.textContent = error; errorEl.classList.remove("d-none"); }
      return;
    }
    if (!hasPartial) {
      window.location.href = `${base}&type=complete`;
      return;
    }
    window.location.href = `${base}&type=partielle&q=${encodeURIComponent(parts.join(","))}`;
  }

  async function hydrate(vente) {
    if (!vente) return;

    currentVente = vente;

    const main = document.querySelector("main");
    if (!main) return;

    const title = main.querySelector("h4.mb-0");
    if (title) title.textContent = `Vente ${vente.reference || ""}`;

    const breadcrumbLast = main.querySelector(".breadcrumb .breadcrumb-item.active");
    if (breadcrumbLast) breadcrumbLast.textContent = vente.reference || "";

    const meta = main.querySelector(".d-flex.justify-content-between.align-items-start.mb-4 p.small.text-secondary");
    if (meta) {
      const parts = [];
      if (vente.dateVente) parts.push(dateTime(vente.dateVente));
      if (vente.idUtilisateur) parts.push(vente.nomUtilisateur || vente.utilisateurNom || vente.idUtilisateur);
      meta.innerHTML = parts.join(" &middot; ");
    }

    const badge = main.querySelector(".d-flex.justify-content-between.align-items-start.mb-4 .badge");
    if (badge) {
      if (vente.statut === "annulee") {
        badge.className = "badge badge-light text-bg-danger";
        badge.textContent = "Annulée";
      } else {
        badge.className = "badge badge-light text-bg-success";
        badge.textContent = "Validée";
      }
    }

    const factureLink = document.getElementById("btn-voir-facture");
    if (factureLink && vente.id) {
      factureLink.href = `gesco-facturation-detail.html?venteId=${encodeURIComponent(vente.id)}`;
    }

    const cancelBtn = document.getElementById("btn-annuler-vente");
    if (cancelBtn) {
      if (vente.statut === "annulee") {
        cancelBtn.classList.add("disabled");
        cancelBtn.setAttribute("disabled", "disabled");
      } else {
        cancelBtn.classList.remove("disabled");
        cancelBtn.removeAttribute("disabled");
        cancelBtn.onclick = async () => {
          const confirmed = await (window.confirmAction ? window.confirmAction({
            title: "Annuler cette vente ?",
            message: "Les articles seront remis en stock automatiquement et un mouvement de type 'Annulation de vente' sera enregistré. Cette action est tracée.",
            confirmLabel: "Confirmer l'annulation",
            tone: "danger",
          }) : window.confirm("Annuler cette vente ?"));
          if (!confirmed) return;
          cancelBtn.disabled = true;
          try {
            await api.cancelVente(vente.id);
            window.location.reload();
          } catch (e) {
            cancelBtn.disabled = false;
            window.alert(e.message || "Impossible d'annuler la vente.");
          }
        };
      }
    }

    const subtotalEl = Array.from(main.querySelectorAll(".d-flex.justify-content-between.small.mb-1 span")).find(s => /sous-total/i.test(s.textContent));
    if (subtotalEl) {
      const next = subtotalEl.nextElementSibling;
      if (next) next.textContent = money(vente.montantHT);
    }

    const remiseEl = Array.from(main.querySelectorAll(".d-flex.justify-content-between.small.mb-1 span")).find(s => /remise/i.test(s.textContent));
    if (remiseEl) {
      const next = remiseEl.nextElementSibling;
      if (next) {
        const remise = Number(vente.remise || 0);
        if (remise > 0 && remise <= 100) next.textContent = `${remise}%`;
        else if (remise > 0) next.textContent = money(remise);
        else next.textContent = "0%";
      }
    }

    const tvaEl = Array.from(main.querySelectorAll(".d-flex.justify-content-between.small.mb-2 span")).find(s => /tva/i.test(s.textContent));
    if (tvaEl) {
      const next = tvaEl.nextElementSibling;
      if (next) next.textContent = money(vente.montantTaxe);
      if (!vente.tvaAppliquee) {
        tvaEl.textContent = "TVA";
        if (next) next.textContent = "0 FCFA";
      } else if (/18%/.test(tvaEl.textContent)) {
        // keep label as is if percentage not explicit; ensure matches
      }
    }

    const totalEl = main.querySelector(".d-flex.justify-content-between.align-items-center .fw-bold.fs-4");
    if (totalEl) totalEl.textContent = money(vente.montantTotal);

    // Client
    const clientCard = main.querySelectorAll(".card.adminuiux-card.border-0.shadow-sm.mb-4")[1];
    if (clientCard) {
      const nameEl = clientCard.querySelector(".fw-medium.small");
      const typeEl = clientCard.querySelector(".small.text-secondary.mb-0");
      const avatar = clientCard.querySelector(".avatar");
      const link = clientCard.querySelector("a.btn");
      if (vente.idClient) {
        if (nameEl) nameEl.textContent = vente.clientNom || vente.nomClient || `Client ${vente.idClient}`;
        if (typeEl) typeEl.textContent = vente.clientType || vente.type || "";
        if (avatar) avatar.textContent = (nameEl?.textContent || "CL").slice(0, 2).toUpperCase();
        if (link) {
          link.href = `gesco-clients-detail.html?id=${encodeURIComponent(vente.idClient)}`;
          link.classList.remove("disabled");
        }
      } else {
        if (nameEl) nameEl.textContent = "Client comptoir";
        if (typeEl) typeEl.textContent = "Comptoir";
        if (avatar) avatar.textContent = "CC";
        if (link) {
          link.href = "#";
          link.classList.add("disabled");
          link.setAttribute("aria-disabled", "true");
          link.style.pointerEvents = "none";
          link.style.opacity = "0.6";
        }
      }
    }

    // Paiement
    const payCard = main.querySelectorAll(".card.adminuiux-card.border-0.shadow-sm")[2] || main.querySelector(".col-lg-4 .card:last-child");
    if (payCard) {
      const ps = payCard.querySelectorAll("p");
      // mode
      const modeMap = { especes: "Espèces", mobile_money: "Mobile Money", carte: "Carte", virement: "Virement", cheque: "Chèque" };
      if (ps[1]) ps[1].textContent = modeMap[vente.modePaiement] || vente.modePaiement || "—";
      if (ps[3]) ps[3].textContent = money(vente.montantPaye);
      const monnaie = Math.max(0, Number(vente.montantPaye || 0) - Number(vente.montantTotal || 0));
      if (ps[5]) ps[5].textContent = money(monnaie);
    }
  }

  window.__hydrateVenteDetail = hydrate;

  document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("btn-generer-livraison")?.addEventListener("click", openLivraisonModal);
    document.querySelectorAll("[data-livraison-type]").forEach((btn) => {
      btn.addEventListener("click", () => selectLivraisonType(btn.dataset.livraisonType));
    });
    document.getElementById("btn-livraison-valider")?.addEventListener("click", submitLivraison);

    const id = getId();
    if (!id) return;
    try {
      const vente = await api.getVente(id);
      hydrate(vente);
    } catch (e) {
      console.error(e);
    }
  });
})();
