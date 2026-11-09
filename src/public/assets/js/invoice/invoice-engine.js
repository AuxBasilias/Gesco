/**
 * GESTIONNAIRE DE FACTURE SOLUTECH INNOVATION GROUP
 * - Facture générée à partir des données persistées de vente
 * - Moteur Multi-Pages automatique avec déversement dynamique
 * - Bloc Totaux et Conditions UNIQUEMENT sur la dernière page
 * - Signatures : Pour Acquit (extrême gauche) & Le Service Commercial (extrême droite)
 * - Conversion exacte du montant en lettres françaises (FCFA)
 * - Gestion du Zoom et Impression PDF A4 stricte
 */

let currentInvoice = {
  id: null,
  statut: '',
  idVente: null,
  proformaReference: '',
  invoiceNumber: '',
  invoiceDate: '',
  followedBy: '',
  phone: '',
  email: '',
  client: { id: '', name: '', line1: '', line2: '', line3: '' },
  sectionTitle: 'Fournitures des équipements informatiques',
  orderBanner: '',
  vatRate: 0,
  items: [],
  conditions: {
    validity: '',
    deliveryTime: '',
    paymentCondition: '',
    guarantee: '',
    amountWords: ''
  }
};
let currentZoom = 100;
let convertProformaBusy = false;

function unwrapResponse(response) {
  return response?.data ?? response;
}

function invoiceDate(value) {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString('fr-FR');
}

function documentDataFromInvoice(invoice, client, settings, products) {
  const document = invoice.donneesDocument || {};
  const productById = new Map(products.map(product => [Number(product.id), product]));
  const invoiceTotalHT = Number(invoice.montantHT) || 0;
  return {
    id: invoice.id ?? null,
    statut: invoice.statut || '',
    idVente: invoice.idVente ?? null,
    proformaReference: document.proformaReference || '',
    invoiceNumber: invoice.reference || '',
    invoiceDate: invoiceDate(invoice.dateFacture),
    followedBy: document.followedBy || 'M. BANQUE',
    phone: document.phone || '90 45 51 05',
    email: document.email || 'fredbank@solutechtic.com',
    client: {
      id: client?.id ?? invoice.idClient ?? '',
      name: client?.nom || document.clientName || (invoice.idClient ? `Client ${invoice.idClient}` : 'Client non renseigné'),
      email: document.clientEmail ?? client?.email ?? '',
      line1: document.clientLine1 ?? client?.adresse ?? '',
      line2: document.clientLine2 || '',
      line3: document.clientLine3 ?? client?.ville ?? ''
    },
    orderBanner: document.orderBanner || '',
    sectionTitle: document.sectionTitle || 'Fournitures des équipements informatiques',
    vatRate: Number(document.tauxTaxe ?? (invoiceTotalHT > 0
      ? Number(invoice.montantTaxe) / invoiceTotalHT * 100
      : settings?.tauxTaxe ?? 0)),
    items: (invoice.lignes || []).map((line, index) => {
      const product = productById.get(Number(line.idProduit));
      const gross = Number(line.quantite) * Number(line.prixUnitaire);
      const discount = gross > 0
        ? Math.max(0, Math.min(100, (gross - Number(line.montantTotal)) / gross * 100))
        : 0;
      const designation = String(line.designation || '').trim();
      const productDescription = product?.description
        ? String(product.description)
            .split(/\r?\n/)
            .map((value) => value.trim())
            .filter((value) => value && value !== designation)
        : [];
      return {
        idProduit: line.idProduit,
        reference: document.references?.[line.id] ?? document.references?.[index] ?? '',
        qty: Number(line.quantite),
        description: [designation, ...productDescription].filter(Boolean),
        unitPrice: Number(line.prixUnitaire),
        discount: discount ? String(discount) : '',
        imageDataUrl: ''
      };
    }),
    conditions: {
      validity: document.validity || '',
      deliveryTime: document.deliveryTime || '',
      paymentCondition: document.paymentCondition || "60% à l'accord et 40% à la livraison",
      guarantee: document.guarantee || '',
      amountWords: document.amountWords || ''
    }
  };
}

