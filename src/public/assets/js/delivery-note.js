(() => {
  "use strict";

  const root = document.getElementById("delivery-document");
  const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function metaCard(label, value) {
    const card = element("div", "meta-card");
    card.append(element("span", "meta-label", label), element("span", "meta-value", value || "—"));
    return card;
  }

  function renderDelivery(sale, client, settings, products) {
    const serialById = new Map((products || []).map((product) => [Number(product.id), String(product.numeroSerie || "").trim()]));

    const header = element("header", "company-header");
    const logo = element("img", "company-logo");
    logo.src = "assets/img/invoice/logo_solutech.png";
    logo.alt = "SOLUTECH";
    const brand = document.createElement("div");
    brand.append(
      element("h1", "company-name", settings?.nom || "SOLUTECH INNOVATION GROUP"),
      element("p", "company-subtitle", [settings?.adresse, settings?.telephone, settings?.email].filter(Boolean).join(" · ")),
    );
    header.append(logo, brand);

    const title = element("h2", "document-title", "Bon de livraison");
    const meta = element("section", "document-meta");
    meta.append(
      metaCard("N° bon de livraison", sale.reference),
      metaCard("Date de livraison", formatDate(new Date())),
      metaCard("Vente de référence", `${sale.reference} · ${formatDate(sale.dateVente)}`),
      metaCard("Livré par", settings?.nom || "SOLUTECH"),
    );

    const deliveryBlock = element("section", "delivery-block");
    deliveryBlock.append(element("p", "delivery-block-title", "Livré à"));
    if (client) {
      deliveryBlock.append(element("p", "delivery-client", client.nom));
      const addressLines = [client.adresse, client.ville].filter(Boolean).join("\n");
      const contactLines = [client.tel && `Tél : ${client.tel}`, client.nif && `NIF : ${client.nif}`].filter(Boolean).join(" · ");
      deliveryBlock.append(element("p", "delivery-address", [addressLines, contactLines].filter(Boolean).join("\n")));
    } else {
      deliveryBlock.append(element("p", "delivery-client", "Client de passage"));
      deliveryBlock.append(element("p", "delivery-address", "Aucune adresse de livraison."));
    }

    const table = element("table", "items");
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    [["#", ""], ["Désignation / produit", ""], ["N° de série", ""], ["Quantité", "numeric"]].forEach(([label, cls]) => {
      headRow.append(element("th", cls, label));
    });
    thead.append(headRow);
    const tbody = document.createElement("tbody");
    let scanned = 0;
    sale.lignes.forEach((line, index) => {
      const row = document.createElement("tr");
      const serial = serialById.get(Number(line.idProduit)) || "";
      if (serial) scanned += 1;
      row.append(
        element("td", "", String(index + 1)),
        element("td", "", line.designation),
        element("td", "serial-cell", serial || "—"),
        element("td", "numeric", String(line.quantite)),
      );
      tbody.append(row);
    });
    table.append(thead, tbody);

    const totalItems = sale.lignes.reduce((sum, line) => sum + Number(line.quantite || 0), 0);
    const totals = element("table", "totals");
    const quantityRow = document.createElement("tr");
    quantityRow.append(element("td", "", "Nombre d'articles livrés"), element("td", "", String(totalItems)));
    totals.append(quantityRow);
    if (scanned > 0) {
      const serialRow = document.createElement("tr");
      serialRow.append(element("td", "", "Produits avec numéro de série"), element("td", "", `${scanned} / ${sale.lignes.length}`));
      totals.append(serialRow);
    }

    const footer = element("footer", "document-footer");
    footer.append(element("div", "signature", "Livré par"), element("div", "signature", "Reçu par le client"));

    const sections = [header, title, meta, deliveryBlock, table, totals, footer];
    if (sale.notes) {
      const notes = element("section", "notes");
      notes.append(element("strong", "", "Notes : "), document.createTextNode(sale.notes));
      sections.splice(sections.length - 1, 0, notes);
    }
    root.replaceChildren(...sections);
  }

  document.getElementById("print-delivery").addEventListener("click", () => window.print());

  document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(location.search);
    const saleParam = params.get("venteId") || params.get("id");
    if (!saleParam || !/^[1-9]\d*$/.test(saleParam)) {
      root.replaceChildren(element("p", "error", "Identifiant de vente invalide."));
      return;
    }
    try {
      const [saleResponse, settingsResponse, productsResponse] = await Promise.all([
        AA.getVente(Number(saleParam)),
        AA.getParametres(),
        AA.getProduits(),
      ]);
      const sale = saleResponse?.data ?? saleResponse;
      const settings = settingsResponse?.data ?? settingsResponse;
      const products = productsResponse?.data ?? productsResponse;
      if (!sale || !Array.isArray(sale.lignes) || sale.lignes.length === 0) {
        throw new Error("Cette vente est introuvable ou ne contient aucune ligne.");
      }
      if (!Array.isArray(products)) {
        throw new Error("Impossible de charger les produits pour les numéros de série.");
      }
      let client = null;
      if (sale.idClient) {
        const clientResponse = await AA.getClient(sale.idClient);
        client = clientResponse?.data ?? clientResponse;
      }
      renderDelivery(sale, client, settings, products);
    } catch (error) {
      root.replaceChildren(element("p", "error", error.message || "Impossible de charger le bon de livraison."));
    }
  }, { once: true });
})();