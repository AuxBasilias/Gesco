(() => {
  "use strict";

  const root = document.getElementById("delivery-document");
  let currentSaleId = null;

  const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderDelivery(sale, client, settings, serials, livraison) {
    const doc = sale.donneesDocument || {};
    const followedBy = doc.followedBy || "M. BANQUE";
    const phone = doc.phone || "90 45 51 05";
    const email = doc.email || "fredbank@solutechtic.com";
    const deliveryDate = formatDate(sale.dateVente);
    const clientName = client?.nom || doc.clientName || (sale.idClient ? `Client ${sale.idClient}` : "Client comptoir");
    const clientEmail = doc.clientEmail ?? client?.email ?? "";
    const clientLine1 = doc.clientLine1 ?? client?.adresse ?? "";
    const clientLine2 = doc.clientLine2 || "";
    const clientLine3 = doc.clientLine3 ?? client?.ville ?? "";

    const isPartielle = livraison?.type === "partielle";
    const quantitesLivrees = livraison?.quantites || new Map();

    const lignes = Array.isArray(sale.lignes) ? sale.lignes : [];
    const totalItems = lignes.reduce((sum, line) => sum + Number(line.quantite || 0), 0);

    const serialsByLine = new Map();
    (serials || []).forEach((serial) => {
      const key = Number(serial.idLigneVente);
      if (!serialsByLine.has(key)) serialsByLine.set(key, []);
      serialsByLine.get(key).push(serial.numeroSerie ?? "");
    });

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
          <div class="client-header-title">Client</div>
          <div class="client-content-body">
            <div class="client-row">
              <span class="c-label">Client:</span>&nbsp;<span class="c-name">${escapeHtml(clientName)}</span>
            </div>
            <div class="client-row client-email">${clientEmail ? '<a href="mailto:' + escapeHtml(clientEmail) + '" class="client-email-val">' + escapeHtml(clientEmail) + '</a>' : ''}</div>
            <div class="client-row">${escapeHtml(clientLine1)}</div>
            <div class="client-row">${escapeHtml(clientLine2)}</div>
            <div class="client-row client-location">${clientLine3 ? '<u>' + escapeHtml(clientLine3) + '</u>' : ''}</div>
          </div>
        </div>

        <div class="invoice-number-card">
          <div class="inv-title">BON DE LIVRAISON</div>
          <div class="inv-code">${escapeHtml(sale.reference)}</div>
        </div>

        <div class="tracking-card">
          <div class="tracking-top-row">
            <span class="date-lbl">Date</span>
            <span class="date-underline-val">${escapeHtml(deliveryDate)}</span>
          </div>
          <div class="tracking-subline-row">
            <div class="tracking-subline"></div>
          </div>
          <div class="tracking-mid-row">
            <span class="follow-lbl">Dossier suivi par:</span>
            <span class="follow-name">${escapeHtml(followedBy)}</span>
          </div>
          <div class="tracking-bot-row">
            <span class="phone-val">${escapeHtml(phone)}</span>
            <a href="mailto:${escapeHtml(email)}" class="email-val"><u>${escapeHtml(email)}</u></a>
          </div>
        </div>
      </section>
    `;

    const DELIVERY_TABLE_BUDGET_MM = 119;
    const DELIVERY_ROW_BASE_MM = 16;
    let usedMm = 0;
    let tableRowsHtml = "";
    lignes.forEach((line) => {
      const quantite = Number(line.quantite) || 0;
      const quantiteLivree = isPartielle
        ? Math.max(0, Math.min(quantite, Number(quantitesLivrees.get(Number(line.id)) ?? quantite)))
        : quantite;
      const reste = Math.max(0, quantite - quantiteLivree);
      const existing = serialsByLine.get(Number(line.id)) || [];
      const serialInputs = [];
      const rowUnits = Math.max(1, quantiteLivree);
      for (let unit = 0; unit < rowUnits; unit += 1) {
        const value = existing[unit] ?? "";
        serialInputs.push(
          `<input type="text" class="serial-input" data-id-ligne="${escapeHtml(line.id ?? "")}" value="${escapeHtml(value)}" placeholder="N° de série ${unit + 1}">`,
        );
      }
      const rowHeightMm = Math.max(DELIVERY_ROW_BASE_MM, rowUnits * 4 + 8);
      usedMm += rowHeightMm;
      const qtyCells = isPartielle
        ? `<td><div class="cell-pad-center"><b>${quantiteLivree}</b></div></td>
           <td><div class="cell-pad-center cell-reste">${reste}</div></td>`
        : `<td><div class="cell-pad-center"><b>${quantite > 0 ? quantite : ""}</b></div></td>`;
      tableRowsHtml += `
        <tr style="height:${rowHeightMm.toFixed(2)}mm">
          <td><div class="cell-serial">${serialInputs.join("")}</div></td>
          ${qtyCells}
          <td><div class="product-item-wrap">${escapeHtml(line.designation)}</div></td>
          <td><div class="cell-serial"><input type="text" class="serial-input" data-observation="${escapeHtml(line.id ?? "")}" placeholder="Observation"></div></td>
        </tr>
      `;
    });
    if (lignes.length === 0) {
      tableRowsHtml = `
        <tr style="height:${DELIVERY_ROW_BASE_MM.toFixed(2)}mm">
          <td></td><td></td>${isPartielle ? "<td></td>" : ""}
          <td><div class="product-item-wrap">Aucun article à livrer.</div></td>
          <td></td>
        </tr>
      `;
    }
    const fillerMm = DELIVERY_TABLE_BUDGET_MM - usedMm;
    const fillerRowHtml = fillerMm > 2
      ? `<tr class="delivery-filler-row" style="height:${fillerMm.toFixed(2)}mm">${isPartielle ? "<td></td><td></td><td></td><td></td><td></td>" : "<td></td><td></td><td></td><td></td>"}</tr>`
      : "";

    const qtyHeaderHtml = isPartielle
      ? `<th class="th-qty-livree"><span class="th-line-1">Quantité</span><span class="th-line-2">livrée</span></th><th>Reste</th>`
      : `<th>Quantité</th>`;
    const colgroupHtml = isPartielle
      ? `<col class="col-ref"><col class="col-qty col-qty-partial"><col class="col-reste"><col class="col-desc col-desc-partial"><col class="col-amount">`
      : `<col class="col-ref"><col class="col-qty"><col class="col-desc"><col class="col-amount">`;

    const tableHtml = `
      <section class="table-section">
        <table class="items-table delivery-table${lignes.length === 1 ? " single-row" : ""}${isPartielle ? " is-partielle" : ""}">
          <colgroup>
            ${colgroupHtml}
          </colgroup>
          <thead>
            <tr>
              <th>Numéro de série</th>
              ${qtyHeaderHtml}
              <th>Désignation / produit</th>
              <th>Observation</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
            ${fillerRowHtml}
          </tbody>
        </table>
      </section>
    `;

    const deliveryAddress = [client?.adresse, client?.ville].filter(Boolean).join(", ");
    const addressLineHtml = deliveryAddress
      ? `<div class="cond-line"><b>Adresse de livraison:</b>&nbsp; <span>${escapeHtml(deliveryAddress)}</span></div>`
      : "";

    const settlementHtml = `
      <section class="settlement-section delivery-settlement">
        <div class="settlement-grid">
          <div class="conditions-col">
            <div class="cond-title"><u>Détails de la livraison</u></div>
            <div class="cond-line"><b>Vente de référence:</b>&nbsp; <span>${escapeHtml(sale.reference)}</span></div>
            <div class="cond-line"><b>Date de vente:</b>&nbsp; <span>${escapeHtml(formatDate(sale.dateVente))}</span></div>
            <div class="cond-line"><b>Nombre total d'articles:</b>&nbsp; <span>${totalItems}</span></div>
            ${addressLineHtml}
          </div>

          <div class="totals-labels-col"></div>
          <div class="totals-values-col"></div>
        </div>

        <div class="signatures-full-row">
          <div class="acquit-tag"><u>Le Livreur</u></div>
          <div class="commercial-service-tag"><u>Reçu par le client</u></div>
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
    sheet.className = "sheet delivery-sheet";
    sheet.innerHTML = headerHtml + metaHtml + tableHtml + settlementHtml + footerHtml;
    root.replaceChildren(sheet);
  }

  document.getElementById("print-delivery")?.addEventListener("click", () => window.print());

  document.getElementById("save-serials")?.addEventListener("click", async (event) => {
    if (!currentSaleId) {
      window.alert("Vente introuvable.");
      return;
    }
    const serials = Array.from(document.querySelectorAll(".serial-input[data-id-ligne]"))
      .map((input) => ({ idLigneVente: Number(input.dataset.idLigne), numeroSerie: input.value.trim() }))
      .filter((entry) => entry.numeroSerie !== "");
    const button = event.currentTarget;
    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="icon">⏳</span> Enregistrement…';
    try {
      await AA.updateVenteSerials(currentSaleId, serials);
      button.innerHTML = '<span class="icon">✅</span> Enregistré';
      setTimeout(() => { button.innerHTML = original; button.disabled = false; }, 1500);
    } catch (error) {
      button.innerHTML = original;
      button.disabled = false;
      window.alert(error.message || "Impossible d'enregistrer les numéros de série.");
    }
  });

  document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(location.search);
    const saleParam = params.get("venteId") || params.get("id");
    if (!saleParam || !/^[1-9]\d*$/.test(saleParam)) {
      root.replaceChildren(Object.assign(document.createElement("p"), { className: "error", textContent: "Identifiant de vente invalide." }));
      return;
    }
    try {
      const saleId = Number(saleParam);
      currentSaleId = saleId;
      const [saleResponse, settingsResponse, serialsResponse] = await Promise.all([
        AA.getVente(saleId),
        AA.getParametres(),
        AA.getVenteSerials(saleId).catch(() => []),
      ]);
      const sale = saleResponse?.data ?? saleResponse;
      const settings = settingsResponse?.data ?? settingsResponse;
      const serials = serialsResponse?.data ?? serialsResponse ?? [];
      if (!sale || !Array.isArray(sale.lignes) || sale.lignes.length === 0) {
        throw new Error("Cette vente est introuvable ou ne contient aucune ligne.");
      }
      let client = null;
      if (sale.idClient) {
        const clientResponse = await AA.getClient(sale.idClient);
        client = clientResponse?.data ?? clientResponse;
      }

      const type = params.get("type");
      const quantites = new Map();
      if (type === "partielle") {
        (params.get("q") || "").split(",").forEach((pair) => {
          const [lineId, qty] = pair.split(":");
          if (lineId && qty !== undefined && qty !== "") {
            quantites.set(Number(lineId), Number(qty));
          }
        });
      }
      renderDelivery(sale, client, settings, serials, { type, quantites });
    } catch (error) {
      root.replaceChildren(Object.assign(document.createElement("p"), {
        className: "error",
        textContent: error.message || "Impossible de charger le bon de livraison.",
      }));
    }
  }, { once: true });
})();
