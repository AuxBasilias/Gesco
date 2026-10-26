document.addEventListener('DOMContentLoaded', async () => {
    const paiementsBody = document.getElementById('paiements-corps');
    const impayesBody = document.getElementById('impayes-corps');
    if (!paiementsBody || !impayesBody) {
        console.error('Les conteneurs de paiements sont introuvables.');
        return;
    }

    const unwrap = (response) => (Array.isArray(response) ? response : (response && response.data) || []);
    const money = (value) => `${Number(value || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} FCFA`;
    const date = (value) => {
        if (!value) return '—';
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('fr-FR');
    };
    const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
    const setText = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    };
    const showAlert = (id, message) => {
        const box = document.getElementById(id);
        if (!box) return;
        box.textContent = message || '';
        box.classList.toggle('d-none', !message);
    };

    const MODES = {
        especes: 'Espèces',
        mobile_money: 'Mobile Money',
        carte: 'Carte bancaire',
        virement: 'Virement',
        cheque: 'Chèque',
    };

    let paiements = [];
    let impayes = [];
    let factures = [];
    let cashiers = new Map();
    let targetPaiement = null;
    let targetFacture = null;

    const paiementModal = window.bootstrap?.Modal.getOrCreateInstance(document.getElementById('paiementModal'));
    const annulationModal = window.bootstrap?.Modal.getOrCreateInstance(document.getElementById('annulationModal'));
    const relanceModal = window.bootstrap?.Modal.getOrCreateInstance(document.getElementById('relanceModal'));

    function setButtonLoading(button, loading, label) {
        if (!button) return;
        if (loading) {
            button.dataset.original = button.innerHTML;
            button.classList.add('disabled');
            button.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>' + (label || 'Traitement...');
        } else if (button.dataset.original) {
            button.innerHTML = button.dataset.original;
            button.classList.remove('disabled');
            delete button.dataset.original;
        }
    }

    function monthStart() {
        const start = new Date();
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        return start;
    }

    function renderStats() {
        const start = monthStart();
        const encaisse = paiements
            .filter((row) => new Date(row.datePaiement) >= start)
            .reduce((sum, row) => sum + Number(row.montant || 0), 0);
        const count = paiements.filter((row) => new Date(row.datePaiement) >= start).length;
        const totalImpaye = impayes.reduce((sum, row) => sum + Number(row.solde || 0), 0);
        const retard = impayes.filter((row) => row.enRetard).reduce((sum, row) => sum + Number(row.solde || 0), 0);

        setText('stat-encaisse', money(encaisse));
        setText('stat-paiements', count.toLocaleString('fr-FR'));
        setText('stat-paiements-detail', count > 1 ? 'Ce mois' : 'Ce mois');
        setText('stat-impayes', money(totalImpaye));
        setText('stat-impayes-detail', `${impayes.length} facture${impayes.length === 1 ? '' : 's'}`);
        setText('stat-retard', money(retard));
        setText('stat-retard-detail', 'Échéance dépassée');
    }

    function renderPaiements() {
        const query = String(document.getElementById('paiements-recherche')?.value ?? '').trim().toLowerCase();
        const mode = document.getElementById('paiements-mode')?.value ?? '';
        const filtered = paiements.filter((row) => {
            const matchesMode = !mode || row.modePaiement === mode;
            const haystack = [row.reference, row.factureReference, row.clientNom, row.agentNom]
                .map((value) => String(value ?? '').toLowerCase());
            const matchesQuery = !query || haystack.some((value) => value.includes(query));
            return matchesMode && matchesQuery;
        });

        if (filtered.length === 0) {
            paiementsBody.innerHTML = '<tr><td colspan="8" class="text-center py-4"><p class="text-secondary mb-0">Aucun paiement ne correspond à votre recherche.</p></td></tr>';
        } else {
            paiementsBody.innerHTML = filtered.map((row) => {
                const isCancellation = row.estAnnulation || Number(row.montant) < 0;
                const amountClass = isCancellation ? 'text-danger' : 'text-success';
                const sign = Number(row.montant) < 0 ? '' : '+';
                return `
                    <tr>
                        <td class="fw-medium">${esc(row.reference)}</td>
                        <td class="small">${date(row.datePaiement)}</td>
                        <td class="small">${row.factureReference ? `<a href="gesco-facturation-detail.html?id=${row.idFacture}">${esc(row.factureReference)}</a>` : '—'}</td>
                        <td class="small">${esc(row.clientNom || 'Client comptoir')}</td>
                        <td class="text-end fw-medium ${amountClass}">${sign}${money(row.montant)}</td>
                        <td class="small">${esc(row.modeLabel || row.modePaiement)}</td>
                        <td class="small text-secondary">${esc(row.agentNom || '—')}</td>
                        <td class="text-end">
                            ${isCancellation
                                ? '<span class="badge badge-light text-bg-secondary">Contre-écriture</span>'
                                : `<button class="btn btn-sm btn-square btn-link theme-red" data-action="annuler" data-id="${row.id}" title="Annuler le paiement"><i class="bi bi-arrow-counterclockwise"></i></button>`}
                        </td>
                    </tr>
                `;
            }).join('');
        }
        setText('paiements-compteur', `${filtered.length} paiement${filtered.length === 1 ? '' : 's'} affiché${filtered.length === 1 ? '' : 's'} sur ${paiements.length}`);
    }

    function renderImpayes() {
        if (impayes.length === 0) {
            impayesBody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><p class="text-success mb-0">Aucune facture impayée. Tous les règlements sont à jour.</p></td></tr>';
        } else {
            impayesBody.innerHTML = impayes.map((row) => `
                <tr>
                    <td><a href="gesco-facturation-detail.html?id=${row.id}" class="fw-medium">${esc(row.reference)}</a></td>
                    <td class="small">${esc(row.clientNom || 'Client comptoir')}</td>
                    <td class="text-end fw-medium text-danger">${money(row.solde)}</td>
                    <td class="small">${date(row.dateEcheance)}</td>
                    <td>${row.enRetard
                        ? `<span class="badge badge-light text-bg-danger">${row.retardJours} jour${row.retardJours > 1 ? 's' : ''}</span>`
                        : '<span class="badge badge-light text-bg-warning">À échoir</span>'}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-secondary" data-action="encaisser" data-id="${row.id}" title="Encaisser un règlement"><i class="bi bi-cash-coin"></i> Encaisser</button>
                        <button class="btn btn-sm ${row.enRetard ? 'btn-outline-danger' : 'btn-outline-secondary'}" data-action="relancer" data-id="${row.id}" title="Relancer par e-mail"><i class="bi bi-send"></i> Relancer</button>
                    </td>
                </tr>
            `).join('');
        }
        setText('impayes-compteur', `${impayes.length} facture${impayes.length === 1 ? '' : 's'} en attente de règlement`);
    }

    function fillFactureOptions(selectedId) {
        const select = document.getElementById('paiement-facture');
        if (!select) return;
        const options = factures
            .filter((facture) => Number(facture.montantTotal) - Number(facture.montantPaye) > 0)
            .map((facture) => {
                const solde = Number(facture.montantTotal) - Number(facture.montantPaye);
                return `<option value="${facture.id}">${esc(facture.reference)} — solde ${money(solde)}</option>`;
            });
        if (options.length === 0) {
            select.innerHTML = '<option value="">Aucune facture à encaisser</option>';
        } else {
            select.innerHTML = '<option value="">Sélectionnez une facture...</option>' + options.join('');
            if (selectedId) select.value = String(selectedId);
        }
        syncSelectedFacture();
    }

    function syncSelectedFacture() {
        const select = document.getElementById('paiement-facture');
        const aide = document.getElementById('paiement-solde-aide');
        const montantInput = document.getElementById('paiement-montant');
        const id = Number(select?.value);
        const facture = factures.find((row) => row.id === id);
        if (!facture) {
            if (aide) aide.classList.add('d-none');
            return;
        }
        const solde = Number(facture.montantTotal) - Number(facture.montantPaye);
        if (aide) {
            aide.textContent = `Solde restant dû : ${money(solde)}`;
            aide.classList.remove('d-none');
        }
        if (montantInput && !Number(montantInput.value)) montantInput.value = String(Math.max(0, solde));
    }

    function openPaiementModal(factureId) {
        showAlert('paiement-alerte', '');
        const montantInput = document.getElementById('paiement-montant');
        if (montantInput) montantInput.value = '';
        const notes = document.getElementById('paiement-notes');
        if (notes) notes.value = '';
        fillFactureOptions(factureId);
        paiementModal?.show();
    }

    async function loadAll() {
        try {
            const [paiementsRes, impayesRes, facturesRes, usersRes] = await Promise.all([
                AA.getPaiements(),
                AA.getFacturesImpayees(),
                AA.getFactures(),
                AA.getUtilisateurs().catch(() => []),
            ]);
            paiements = unwrap(paiementsRes);
            impayes = unwrap(impayesRes);
            factures = unwrap(facturesRes).filter((facture) => !['deleted', 'brouillon'].includes(facture.statut));
            cashiers = new Map(unwrap(usersRes).map((user) => [Number(user.id), user.nomUtilisateur]));

            paiements = paiements.map((row) => ({
                ...row,
                agentNom: row.agentNom || cashiers.get(Number(row.idUtilisateur)) || null,
            }));

            renderStats();
            renderPaiements();
            renderImpayes();
        } catch (error) {
            console.error('Erreur lors du chargement des paiements :', error);
            paiementsBody.innerHTML = `<tr><td colspan="8"><div class="alert alert-danger mb-0" role="alert">Impossible de charger les paiements. (${esc(error.message || 'Erreur serveur')})</div></td></tr>`;
            impayesBody.innerHTML = `<tr><td colspan="6"><div class="alert alert-danger mb-0" role="alert">Impossible de charger les impayés.</div></td></tr>`;
        }
    }

    document.getElementById('btn-nouveau-paiement')?.addEventListener('click', () => openPaiementModal(null));
    document.getElementById('paiement-facture')?.addEventListener('change', syncSelectedFacture);
    document.getElementById('paiements-recherche')?.addEventListener('input', renderPaiements);
    document.getElementById('paiements-mode')?.addEventListener('change', renderPaiements);

    document.getElementById('paiement-enregistrer')?.addEventListener('click', async (event) => {
        const button = event.currentTarget;
        const idFacture = Number(document.getElementById('paiement-facture')?.value);
        const montant = Number(document.getElementById('paiement-montant')?.value);
        const modePaiement = document.getElementById('paiement-mode')?.value;
        const notes = document.getElementById('paiement-notes')?.value.trim();
        showAlert('paiement-alerte', '');

        if (!idFacture) return showAlert('paiement-alerte', 'Sélectionnez la facture concernée.');
        if (!Number.isFinite(montant) || montant <= 0) return showAlert('paiement-alerte', 'Saisissez un montant valide.');

        setButtonLoading(button, true, 'Enregistrement...');
        try {
            await AA.createPaiement(idFacture, { montant, modePaiement, notes: notes || null });
            paiementModal?.hide();
            await loadAll();
        } catch (error) {
            showAlert('paiement-alerte', error.message || "Impossible d'enregistrer le paiement.");
        } finally {
            setButtonLoading(button, false);
        }
    });

    function openAnnulationModal(id) {
        targetPaiement = paiements.find((row) => Number(row.id) === Number(id)) || null;
        const motif = document.getElementById('annulation-motif');
        if (motif) motif.value = '';
        showAlert('annulation-alerte', '');
        setText('annulation-sous-titre', targetPaiement
            ? `${targetPaiement.reference} · ${money(targetPaiement.montant)} · ${targetPaiement.clientNom || 'Client comptoir'}`
            : '');
        annulationModal?.show();
    }

    document.getElementById('annulation-confirmer')?.addEventListener('click', async (event) => {
        if (!targetPaiement) return;
        const button = event.currentTarget;
        const motif = document.getElementById('annulation-motif')?.value.trim();
        showAlert('annulation-alerte', '');
        if (!motif) return showAlert('annulation-alerte', "Indiquez le motif de l'annulation.");

        setButtonLoading(button, true, 'Annulation...');
        try {
            await AA.annulerPaiement(targetPaiement.id, { motif });
            annulationModal?.hide();
            await loadAll();
        } catch (error) {
            showAlert('annulation-alerte', error.message || "Impossible d'annuler le paiement.");
        } finally {
            setButtonLoading(button, false);
        }
    });

    function openRelanceModal(id) {
        targetFacture = impayes.find((row) => Number(row.id) === Number(id)) || null;
        const message = document.getElementById('relance-message');
        if (message) message.value = '';
        showAlert('relance-alerte', '');
        setText('relance-sous-titre', targetFacture
            ? `${targetFacture.reference} · ${targetFacture.clientNom || 'Client comptoir'} · solde ${money(targetFacture.solde)}`
            : '');
        if (targetFacture && !targetFacture.clientEmail) {
            showAlert('relance-alerte', "Ce client n'a pas d'adresse e-mail : complétez sa fiche client avant de relancer.");
        }
        relanceModal?.show();
    }

    document.getElementById('relance-envoyer')?.addEventListener('click', async (event) => {
        if (!targetFacture) return;
        const button = event.currentTarget;
        const message = document.getElementById('relance-message')?.value.trim();
        showAlert('relance-alerte', '');

        setButtonLoading(button, true, 'Envoi...');
        try {
            await AA.relancerFacture(targetFacture.id, { message: message || null });
            relanceModal?.hide();
            await loadAll();
        } catch (error) {
            showAlert('relance-alerte', error.message || "Impossible d'envoyer la relance.");
        } finally {
            setButtonLoading(button, false);
        }
    });

    document.querySelector('main')?.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-action]');
        if (!trigger) return;
        const id = trigger.getAttribute('data-id');
        const action = trigger.getAttribute('data-action');
        if (action === 'annuler') openAnnulationModal(id);
        else if (action === 'encaisser') openPaiementModal(id);
        else if (action === 'relancer') openRelanceModal(id);
    });

    await loadAll();
});
