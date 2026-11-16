'use strict';

(function () {
  const api = window.AA;
  const form = document.getElementById('pf-form');
  if (!api || !form) return;

  const params = new URLSearchParams(window.location.search);
  const editId = (() => {
    const value = Number(params.get('id'));
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  })();

  const clientSelect = document.getElementById('pf-client');
  const dateInput = document.getElementById('pf-date');
  const validityInput = document.getElementById('pf-validity');
  const sectionTitleInput = document.getElementById('pf-section-title');
  const deliveryInput = document.getElementById('pf-delivery-time');
  const guaranteeInput = document.getElementById('pf-guarantee');
  const paymentInput = document.getElementById('pf-payment-condition');
  const notesInput = document.getElementById('pf-notes');
  const taxToggle = document.getElementById('pf-apply-tax');
  const taxLabel = document.getElementById('pf-tax-label');
  const linesBody = document.getElementById('pf-lines-body');
  const addLineButton = document.getElementById('pf-add-line');
  const saveButton = document.getElementById('pf-save');
  const status = document.getElementById('pf-status');
  const errorBox = document.getElementById('pf-error');
  const subtotalOutput = document.getElementById('pf-subtotal');
  const taxOutput = document.getElementById('pf-tax');
  const totalOutput = document.getElementById('pf-total');
  const titleEl = document.querySelector('main h4.mb-0');
  const breadcrumbActive = document.querySelector('.breadcrumb-item.active');
  const docTitle = document.querySelector('.pf-doc-label');
  const docSubtitle = document.querySelector('.pf-doc-label + h5');

  const clientModalElement = document.getElementById('pf-client-modal');
  const clientForm = document.getElementById('pf-client-form');
  const clientError = document.getElementById('pf-client-error');
  const clientSubmit = document.getElementById('pf-client-submit');
  const addClientButton = document.getElementById('pf-add-client');

  let taxRate = 18;
  let saving = false;
  let savingClient = false;
  let dirty = false;
  let loadedInvoice = null;
  const saveLabelDefault = saveButton ? saveButton.innerHTML : '';

  const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

  const formatMoney = (value) =>
    `${roundMoney(value).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} FCFA`;

  const asList = (value) => {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    return [];
  };

  const unwrap = (response) => response?.data ?? response;

  const localDateValue = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const toDateInputValue = (value) => {
    if (!value) return localDateValue();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? localDateValue() : localDateValue(date);
  };

  const showError = (message) => {
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.classList.remove('d-none');
  };

  const clearError = () => {
    if (!errorBox) return;
    errorBox.textContent = '';
    errorBox.classList.add('d-none');
  };

  const setStatus = (message) => {
    if (status) status.textContent = message;
  };

  const showClientError = (message) => {
    if (!clientError) return;
    clientError.textContent = message;
    clientError.classList.remove('d-none');
  };

  const clearClientError = () => {
    if (!clientError) return;
    clientError.textContent = '';
    clientError.classList.add('d-none');
  };

  const setSaving = (value) => {
    saving = value;
    if (!saveButton) return;
    saveButton.disabled = value;
    const label = editId ? 'Enregistrer les modifications' : 'Enregistrer la proforma';
    saveButton.innerHTML = value
      ? '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Enregistrement…'
      : `<i class="bi bi-file-earmark-check"></i> ${label}`;
  };

  const setSavingClient = (value) => {
    savingClient = value;
    if (!clientSubmit) return;
    clientSubmit.disabled = value;
    clientSubmit.textContent = value ? 'Création…' : 'Créer le client';
  };

  const getClientModal = () => {
    if (!clientModalElement || !window.bootstrap?.Modal) return null;
    return window.bootstrap.Modal.getOrCreateInstance(clientModalElement);
  };

  const addClientOption = (client, markDirty = true) => {
    if (!clientSelect || !client || !client.id) return;
    const value = String(client.id);
    let option = Array.from(clientSelect.options).find((opt) => opt.value === value);
    if (!option) {
      option = new Option(client.nom || `Client ${client.id}`, value);
      clientSelect.append(option);
    } else if (client.nom) {
      option.textContent = client.nom;
    }
    clientSelect.value = value;
    if (markDirty) dirty = true;
  };

  const loadClients = async () => {
    if (!clientSelect) return;
    const response = await api.getClients();
    const clients = asList(response);
    clientSelect.replaceChildren(new Option('Sélectionner un client', ''));
    clients.forEach((client) => addClientOption(client, false));
    clientSelect.value = '';
  };

  const loadSettings = async () => {
    try {
      const response = await api.getParametres();
      const settings = response?.data ?? response;
      const value = Number(settings?.tauxTaxe);
      if (Number.isFinite(value) && value >= 0 && value <= 100) taxRate = value;
    } catch (error) {
      console.warn('Paramètres indisponibles, TVA par défaut utilisée.', error);
    }
    if (taxLabel) taxLabel.textContent = `TVA (${taxRate}%)`;
  };

  const createLineRow = (line = null) => {
    const row = document.createElement('tr');
    const designation = line?.designation ?? '';
    const description = line?.description ?? '';
    const quantity = line?.quantite ?? 1;
    const price = line?.prixUnitaire ?? 0;
    const discount = line?.remise ?? 0;
    const productId = line?.idProduit ?? '';
    row.dataset.productId = productId === null || productId === undefined ? '' : String(productId);
    row.innerHTML = `
      <td>
        <input type="text" class="form-control form-control-sm pf-line-designation" maxlength="200" placeholder="Désignation de la ligne" aria-label="Désignation">
      </td>
      <td>
        <textarea class="form-control form-control-sm pf-line-description" rows="1" placeholder="Précisions (optionnel)" aria-label="Description"></textarea>
      </td>
      <td>
        <input type="number" class="form-control form-control-sm text-end pf-line-quantity" min="1" step="1" value="1" aria-label="Quantité">
      </td>
      <td>
        <input type="number" class="form-control form-control-sm text-end pf-line-price" min="0" step="0.01" value="0" aria-label="Prix unitaire">
      </td>
      <td>
        <input type="number" class="form-control form-control-sm text-end pf-line-discount" min="0" step="0.01" value="0" aria-label="Remise">
      </td>
      <td class="text-end fw-semibold text-nowrap pf-line-total">0 FCFA</td>
      <td class="text-end">
        <button type="button" class="btn btn-sm btn-outline-danger pf-remove-line" title="Supprimer la ligne" aria-label="Supprimer la ligne">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    `;
    row.querySelector('.pf-line-designation').value = designation;
    row.querySelector('.pf-line-description').value = description;
    row.querySelector('.pf-line-quantity').value = String(quantity);
    row.querySelector('.pf-line-price').value = String(price);
    row.querySelector('.pf-line-discount').value = String(discount);
    return row;
  };

  const readLine = (row) => {
    const quantityValue = row.querySelector('.pf-line-quantity')?.value;
    const priceValue = row.querySelector('.pf-line-price')?.value;
    const discountValue = row.querySelector('.pf-line-discount')?.value;
    const productIdRaw = row.dataset.productId;
    const productId = productIdRaw && productIdRaw !== '' ? Number(productIdRaw) : null;
    return {
      idProduit: Number.isSafeInteger(productId) && productId > 0 ? productId : null,
      designation: row.querySelector('.pf-line-designation')?.value.trim() ?? '',
      description: row.querySelector('.pf-line-description')?.value.trim() ?? '',
      quantity: Number(quantityValue ?? 0),
      price: Number(priceValue ?? 0),
      discount: Number(discountValue ?? 0),
    };
  };

  const lineTotal = ({ quantity, price, discount }) => {
    const gross = roundMoney(quantity * price);
    const safeDiscount = Number.isFinite(discount) ? discount : 0;
    return Math.max(0, roundMoney(gross - safeDiscount));
  };

  const updateLineTotal = (row) => {
    const total = row.querySelector('.pf-line-total');
    if (total) total.textContent = formatMoney(lineTotal(readLine(row)));
  };

  const updateTotals = () => {
    if (!linesBody) return;
    let subtotal = 0;
    linesBody.querySelectorAll('tr').forEach((row) => {
      updateLineTotal(row);
      subtotal += lineTotal(readLine(row));
    });
    subtotal = roundMoney(subtotal);

    const applyTax = taxToggle ? taxToggle.checked : true;
    const tax = applyTax ? roundMoney(subtotal * taxRate / 100) : 0;
    const total = roundMoney(subtotal + tax);

    if (subtotalOutput) subtotalOutput.textContent = formatMoney(subtotal);
    if (taxOutput) taxOutput.textContent = formatMoney(tax);
    if (totalOutput) totalOutput.textContent = formatMoney(total);
    if (taxLabel) taxLabel.textContent = applyTax ? `TVA (${taxRate}%)` : 'TVA — non appliquée';
  };

  const addLine = (line = null, focus = true, markDirty = true) => {
    if (!linesBody) return;
    const row = createLineRow(line);
    linesBody.append(row);
    updateTotals();
    if (markDirty) dirty = true;
    if (focus) row.querySelector('.pf-line-designation')?.focus();
  };

  const removeLine = (row) => {
    row.remove();
    if (linesBody && !linesBody.querySelector('tr')) addLine(null, false, false);
    updateTotals();
    dirty = true;
  };

  const collectDocument = () => {
    if (!linesBody) return null;
    const rows = Array.from(linesBody.querySelectorAll('tr'));
    if (!rows.length) {
      showError('Ajoutez au moins une ligne à la proforma.');
      return null;
    }
    if (clientSelect && !clientSelect.value) {
      showError('Sélectionnez un client.');
      clientSelect.focus();
      return null;
    }

    const lines = [];
    const lineDescriptions = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const line = readLine(row);
      const number = index + 1;
      const designationInput = row.querySelector('.pf-line-designation');
      const quantityInput = row.querySelector('.pf-line-quantity');
      const priceInput = row.querySelector('.pf-line-price');
      const discountInput = row.querySelector('.pf-line-discount');

      if (!line.designation) {
        showError(`Renseignez la désignation de la ligne ${number}.`);
        designationInput?.focus();
        return null;
      }
      if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) {
        showError(`La quantité de la ligne ${number} doit être un entier supérieur ou égal à 1.`);
        quantityInput?.focus();
        return null;
      }
      if (!Number.isFinite(line.price) || line.price < 0) {
        showError(`Le prix unitaire de la ligne ${number} est invalide.`);
        priceInput?.focus();
        return null;
      }
      if (!Number.isFinite(line.discount) || line.discount < 0) {
        showError(`La remise de la ligne ${number} est invalide.`);
        discountInput?.focus();
        return null;
      }
      if (line.discount > roundMoney(line.quantity * line.price)) {
        showError(`La remise de la ligne ${number} ne peut pas dépasser son total.`);
        discountInput?.focus();
        return null;
      }

      lines.push({
        idProduit: line.idProduit,
        designation: line.designation,
        quantite: line.quantity,
        prixUnitaire: line.price,
        remise: line.discount,
      });
      lineDescriptions.push(line.description);
    }

    return {
      clientId: Number(clientSelect?.value),
      date: dateInput?.value || localDateValue(),
      validity: validityInput?.value.trim() || '',
      sectionTitle: sectionTitleInput?.value.trim() || '',
      deliveryTime: deliveryInput?.value.trim() || '',
      guarantee: guaranteeInput?.value.trim() || '',
      paymentCondition: paymentInput?.value.trim() || '',
      notes: notesInput?.value.trim() || '',
      applyTax: taxToggle ? taxToggle.checked : true,
      lines,
      lineDescriptions,
    };
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    clearError();
    setStatus('');

    const documentData = collectDocument();
    if (!documentData) return;

    const existingDocument = (loadedInvoice?.donneesDocument && typeof loadedInvoice.donneesDocument === 'object')
      ? { ...loadedInvoice.donneesDocument }
      : {};
    const metadata = {
      ...existingDocument,
      validity: documentData.validity,
      deliveryTime: documentData.deliveryTime,
      paymentCondition: documentData.paymentCondition,
      guarantee: documentData.guarantee,
      sectionTitle: documentData.sectionTitle,
      tauxTaxe: taxRate,
    };
    if (documentData.lineDescriptions.some(Boolean)) {
      metadata.lineDescriptions = documentData.lineDescriptions;
    } else {
      delete metadata.lineDescriptions;
    }

    const payload = {
      idClient: documentData.clientId,
      dateFacture: documentData.date,
      notes: documentData.notes || null,
      tauxTaxe: taxRate,
      tvaAppliquee: documentData.applyTax,
      lignes: documentData.lines.map((line) => ({
        idProduit: line.idProduit ?? null,
        quantite: line.quantite,
        prixUnitaire: line.prixUnitaire,
        remise: line.remise,
        designation: line.designation,
      })),
      donneesDocument: metadata,
    };
    if (!editId) payload.statut = 'proforma';

    setSaving(true);
    setStatus(editId ? 'Enregistrement des modifications…' : 'Enregistrement de la proforma…');
    try {
      let response;
      if (editId) {
        response = await api.updateFacture(editId, payload);
      } else {
        response = await api.createFacture(payload);
      }
      const saved = unwrap(response);
      const id = editId ?? saved?.id ?? saved?.facture?.id;
      if (!id) throw new Error('La proforma a été enregistrée mais son identifiant est introuvable.');
      dirty = false;
      setStatus('Proforma enregistrée. Redirection…');
      window.location.href = `gesco-facturation-detail.html?id=${encodeURIComponent(id)}`;
    } catch (error) {
      showError(error.message || "Impossible d'enregistrer la proforma.");
      setStatus('');
    } finally {
      setSaving(false);
    }
  };

  const submitClient = async (event) => {
    event.preventDefault();
    if (savingClient) return;
    clearClientError();

    const value = (id) => document.getElementById(id)?.value.trim() ?? '';
    const nom = value('pf-client-nom');
    if (!nom) {
      showClientError('Le nom du client est obligatoire.');
      document.getElementById('pf-client-nom')?.focus();
      return;
    }

    const payload = {
      type: value('pf-client-type') || 'particulier',
      nom,
      nif: value('pf-client-nif') || null,
      tel: value('pf-client-telephone') || null,
      email: value('pf-client-email') || null,
      ville: value('pf-client-ville') || null,
      adresse: value('pf-client-adresse') || null,
    };

    setSavingClient(true);
    try {
      const response = await api.createClient(payload);
      const client = response?.client ?? response?.data?.client ?? response?.data ?? response;
      if (!client?.id) throw new Error('Le client a été créé mais ses informations sont introuvables.');
      addClientOption(client);
      clientForm?.reset();
      const modal = getClientModal();
      modal?.hide();
      setStatus(`Client « ${client.nom} » créé.`);
    } catch (error) {
      showClientError(error.message || 'Impossible de créer le client.');
    } finally {
      setSavingClient(false);
    }
  };

  const openClientModal = () => {
    clearClientError();
    clientForm?.reset();
    const modal = getClientModal();
    modal?.show();
    window.setTimeout(() => document.getElementById('pf-client-nom')?.focus(), 250);
  };

  const applyEditModeUi = (invoice) => {
    if (!editId) return;
    const ref = invoice?.reference || `#${editId}`;
    document.title = `GESCO — Modifier la proforma ${ref} | SOLUTECH`;
    if (titleEl) titleEl.textContent = `Modifier la proforma ${ref}`;
    if (breadcrumbActive) breadcrumbActive.textContent = 'Modifier la proforma';
    if (docTitle) docTitle.textContent = 'Facture proforma';
    if (docSubtitle) docSubtitle.textContent = ref;
    if (saveButton) saveButton.innerHTML = '<i class="bi bi-file-earmark-check"></i> Enregistrer les modifications';
  };

  const populateFromInvoice = (invoice) => {
    loadedInvoice = invoice;
    const documentData = invoice?.donneesDocument ?? {};
    if (clientSelect) clientSelect.value = invoice?.idClient ? String(invoice.idClient) : '';
    if (dateInput) dateInput.value = toDateInputValue(invoice?.dateFacture);
    if (validityInput) validityInput.value = documentData.validity || '';
    if (sectionTitleInput) sectionTitleInput.value = documentData.sectionTitle || sectionTitleInput.value || '';
    if (deliveryInput) deliveryInput.value = documentData.deliveryTime || '';
    if (guaranteeInput) guaranteeInput.value = documentData.guarantee || '';
    if (paymentInput) paymentInput.value = documentData.paymentCondition || paymentInput.value || '';
    if (notesInput) notesInput.value = invoice?.notes || '';

    const metadataRate = Number(documentData.tauxTaxe);
    const ht = Number(invoice?.montantHT) || 0;
    const taxe = Number(invoice?.montantTaxe) || 0;
    if (Number.isFinite(metadataRate) && metadataRate >= 0 && metadataRate <= 100) {
      taxRate = metadataRate;
    } else if (ht > 0) {
      taxRate = roundMoney((taxe / ht) * 100);
    }
    const applyTax = invoice?.tvaAppliquee !== false && (taxe > 0 || metadataRate > 0 || invoice?.tvaAppliquee === true);
    if (taxToggle) taxToggle.checked = applyTax;

    const lineDescriptions = Array.isArray(documentData.lineDescriptions) ? documentData.lineDescriptions : [];
    const lines = Array.isArray(invoice?.lignes) ? invoice.lignes : [];
    linesBody.replaceChildren();
    if (lines.length) {
      lines.forEach((line, index) => {
        const gross = Number(line.quantite) * Number(line.prixUnitaire);
        const remise = gross > 0 ? Math.max(0, roundMoney(gross - Number(line.montantTotal))) : 0;
        addLine({
          idProduit: line.idProduit ?? null,
          designation: line.designation || '',
          description: lineDescriptions[index] || '',
          quantite: Number(line.quantite) || 1,
          prixUnitaire: Number(line.prixUnitaire) || 0,
          remise,
        }, false, false);
      });
    } else {
      addLine(null, false, false);
    }
    updateTotals();
    dirty = false;
  };

  addLineButton?.addEventListener('click', () => addLine(null, true));

  linesBody?.addEventListener('input', (event) => {
    if (!event.target.closest('tr')) return;
    dirty = true;
    updateTotals();
  });

  linesBody?.addEventListener('click', (event) => {
    const button = event.target.closest('.pf-remove-line');
    if (!button) return;
    const row = button.closest('tr');
    if (row) removeLine(row);
  });

  taxToggle?.addEventListener('change', () => {
    dirty = true;
    updateTotals();
  });

  form.addEventListener('input', () => { dirty = true; });
  form.addEventListener('change', () => { dirty = true; });
  form.addEventListener('submit', submit);

  addClientButton?.addEventListener('click', openClientModal);
  clientForm?.addEventListener('submit', submitClient);

  window.addEventListener('beforeunload', (event) => {
    if (!dirty || saving) return;
    event.preventDefault();
    event.returnValue = '';
  });

  async function init() {
    if (!editId && dateInput && !dateInput.value) dateInput.value = localDateValue();
    setStatus('');
    try {
      await Promise.all([loadClients(), loadSettings()]);
      if (editId) {
        setStatus('Chargement de la proforma…');
        const invoice = unwrap(await api.getFacture(editId));
        if (!invoice?.id) throw new Error('Proforma introuvable.');
        if (invoice.statut !== 'proforma') throw new Error("Ce document n'est pas une facture proforma.");
        populateFromInvoice(invoice);
        applyEditModeUi(invoice);
        setStatus('');
      } else {
        addLine(null, false, false);
        updateTotals();
      }
    } catch (error) {
      showError(error.message || 'Impossible de charger la proforma.');
      setStatus('');
      if (!editId && linesBody && !linesBody.querySelector('tr')) {
        addLine(null, false, false);
        updateTotals();
      }
    }
  }

  init();
})();