async function loadInvoiceFromApi() {
  if (!window.AA) throw new Error("L'API GESCO n'est pas disponible.");
  const [clientsResponse, settingsResponse, productsResponse] = await Promise.all([
    AA.getClients(),
    AA.getParametres(),
    AA.getProduits()
  ]);
  const clients = unwrapResponse(clientsResponse) || [];
  const settings = unwrapResponse(settingsResponse);
  const products = unwrapResponse(productsResponse) || [];
  const params = new URLSearchParams(window.location.search);
  const invoiceParam = params.get('id');
  const saleParam = params.get('venteId');
  let invoice;
  if (invoiceParam) {
    const id = Number(invoiceParam);
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Identifiant de facture invalide.');
    invoice = unwrapResponse(await AA.getFacture(id));
  } else if (saleParam) {
    const saleId = Number(saleParam);
    if (!Number.isSafeInteger(saleId) || saleId <= 0) throw new Error('Identifiant de vente invalide.');
    invoice = unwrapResponse(await AA.createFactureFromVente(saleId));
    if (invoice?.id) {
      history.replaceState(null, '', `${location.pathname}?id=${encodeURIComponent(invoice.id)}`);
    }
  } else {
    throw new Error('Ouvrez une facture depuis une vente ou l’historique des factures.');
  }

  if (!invoice || invoice.statut === 'deleted') throw new Error('Facture introuvable.');
  const client = clients.find(item => Number(item.id) === Number(invoice.idClient));
  currentInvoice = documentDataFromInvoice(invoice, client, settings, products);
  const backLink = document.getElementById('backToList');
  if (backLink) {
    const isProforma = invoice.statut === 'proforma';
    backLink.href = isProforma ? 'gesco-facturation-proformas.html' : 'gesco-facturation.html';
    backLink.textContent = isProforma ? '← Retour aux Factures proforma' : '← Retour à GESCO';
  }
}

// Formatage monétaire FCFA (ex: 560 000)
function formatMoney(amount) {
  if (isNaN(amount)) return '0';
  return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// Convertisseur entier vers lettres françaises
function numberToFrenchWords(n) {
  if (n === 0) return 'zéro';
  
  const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
  const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const tens = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];
  
  function convertGroup(num) {
    let str = '';
    const h = Math.floor(num / 100);
    const rem = num % 100;
    
    if (h > 0) {
      if (h === 1) {
        str += 'cent';
      } else {
        str += units[h] + ' cent';
        if (rem === 0) str += 's';
      }
    }
    
    if (rem > 0) {
      if (str.length > 0) str += ' ';
      
      if (rem < 10) {
        str += units[rem];
      } else if (rem < 20) {
        str += teens[rem - 10];
      } else {
        const t = Math.floor(rem / 10);
        const u = rem % 10;
        
        if (t === 7) {
          str += 'soixante';
          str += (u === 1) ? ' et onze' : ('-' + teens[u]);
        } else if (t === 9) {
          str += 'quatre-vingt';
          str += '-' + teens[u];
        } else {
          str += tens[t];
          if (u === 1 && t < 8) {
            str += ' et un';
          } else if (u > 0) {
            str += '-' + units[u];
          } else if (t === 8) {
            str += 's';
          }
        }
      }
    }
    return str;
  }
  
  let result = '';
  const millions = Math.floor(n / 1000000);
  const thousands = Math.floor((n % 1000000) / 1000);
  const remainder = n % 1000;
  
  if (millions > 0) {
    if (millions === 1) {
      result += 'un million';
    } else {
      result += convertGroup(millions) + ' millions';
    }
  }
  
  if (thousands > 0) {
    if (result.length > 0) result += ' ';
    if (thousands === 1) {
      result += 'mille';
    } else {
      result += convertGroup(thousands) + ' mille';
    }
  }
  
  if (remainder > 0) {
    if (result.length > 0) result += ' ';
    result += convertGroup(remainder);
  }
  
  return result.charAt(0).toUpperCase() + result.slice(1);
}

