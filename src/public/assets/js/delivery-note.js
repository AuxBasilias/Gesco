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
    const deliveryDate = formatDate(sale.dateVente);
    const clientName = client?.nom || doc.clientName || (sale.idClient ? `Client ${sale.idClient}` : "Client non renseigné");

    const isPartielle = livraison?.type === "partielle";
    const quantitesLivrees = livraison?.quantites || new Map();

    const lignes = Array.isArray(sale.lignes) ? sale.lignes : [];

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
      <section class="delivery-body">
        <div class="delivery-client">
          <span class="delivery-label">Client :</span>
          <span class="delivery-client-name">${escapeHtml(clientName)}</span>
        </div>

        <div class="delivery-date">
          <strong>Date de Livraison :</strong> ${escapeHtml(deliveryDate)}
        </div>

        <h1 class="delivery-title">Bordereau de livraison N° ${escapeHtml(sale.reference)}</h1>
    `;

    const DELIVERY_ROW_BASE_MM = 12.4;
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
      const rowHeightMm = Math.max(DELIVERY_ROW_BASE_MM, rowUnits * 3.5 + 5);
      const qtyCells = isPartielle
        ? `<td class="qte"><div class="cell-pad-center"><b>${quantiteLivree}</b></div></td>
           <td class="qte"><div class="cell-pad-center cell-reste">${reste}</div></td>`
        : `<td class="qte"><div class="cell-pad-center"><b>${quantite > 0 ? quantite : ""}</b></div></td>`;
      tableRowsHtml += `
        <tr style="height:${rowHeightMm.toFixed(2)}mm">
          <td class="ref"><div class="cell-serial">${serialInputs.join("")}</div></td>
          <td class="designation"><div class="product-item-wrap">${escapeHtml(line.designation)}</div></td>
          ${qtyCells}
        </tr>
      `;
    });
    if (lignes.length === 0) {
      tableRowsHtml = `
        <tr style="height:${DELIVERY_ROW_BASE_MM.toFixed(2)}mm">
          <td class="ref"></td>
          <td class="designation"><div class="product-item-wrap">Aucun article à livrer.</div></td>
          <td class="qte"></td>
          ${isPartielle ? '<td class="qte"></td>' : ""}
        </tr>
      `;
    }
    const qtyHeaderHtml = isPartielle
      ? `<th class="th-qty-livree"><span class="th-line-1">Quantité</span><span class="th-line-2">livrée</span></th><th>Reste</th>`
      : `<th class="qte">Quantités</th>`;
    const colgroupHtml = isPartielle
      ? `<col class="col-ref"><col class="col-desc col-desc-partial"><col class="col-qty col-qty-partial"><col class="col-reste">`
      : `<col class="col-ref"><col class="col-desc"><col class="col-qty">`;

    const tableHtml = `
      <section class="table-section delivery-table-section">
        <table class="items-table delivery-table${lignes.length === 1 ? " single-row" : ""}${isPartielle ? " is-partielle" : ""}">
          <colgroup>
            ${colgroupHtml}
          </colgroup>
          <thead>
            <tr>
              <th class="ref">Réf.</th>
              <th>Désignation</th>
              ${qtyHeaderHtml}
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      </section>
    `;

    const settlementHtml = `
      <div class="delivery-signatures">
        <span>La réception</span>
        <span>Le fournisseur</span>
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
