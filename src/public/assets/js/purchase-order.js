(() => {
  "use strict";

  const root = document.getElementById("order-document");
  let currentOrder = null;

  const formatMoney = (value) => `${Number(value || 0).toLocaleString("fr-FR")} FCFA`;
  const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("fr-FR");
  };

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  const STATUT_LABELS = {
    brouillon: "Brouillon",
    envoyee: "Envoyée",
    partielle: "Partiellement reçue",
    recue: "Reçue",
    confirme: "Confirmé",
    annulee: "Annulée",
  };

  function renderOrder(order, settings) {
    const supplier = order.fournisseur || {};
    const lignes = Array.isArray(order.lignes) ? order.lignes : [];
    const totalItems = lignes.reduce((sum, line) => sum + Number(line.quantite || 0), 0);

    const companyName = settings?.nom || "SOLUTECH INNOVATION GROUP";
    const supplierName = supplier.nom || (order.idFournisseur ? `Fournisseur ${order.idFournisseur}` : "Fournisseur");
    const supplierContact = [supplier.tel, supplier.email].filter(Boolean).join(" · ");

    const headerHtml = `
      <header class="doc-header">
        <div class="logo-box">
          <img src="assets/img/invoice/logo_solutech.png" alt="SOLUTECH INNOVATION GROUP" class="main-logo">
        </div>
        <div class="header-content">
          <h1 class="slogan">INNOVATION AU SERVICE DE VOS SOLUTIONS</h1>
          <p class="activities">
            INGENIERIE – CONSULTING – VENTE – MAINTENANCE – RESEAU – FORMATION – BTP – IMPORT &amp; EXPORT
          </p>
          <div class="header-rule"></div>
        </div>
      </header>
    `;

    const metaHtml = `
      <section class="meta-section">
        <div class="client-card">
          <div class="client-header-title">Fournisseur</div>
          <div class="client-content-body">
            <div class="client-row">
              <span class="c-label">Fournisseur:</span>&nbsp;<span class="c-name">${escapeHtml(supplierName)}</span>
            </div>
            <div class="client-row client-email">${supplier.email ? '<a href="mailto:' + escapeHtml(supplier.email) + '" class="client-email-val">' + escapeHtml(supplier.email) + '</a>' : escapeHtml(supplierContact)}</div>
            <div class="client-row">${escapeHtml(supplier.adresse || "")}</div>
            <div class="client-row">${supplier.nif ? "NIF : " + escapeHtml(supplier.nif) : ""}</div>
            <div class="client-row client-location"></div>
          </div>
        </div>

        <div class="invoice-number-card">
          <div class="inv-title">BON DE COMMANDE</div>
          <div class="inv-code">${escapeHtml(order.reference)}</div>
        </div>

        <div class="tracking-card">
          <div class="tracking-top-row">
            <span class="date-lbl">Date</span>
            <span class="date-underline-val">${escapeHtml(formatDate(order.dateCommande))}</span>
          </div>
          <div class="tracking-subline-row">
            <div class="tracking-subline"></div>
          </div>
          <div class="tracking-mid-row">
            <span class="follow-lbl">Livraison prévue:</span>
            <span class="follow-name">${escapeHtml(formatDate(order.dateLivraisonPrevue))}</span>
          </div>
          <div class="tracking-bot-row">
            <span class="phone-val">${escapeHtml(STATUT_LABELS[order.statut] || order.statut || "—")}</span>
          </div>
        </div>
      </section>
    `;

    const DELIVERY_TABLE_BUDGET_MM = 91;
    const DELIVERY_ROW_BASE_MM = 16;
    let usedMm = 0;
    let tableRowsHtml = "";
    lignes.forEach((line) => {
      const quantite = Number(line.quantite) || 0;
      const prixUnitaire = Number(line.prixUnitaire) || 0;
      const montant = Number(line.montantTotal) || quantite * prixUnitaire;
      const rowHeightMm = DELIVERY_ROW_BASE_MM;
      usedMm += rowHeightMm;
      tableRowsHtml += `
        <tr style="height:${rowHeightMm.toFixed(2)}mm">
          <td><div class="product-item-wrap"></div></td>
          <td><div class="cell-pad-center"><b>${quantite > 0 ? quantite : ""}</b></div></td>
          <td><div class="product-item-wrap">${escapeHtml(line.designation)}</div></td>
          <td><div class="cell-pad-center">${prixUnitaire > 0 ? formatMoney(prixUnitaire) : ""}</div></td>
          <td><div class="cell-pad-center"></div></td>
          <td><div class="cell-pad-amount"><b>${montant > 0 ? formatMoney(montant) : ""}</b></div></td>
        </tr>
      `;
    });
    if (lignes.length === 0) {
      tableRowsHtml = `
        <tr style="height:${DELIVERY_ROW_BASE_MM.toFixed(2)}mm">
          <td></td><td></td>
          <td><div class="product-item-wrap">Aucun article dans cette commande.</div></td>
          <td></td><td></td><td></td>
        </tr>
      `;
    }
    const fillerMm = DELIVERY_TABLE_BUDGET_MM - usedMm;
    const fillerRowHtml = fillerMm > 2
      ? `<tr class="purchase-filler-row" style="height:${fillerMm.toFixed(2)}mm"><td></td><td></td><td></td><td></td><td></td><td></td></tr>`
      : "";

    const tableHtml = `
      <section class="table-section">
        <table class="items-table${lignes.length === 1 ? " single-row" : ""}">
          <colgroup>
            <col class="col-ref">
            <col class="col-qty">
            <col class="col-desc">
            <col class="col-pu">
            <col class="col-rate">
            <col class="col-amount">
          </colgroup>
          <thead>
            <tr>
              <th>Référence</th>
              <th>Nombre</th>
              <th>Description</th>
              <th>Prix Unitaire</th>
              <th>R %</th>
              <th>Montant</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
            ${fillerRowHtml}
          </tbody>
        </table>
      </section>
    `;

    const montantHT = Number(order.montantHT) || 0;
    const montantTaxe = Number(order.montantTaxe) || 0;
    const montantTotal = Number(order.montantTotal) || 0;
    const hasTaxe = montantTaxe > 0;
    const taxeLabelHtml = hasTaxe ? `<div class="tot-lbl-item">TVA</div>` : "";
    const taxeValueHtml = hasTaxe ? `<div class="tot-val-box">${formatMoney(montantTaxe)}</div>` : "";

    const notesHtml = order.notes
      ? `<div class="cond-line"><b>Notes:</b>&nbsp; <span>${escapeHtml(order.notes)}</span></div>`
      : "";

    const settlementHtml = `
      <section class="settlement-section purchase-settlement">
        <div class="settlement-grid">
          <div class="conditions-col">
            <div class="cond-title"><u>Détails de la commande</u></div>
            <div class="cond-line"><b>Fournisseur:</b>&nbsp; <span>${escapeHtml(supplierName)}</span></div>
            <div class="cond-line"><b>Date de commande:</b>&nbsp; <span>${escapeHtml(formatDate(order.dateCommande))}</span></div>
            <div class="cond-line"><b>Livraison prévue:</b>&nbsp; <span>${escapeHtml(formatDate(order.dateLivraisonPrevue))}</span></div>
            <div class="cond-line"><b>Nombre total d'articles:</b>&nbsp; <span>${totalItems}</span></div>
            <div class="cond-line"><b>Statut:</b>&nbsp; <span>${escapeHtml(STATUT_LABELS[order.statut] || order.statut || "—")}</span></div>
            ${notesHtml}
          </div>

          <div class="totals-labels-col">
            <div class="tot-lbl-item">Total H.T.</div>
            ${taxeLabelHtml}
            <div class="tot-lbl-item">Total TTC</div>
          </div>

          <div class="totals-values-col">
            <div class="tot-val-box">${formatMoney(montantHT)}</div>
            ${taxeValueHtml}
            <div class="tot-val-box ttc-box">${formatMoney(montantTotal)}</div>
          </div>
        </div>

        <div class="signatures-full-row">
          <div class="acquit-tag"><u>Établi par</u></div>
          <div class="commercial-service-tag"><u>Bon pour accord du fournisseur</u></div>
        </div>
      </section>
    `;

    const footerHtml = `
      <footer class="doc-footer">
        <div class="footer-rules">
          <div class="rule-solid-heavy"></div>
          <div class="rule-light"></div>
        </div>
        <div class="partners-row">
          <img src="assets/img/invoice/partners_strip.png" alt="Partenaires" class="partners-strip-img">
        </div>
        <div class="footer-rule-bottom"></div>
        <div class="legal-block">
          <div class="legal-row bank-row">
            <b>BANQUES:</b> Ecobank N° : 140207602001 - Banque Atlantique N°: 040192180002 - Diamond Bank N°: 263003225014
          </div>
          <div class="legal-row comp-row">
            <b>NIF:</b> 1000077472 ; <b>RCCM :</b> TG-LFW-01-2026-M-14353 / NUKAFOU, Boulevard Jean Paul II à côté des Rails
          </div>
        </div>
      </footer>
    `;

    const sheet = document.createElement("div");
    sheet.className = "sheet purchase-sheet";
    sheet.innerHTML = headerHtml + metaHtml + tableHtml + settlementHtml + footerHtml;
    root.replaceChildren(sheet);
  }

  document.getElementById("print-order").addEventListener("click", () => window.print());

  document.addEventListener("DOMContentLoaded", async () => {
    const id = new URLSearchParams(location.search).get("id");
    if (!id || !/^[1-9]\d*$/.test(id)) {
      root.replaceChildren(Object.assign(document.createElement("p"), { className: "error", textContent: "Identifiant de commande invalide." }));
      return;
    }
    try {
      const [orderResponse, settingsResponse] = await Promise.all([
        AA.getCommande(Number(id)),
        AA.getParametres(),
      ]);
      const order = orderResponse?.data ?? orderResponse;
      const settings = settingsResponse?.data ?? settingsResponse;
      if (!order || !Array.isArray(order.lignes) || order.lignes.length === 0) {
        throw new Error("Cette commande est introuvable ou ne contient aucune ligne.");
      }
      currentOrder = order;
      renderOrder(order, settings);
    } catch (error) {
      root.replaceChildren(Object.assign(document.createElement("p"), {
        className: "error",
        textContent: error.message || "Impossible de charger le bon de commande.",
      }));
    }
  }, { once: true });
})();