function generateAmountWords(ttcAmount) {
  const words = numberToFrenchWords(Math.round(ttcAmount));
  return words + ' francs CFA TTC';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Algorithme de pagination pour répartir les articles sur plusieurs pages si nécessaire
// Algorithme de pagination : répartit les articles sur plusieurs pages en se
// basant sur une hauteur réelle en millimètres par article (pas un système de
// "poids" abstrait), pour ne jamais faire déborder le tableau. Si une page ne
// suffit pas, les articles excédentaires basculent automatiquement sur la
// page suivante ; les Conditions Générales, les totaux et la ligne "Pour
// Acquit" ne s'affichent que sur la toute dernière page.
const INVOICE_HEADER_MM = 9;       // hauteur de l'en-tête de tableau (thead)
const INVOICE_LAST_PAGE_MM = 128;  // page avec section Conditions/Totaux dessous
const INVOICE_OTHER_PAGE_MM = 168; // page sans section Conditions/Totaux : plus de place
const INVOICE_ROW_BASE_MM = 16;    // hauteur naturelle d'une ligne à 1 ligne de description
const INVOICE_ROW_LINE_MM = 4;     // hauteur ajoutée par ligne de description supplémentaire
const INVOICE_BANNER_MM = 10;      // espace pris par la ligne de titre de section
const INVOICE_ITEM_IMAGE_MM = 30;  // espace ajouté lorsqu'une image est insérée dans la ligne

function invoiceItemHeightMm(item) {
  const descLines = Array.isArray(item.description) ? item.description : (item.description || '').split('\n');
  const visualLines = descLines
    .map(line => line.trim())
    .filter(Boolean)
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 45)), 0);
  const imageMm = item.imageDataUrl ? INVOICE_ITEM_IMAGE_MM : 0;
  return INVOICE_ROW_BASE_MM + Math.max(0, visualLines - 1) * INVOICE_ROW_LINE_MM + imageMm;
}

function paginateItems(items, hasSectionTitle) {
  const lastPageBudget = INVOICE_LAST_PAGE_MM - INVOICE_HEADER_MM;
  const otherPageBudget = INVOICE_OTHER_PAGE_MM - INVOICE_HEADER_MM;

  // Tout tient sur une seule page (donc la dernière, avec le budget réduit) ?
  let totalMm = hasSectionTitle ? INVOICE_BANNER_MM : 0;
  items.forEach(it => { totalMm += invoiceItemHeightMm(it); });
  if (totalMm <= lastPageBudget) {
    return [items];
  }

  // Sinon : remplissage page par page avec le budget "page non-finale"
  // (plus généreux, pas de section Conditions/Totaux à prévoir en dessous).
  const pages = [];
  let current = [];
  let used = 0;
  items.forEach((item, index) => {
    let h = invoiceItemHeightMm(item);
    if (index === 0 && hasSectionTitle) h += INVOICE_BANNER_MM;
    if (used + h > otherPageBudget && current.length > 0) {
      pages.push(current);
      current = [item];
      used = invoiceItemHeightMm(item);
    } else {
      current.push(item);
      used += h;
    }
  });
  if (current.length > 0) pages.push(current);

  // La toute dernière page doit respecter le budget réduit (Conditions/Totaux
  // en dessous) : si elle déborde, on repousse le surplus sur une page de plus.
  let lastPage = pages[pages.length - 1];
  let lastMm = 0;
  lastPage.forEach(it => { lastMm += invoiceItemHeightMm(it); });
  while (lastMm > lastPageBudget && lastPage.length > 1) {
    const moved = lastPage.pop();
    lastMm -= invoiceItemHeightMm(moved);
    pages.push([moved]);
    lastPage = pages[pages.length - 1];
    lastMm = 0;
    lastPage.forEach(it => { lastMm += invoiceItemHeightMm(it); });
  }

  return pages;
}

