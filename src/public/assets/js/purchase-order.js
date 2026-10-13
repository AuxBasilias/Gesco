(() => {
  "use strict";

  const root = document.getElementById("order-document");
  const formatMoney = (value) => `${Number(value || 0).toLocaleString("fr-FR")} FCFA`;
  const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("fr-FR");
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

  function renderOrder(order, settings) {
    const supplier = order.fournisseur;
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

    const title = element("h2", "document-title", "Bon de commande fournisseur");
    const meta = element("section", "document-meta");
    meta.append(
      metaCard("N° de commande", order.reference),
      metaCard("Date d'émission", formatDate(order.dateCommande)),
      metaCard("Fournisseur", supplier?.nom),
      metaCard("Livraison prévue", formatDate(order.dateLivraisonPrevue)),
      metaCard("Téléphone / e-mail", [supplier?.tel, supplier?.email].filter(Boolean).join(" · ")),
      metaCard("Adresse fournisseur", supplier?.adresse),
    );

    const table = element("table", "items");
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["#", "Produit / désignation", "Quantité", "Prix unitaire", "Montant"].forEach((label, index) => {
      const th = element("th", index > 1 ? "numeric" : "", label);
      headRow.append(th);
    });
    thead.append(headRow);
    const tbody = document.createElement("tbody");
    order.lignes.forEach((line, index) => {
      const row = document.createElement("tr");
      row.append(
        element("td", "", String(index + 1)),
        element("td", "", line.designation),
        element("td", "numeric", String(line.quantite)),
        element("td", "numeric", formatMoney(line.prixUnitaire)),
        element("td", "numeric", formatMoney(line.montantTotal)),
      );
      tbody.append(row);
    });
    table.append(thead, tbody);

    const totals = element("table", "totals");
    const totalRow = document.createElement("tr");
    totalRow.className = "grand-total";
    totalRow.append(
      element("td", "", "Total de la commande"),
      element("td", "", formatMoney(order.montantTotal)),
    );
    totals.append(totalRow);

    const footer = element("footer", "document-footer");
    footer.append(element("div", "signature", "Établi par"), element("div", "signature", "Bon pour accord du fournisseur"));
    const sections = [header, title, meta, table, totals];
    if (order.notes) {
      const notes = element("section", "notes");
      notes.append(element("strong", "", "Notes : "), document.createTextNode(order.notes));
      sections.push(notes);
    }
    sections.push(footer);
    root.replaceChildren(...sections);
  }

  document.getElementById("print-order").addEventListener("click", () => window.print());
  document.addEventListener("DOMContentLoaded", async () => {
    const id = new URLSearchParams(location.search).get("id");
    if (!id || !/^[1-9]\d*$/.test(id)) {
      root.replaceChildren(element("p", "error", "Identifiant de commande invalide."));
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
      renderOrder(order, settings);
    } catch (error) {
      root.replaceChildren(element("p", "error", error.message || "Impossible de charger le bon de commande."));
    }
  }, { once: true });
})();