// Rendu complet de la facture (gérant 1 ou N pages)
function renderInvoice() {
  const container = document.getElementById('pageContainer');
  container.innerHTML = '';
  if (!currentInvoice.items.length) {
    container.textContent = 'Cette facture ne contient aucune ligne.';
    return;
  }
  
  // Calcul des totaux globaux
  let globalTotalHT = 0;
  currentInvoice.items.forEach(item => {
    const qty = Number(item.qty) || 0;
    const pu = Number(item.unitPrice) || 0;
    const disc = Number(item.discount) || 0;
    let lineAmount = qty * pu;
    if (disc > 0) {
      lineAmount = lineAmount * (1 - disc / 100);
    }
    globalTotalHT += lineAmount;
  });
  
  const vatRate = Number(currentInvoice.vatRate) || 0;
  const globalTotalVAT = Math.round((globalTotalHT * vatRate) / 100);
  const globalTotalTTC = globalTotalHT + globalTotalVAT;
  const hasVat = vatRate > 0 && globalTotalVAT > 0;
  const vatLabelHtml = hasVat ? `<div class="tot-lbl-item">TVA&nbsp;&nbsp; <span>${vatRate}</span>%</div>` : '';
  const vatValueHtml = hasVat ? `<div class="tot-val-box">${formatMoney(globalTotalVAT)}</div>` : '';
  
  let amountInWords = currentInvoice.conditions.amountWords;
  if (!amountInWords || amountInWords.trim() === '') {
    amountInWords = generateAmountWords(globalTotalTTC);
  }
  
  const isProforma = currentInvoice.statut === 'proforma';
  const documentTitle = isProforma ? 'Facture Proforma' : 'FACTURE';
  const documentLabel = isProforma ? 'facture proforma' : 'facture';
  // const sectionTitle = (currentInvoice.sectionTitle || '').trim() || 'PROPOSITION COMMERCIALE';
  const sectionTitle = isProforma ? 'PROPOSITION COMMERCIALE' : 'Fournitures des équipements informatiques';
  const pagesData = paginateItems(currentInvoice.items, true);
  const totalPages = pagesData.length;
  
  pagesData.forEach((pageItems, pageIdx) => {
    const pageNumber = pageIdx + 1;
    const isLastPage = (pageNumber === totalPages);
    const isFirstPage = (pageNumber === 1);
    
    const sheetDiv = document.createElement('div');
    sheetDiv.className = 'sheet invoice-sheet' + (!isLastPage ? ' intermediate-page' : '');
    sheetDiv.id = 'invoiceSheet_' + pageNumber;
    
    // 1. En-tête officiel
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
    
    // 2. Section Méta Coordonnées (inspirée de entete-facture.html)
    const metaHtml = `
      <section class="meta-section">
        <!-- Cadre Client (Gauche) -->
        <div class="client-card">
          <div class="client-header-title"><span>Client</span></div>
          <div class="client-content-body">
            <div class="client-row client-name-row">
              <span class="c-label">Client:</span><span class="c-name">${escapeHtml(currentInvoice.client.name)}</span>
            </div>
            <div class="client-row client-email">${currentInvoice.client.email ? '<a href="mailto:' + escapeHtml(currentInvoice.client.email) + '" class="client-email-val">' + escapeHtml(currentInvoice.client.email) + '</a>' : ''}</div>
            <div class="client-row">${escapeHtml(currentInvoice.client.line1 || '')}</div>
            <div class="client-row">${escapeHtml(currentInvoice.client.line2 || '')}</div>
          </div>
          <div class="client-location">${currentInvoice.client.line3 ? '<u>' + escapeHtml(currentInvoice.client.line3) + '</u>' : ''}</div>
        </div>

        <!-- Identification Centrale -->
        <div class="invoice-number-card">
          <div class="inv-title${isProforma ? ' inv-title-proforma' : ''}">${documentTitle}</div>
          <div class="inv-code">${escapeHtml(currentInvoice.invoiceNumber)}</div>
          ${!isProforma && currentInvoice.proformaReference
            ? `<div class="inv-ref">Svt PF N° ${escapeHtml(currentInvoice.proformaReference)}</div>`
            : ''}
        </div>

        <!-- Cadre Date & Suivi (Droite) -->
        <div class="tracking-card">
          <div class="tracking-row tracking-date-row">
            <span class="date-lbl">Date</span>
            <span class="date-underline-val">${escapeHtml(currentInvoice.invoiceDate)}</span>
          </div>
          <div class="tracking-row tracking-follow-row">
            <span class="follow-lbl">Dossier suivi par:</span>
            <span class="follow-name">${escapeHtml(currentInvoice.followedBy)}</span>
          </div>
          <div class="tracking-row tracking-contact-row">
            <span class="phone-val">${escapeHtml(currentInvoice.phone)}</span>
            <a href="mailto:${escapeHtml(currentInvoice.email)}" class="email-val"><u>${escapeHtml(currentInvoice.email)}</u></a>
          </div>
        </div>
      </section>
    `;
    
    // 3. Tableau des articles
    const sectionTitleHtml = isFirstPage
      ? `
        <tr class="titre-section">
          <td style="height:${INVOICE_BANNER_MM.toFixed(2)}mm"></td>
          <td style="height:${INVOICE_BANNER_MM.toFixed(2)}mm"></td>
          <td class="jaune" style="height:${INVOICE_BANNER_MM.toFixed(2)}mm" contenteditable="true" spellcheck="false" data-section-title title="Cliquer pour modifier le titre de la section">${escapeHtml(sectionTitle)}</td>
          <td style="height:${INVOICE_BANNER_MM.toFixed(2)}mm"></td>
          <td style="height:${INVOICE_BANNER_MM.toFixed(2)}mm"></td>
          <td style="height:${INVOICE_BANNER_MM.toFixed(2)}mm"></td>
        </tr>
      `
      : '';
    let tableRowsHtml = sectionTitleHtml;
    
    // Hauteur de chaque ligne calculée dynamiquement : 128mm (hauteur minimale
    // du tableau) moins l'en-tête du tableau (8.5mm + bordures ≈ 9mm), répartis
    // entre le nombre d'articles réellement présents sur cette page, pour que
    // 1 comme 4 articles remplissent le tableau sans jamais le déborder ni
    // chevaucher la section Conditions/Totaux qui suit.
    // Chaque ligne prend sa hauteur naturelle (compacte, lisible) plutôt que
    // d'être étirée artificiellement. L'espace restant (si le tableau n'est
    // pas rempli) est absorbé par une seule ligne vide en fin de page, pour
    // que le cadre du tableau atteigne toujours proprement sa hauteur prévue
    // sans jamais la dépasser.
    const pageBudgetMm = (isLastPage ? INVOICE_LAST_PAGE_MM : INVOICE_OTHER_PAGE_MM) - INVOICE_HEADER_MM;

    pageItems.forEach((item) => {
      const itemIndex = currentInvoice.items.indexOf(item);
      const qty = Number(item.qty) || 0;
      const pu = Number(item.unitPrice) || 0;
      const disc = Number(item.discount) || 0;
      let lineAmount = qty * pu;
      if (disc > 0) {
        lineAmount = lineAmount * (1 - disc / 100);
      }
      
      let descLines = Array.isArray(item.description) ? item.description : (item.description || '').split('\n');
      const descHtml = descLines
        .filter(l => l.trim() !== '')
        .map(l => `<div>${escapeHtml(l)}</div>`)
        .join('');

      const rowHeightMm = invoiceItemHeightMm(item).toFixed(2);
      const imageHtml = item.imageDataUrl
        ? `<div class="product-image-wrap"><img src="${item.imageDataUrl}" alt=""></div>`
        : '';
      
      tableRowsHtml += `
        <tr>
          <td class="ref-cell" style="height:${rowHeightMm}mm">
            ${isProforma
              ? `<input type="text" class="cell-ref-input" data-ref-index="${itemIndex}" value="${escapeHtml(item.reference || '')}" placeholder="Référence" aria-label="Référence">`
              : '<div class="cell-pad-center"></div>'}
          </td>
          <td style="height:${rowHeightMm}mm"><div class="cell-pad-center"><b>${qty > 0 ? qty : ''}</b></div></td>
          <td class="product-desc-cell" style="height:${rowHeightMm}mm">
            <div class="product-item-wrap">
              ${descHtml}
            </div>
            ${imageHtml}
            <button type="button" class="add-product-image no-print" data-add-product-image="${itemIndex}" title="${item.imageDataUrl ? "Changer l'image" : "Ajouter une image dans cette cellule"}">${item.imageDataUrl ? "Changer l'image" : "+ Image"}</button>
          </td>
          <td style="height:${rowHeightMm}mm"><div class="cell-pad-amount">${pu > 0 ? formatMoney(pu) : ''}</div></td>
          <td style="height:${rowHeightMm}mm"><div class="cell-pad-center">${disc > 0 ? disc : ''}</div></td>
          <td style="height:${rowHeightMm}mm"><div class="cell-pad-amount"><b>${lineAmount > 0 ? formatMoney(lineAmount) : ''}</b></div></td>
        </tr>
      `;
    });

    // Ligne de remplissage : comble l'espace non utilisé par les articles
    // pour que le tableau atteigne toujours sa hauteur prévue (comme sur la
    // facture de référence, où l'espace vide reste à l'intérieur du cadre).
    let usedMm = isFirstPage ? INVOICE_BANNER_MM : 0;
    pageItems.forEach(it => { usedMm += invoiceItemHeightMm(it); });
    const fillerMm = pageBudgetMm - usedMm;
    if (fillerMm > 2) {
      const fh = fillerMm.toFixed(2);
      tableRowsHtml += `
        <tr>
          <td style="height:${fh}mm"></td>
          <td style="height:${fh}mm"></td>
          <td style="height:${fh}mm"></td>
          <td style="height:${fh}mm"></td><td style="height:${fh}mm"></td><td style="height:${fh}mm"></td>
        </tr>
      `;
    }
    
    if (pageItems.length === 0) {
      tableRowsHtml = sectionTitleHtml + `
        <tr>
          <td></td>
          <td></td>
          <td></td>
          <td></td><td></td><td></td>
        </tr>
      `;
    }
    
    const tableHtml = `
      <section class="table-section">
        <table class="items-table${pageItems.length === 1 ? " single-row" : ""}">
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
          </tbody>
        </table>
      </section>
    `;
    
    // 4. Section Conditions & Totaux (SEULEMENT SUR LA DERNIÈRE PAGE)
    let settlementHtml = '';
    if (isLastPage) {
      settlementHtml = `
        <section class="settlement-section">
          <div class="settlement-grid">
            <!-- Colonne Gauche (67%) : Conditions Générales -->
            <div class="conditions-col">
              <div class="cond-title"><u>Conditions Générales</u></div>
              <div class="cond-line"><b>Validité:</b>&nbsp; <span>${escapeHtml(currentInvoice.conditions.validity || '')}</span></div>
              <div class="cond-line"><b>Délai de livraison:</b>&nbsp; <span>${escapeHtml(currentInvoice.conditions.deliveryTime || '')}</span></div>
              <div class="cond-line cond-payment-line"><b>Condition de paiement:</b>&nbsp;&nbsp; <span class="payment-condition-value">${escapeHtml(currentInvoice.conditions.paymentCondition || '')}</span></div>
              <div class="cond-line cond-guarantee"><b>Garantie:</b>&nbsp; <span>${escapeHtml(currentInvoice.conditions.guarantee || '')}</span></div>
              <div class="cond-line cond-words-line">
                <b>Arrêtée la présente ${documentLabel} à la somme de:</b>&nbsp;&nbsp;
                <span class="words-strong">${escapeHtml(amountInWords)}</span>
              </div>
            </div>

            <!-- Colonne Milieu (20% : Prix Unitaire + R%) : Labels Totaux -->
            <div class="totals-labels-col">
              <div class="tot-lbl-item">Total H.T.</div>
              ${vatLabelHtml}
              <div class="tot-lbl-item">Total TTC</div>
            </div>

            <!-- Colonne Droite (13% : Montant) : Prolongement avec bordure plus épaisse -->
            <div class="totals-values-col">
              <div class="tot-val-box">${formatMoney(globalTotalHT)}</div>
              ${vatValueHtml}
              <div class="tot-val-box ttc-box">${formatMoney(globalTotalTTC)}</div>
            </div>
          </div>

          <!-- Ligne des Signatures sur toute la largeur (Pour Acquit à GAUCHE, Le Service Commercial à DROITE) -->
          <div class="signatures-full-row">
            ${isProforma ? '' : '<div class="acquit-tag"><u>Pour Acquit</u></div>'}
            <div class="commercial-service-tag"${isProforma ? ' style="margin-left:auto"' : ''}><u>Le Service Commercial</u></div>
          </div>
        </section>
      `;
    }
    
    // 5. Pied de page officiel avec Logos Partenaires
    const footerHtml = `
      <footer class="doc-footer">
        <div class="footer-rules">
          <div class="rule-solid-heavy"></div>
          <div class="rule-light"></div>
        </div>

        <div class="partners-row">
          <img src="assets/img/invoice/partners_strip.png" alt="Partenaires: Cisco, Microsoft, VMware, HP, Dell, Toshiba, Brother, Lenovo, Kaspersky" class="partners-strip-img">
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
    
    sheetDiv.innerHTML = headerHtml + metaHtml + tableHtml + settlementHtml + footerHtml;
    const sectionTitleCell = sheetDiv.querySelector('[data-section-title]');
    if (sectionTitleCell) {
      sectionTitleCell.addEventListener('input', () => {
        currentInvoice.sectionTitle = sectionTitleCell.textContent.trim();
      });
    }
    sheetDiv.querySelectorAll('[data-ref-index]').forEach((input) => {
      input.addEventListener('input', () => {
        const item = currentInvoice.items[Number(input.getAttribute('data-ref-index'))];
        if (item) item.reference = input.value;
      });
    });
    sheetDiv.querySelectorAll('[data-add-product-image]').forEach((button) => {
      button.addEventListener('click', () => {
        const item = currentInvoice.items[Number(button.getAttribute('data-add-product-image'))];
        if (!item) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        document.body.appendChild(input);
        input.addEventListener('change', () => {
          const file = input.files?.[0];
          if (!file) {
            input.remove();
            return;
          }
          const reader = new FileReader();
          reader.addEventListener('load', () => {
            item.imageDataUrl = String(reader.result || '');
            input.remove();
            renderInvoice();
          });
          reader.readAsDataURL(file);
        });
        input.click();
      });
    });
    container.appendChild(sheetDiv);
  });
  
  updateZoom(currentZoom);
}

// Gestion des Contrôles de Zoom
function updateZoom(newZoom) {
  currentZoom = Math.min(Math.max(newZoom, 50), 160);
  const sheets = document.querySelectorAll('.sheet');
  sheets.forEach(sheet => {
    sheet.style.transform = `scale(${currentZoom / 100})`;
  });
  document.getElementById('zoomValue').textContent = Math.round(currentZoom) + '%';
}

function invoiceTotalTTC() {
  let totalHT = 0;
  currentInvoice.items.forEach(item => {
    const qty = Number(item.qty) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const discount = Number(item.discount) || 0;
    let lineAmount = qty * unitPrice;
    if (discount > 0) lineAmount *= 1 - discount / 100;
    totalHT += lineAmount;
  });
  const vatRate = Number(currentInvoice.vatRate) || 0;
  const totalVAT = Math.round((totalHT * vatRate) / 100);
  return totalHT + totalVAT;
}

function setConvertProformaBusy(busy) {
  convertProformaBusy = busy;
  const confirm = document.getElementById('btnConfirmConvertProforma');
  const cancel = document.getElementById('btnCancelConvertProforma');
  const close = document.getElementById('btnCloseConvertProforma');
  if (confirm) {
    confirm.disabled = busy;
    confirm.innerHTML = busy
      ? '<span class="btn-spinner"></span>Conversion en cours…'
      : 'Confirmer la conversion';
  }
  if (cancel) cancel.disabled = busy;
  if (close) close.disabled = busy;
}

function openConvertProformaModal() {
  const modal = document.getElementById('convertProformaModal');
  if (!modal) {
    if (window.confirm('Convertir cette facture proforma en facture réelle ? Une vente sera créée et le stock sera mis à jour.')) {
      void convertCurrentProforma();
    }
    return;
  }

  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };
  setText('convert-proforma-reference', currentInvoice.invoiceNumber || '—');
  setText('convert-proforma-client', currentInvoice.client?.name || 'Client non renseigné');
  setText('convert-proforma-lines', String(currentInvoice.items.length));
  setText('convert-proforma-total', `${formatMoney(invoiceTotalTTC())} FCFA`);

  const error = document.getElementById('convertProformaError');
  if (error) {
    error.textContent = '';
    error.hidden = true;
  }

  setConvertProformaBusy(false);
  modal.hidden = false;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  setTimeout(() => document.getElementById('btnConfirmConvertProforma')?.focus(), 50);
}

function closeConvertProformaModal(force = false) {
  if (convertProformaBusy && !force) return;
  const modal = document.getElementById('convertProformaModal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
}

async function convertCurrentProforma() {
  if (convertProformaBusy || !currentInvoice.id) return;
  const error = document.getElementById('convertProformaError');
  if (error) {
    error.textContent = '';
    error.hidden = true;
  }
  setConvertProformaBusy(true);

  try {
    const response = await AA.convertProforma(currentInvoice.id, {});
    const invoice = unwrapResponse(response);
    if (invoice?.id) {
      history.replaceState(null, '', `${location.pathname}?id=${encodeURIComponent(invoice.id)}`);
    }
    setConvertProformaBusy(false);
    closeConvertProformaModal(true);
    await loadInvoiceFromApi();
    renderInvoice();
    setupConversionButton();
  } catch (conversionError) {
    setConvertProformaBusy(false);
    const message = conversionError.message || 'Impossible de convertir la proforma.';
    if (error) {
      error.textContent = message;
      error.hidden = false;
    } else {
      window.alert(message);
    }
  }
}

function setupConversionButton() {
  const button = document.getElementById('btnConvertProforma');
  if (!button) return;
  const canConvert = currentInvoice.statut === 'proforma' && !currentInvoice.idVente;
  button.hidden = !canConvert;
  button.style.display = canConvert ? '' : 'none';
  if (!canConvert) {
    button.onclick = null;
    return;
  }
  button.textContent = 'Convertir en facture';
  button.onclick = () => openConvertProformaModal();
}

// ==========================================================================
// INITIALISATION & GESTIONNAIRES D'ÉVÉNEMENTS
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  const convertModal = document.getElementById('convertProformaModal');
  if (convertModal) {
    document.getElementById('btnCloseConvertProforma')?.addEventListener('click', () => closeConvertProformaModal());
    document.getElementById('btnCancelConvertProforma')?.addEventListener('click', () => closeConvertProformaModal());
    document.getElementById('btnConfirmConvertProforma')?.addEventListener('click', convertCurrentProforma);
    convertModal.addEventListener('click', (event) => {
      if (event.target === convertModal) closeConvertProformaModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && convertModal.classList.contains('open')) closeConvertProformaModal();
    });
  }

  const container = document.getElementById('pageContainer');
  container.textContent = 'Chargement de la facture…';
  loadInvoiceFromApi().then(() => {
    renderInvoice();
    setupConversionButton();
  }).catch(error => {
    container.textContent = error.message || 'Impossible de charger la facture.';
    console.error('Impossible de charger la facture :', error);
  });
  
  // Zoom
  document.getElementById('btnZoomIn').addEventListener('click', () => updateZoom(currentZoom + 10));
  document.getElementById('btnZoomOut').addEventListener('click', () => updateZoom(currentZoom - 10));
  document.getElementById('btnZoomFit').addEventListener('click', () => {
    const containerWidth = document.getElementById('pageContainer').clientWidth - 40;
    const sheetWidthPx = 210 * 3.7795275591; // ~794px à 96dpi
    const fitZoom = (containerWidth / sheetWidthPx) * 100;
    updateZoom(fitZoom);
  });
  
  // Impression
  document.getElementById('btnPrint').addEventListener('click', () => {
    window.print();
  });
});
