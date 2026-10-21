document.addEventListener('DOMContentLoaded', async () => {
    const clientsContainer = document.getElementById('clients-container');

    if (!clientsContainer) {
        console.error('Le conteneur #clients-container est introuvable.');
        return;
    }

    // Afficher un indicateur de chargement
    clientsContainer.innerHTML = `
        <tr>
            <td colspan="7" class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Chargement des clients...</span>
                </div>
            </td>
        </tr>
    `;

    const unwrap = (response) => (Array.isArray(response) ? response : (response && response.data) || []);
    const money = (value) => `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;
    const orNa = (value) => {
        if (value === null || value === undefined) return 'N/A';
        if (typeof value === 'string' && value.trim() === '') return 'N/A';
        return value;
    };
    const normalizeType = (type) => String(type || '').trim().toLowerCase();
    const typeLabel = (type) => {
        const value = normalizeType(type);
        if (value.startsWith('particulier')) return { label: 'Particulier', cls: 'text-bg-secondary' };
        if (value.startsWith('entr')) return { label: 'Entreprise', cls: 'text-bg-theme-1' };
        return { label: 'N/A', cls: 'text-bg-secondary' };
    };
    const isEntreprise = (client) => normalizeType(client.type).startsWith('entr');

    const setText = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    };

    try {
        const [clientsResponse, salesResponse] = await Promise.all([
            AA.getClients(),
            AA.getVentes().catch(() => []),
        ]);

        const clients = unwrap(clientsResponse);
        const sales = unwrap(salesResponse).filter((sale) => sale.statut !== 'annulee');

        if (clients.length === 0) {
            clientsContainer.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <p class="text-muted mb-0">Aucun client trouvé.</p>
                    </td>
                </tr>
            `;
            return;
        }

        // Agrégats par client à partir des ventes réelles
        const aggregates = new Map();
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const activeThisMonth = new Set();

        sales.forEach((sale) => {
            if (sale.idClient === null || sale.idClient === undefined) return;
            const id = Number(sale.idClient);
            const montant = Number(sale.montantTotal || 0);
            const paye = Number(sale.montantPaye || 0);
            const date = sale.dateVente ? new Date(sale.dateVente) : null;
            const entry = aggregates.get(id) || { totalAchats: 0, soldeDu: 0, dernierAchat: null };
            entry.totalAchats += montant;
            entry.soldeDu += Math.max(0, montant - paye);
            if (date && !Number.isNaN(date.getTime()) && (!entry.dernierAchat || date > entry.dernierAchat)) {
                entry.dernierAchat = date;
            }
            aggregates.set(id, entry);
            if (date && !Number.isNaN(date.getTime()) && date >= monthStart) activeThisMonth.add(id);
        });

        const rows = clients.map((client) => {
            const aggregate = aggregates.get(Number(client.id));
            return {
                id: client.id,
                nom: orNa(client.nom),
                email: orNa(client.email),
                ville: orNa(client.ville),
                type: normalizeType(client.type),
                typeView: typeLabel(client.type),
                initials: String(client.nom || '').trim().slice(0, 2).toUpperCase() || 'NA',
                totalAchats: aggregate ? money(aggregate.totalAchats) : 'N/A',
                soldeDu: aggregate ? money(aggregate.soldeDu) : 'N/A',
                soldeDuValue: aggregate ? aggregate.soldeDu : 0,
                dernierAchat: aggregate && aggregate.dernierAchat
                    ? aggregate.dernierAchat.toLocaleDateString('fr-FR')
                    : 'N/A',
            };
        });

        // Statistiques concrètes
        const entreprises = clients.filter(isEntreprise).length;
        let totalDu = 0;
        let clientsEndettes = 0;
        aggregates.forEach((entry) => {
            if (entry.soldeDu > 0) {
                totalDu += entry.soldeDu;
                clientsEndettes += 1;
            }
        });

        setText('stat-clients', clients.length.toLocaleString('fr-FR'));
        setText('stat-entreprises', entreprises.toLocaleString('fr-FR'));
        setText('stat-actifs', activeThisMonth.size.toLocaleString('fr-FR'));
        setText('stat-soldes', Number(totalDu).toLocaleString('fr-FR'));
        setText('stat-soldes-detail', clientsEndettes === 0
            ? 'Aucun client concerné'
            : `${clientsEndettes} client${clientsEndettes > 1 ? 's' : ''} concerné${clientsEndettes > 1 ? 's' : ''}`);
        setText('clients-subtitle', `${clients.length} fiche${clients.length > 1 ? 's' : ''} — ${clientsEndettes} avec un solde à régler`);

        const searchInput = document.getElementById('clients-search');
        const typeFilter = document.getElementById('clients-type-filter');

        const render = () => {
            const query = String(searchInput?.value ?? '').trim().toLowerCase();
            const filter = typeFilter?.value ?? '';
            const filtered = rows.filter((row) => {
                const matchesSearch = !query
                    || row.nom.toLowerCase().includes(query)
                    || row.email.toLowerCase().includes(query)
                    || row.ville.toLowerCase().includes(query);
                const matchesFilter = !filter
                    || (filter === 'entreprise' && row.type.startsWith('entr'))
                    || (filter === 'particulier' && row.type.startsWith('particulier'))
                    || (filter === 'solde' && row.soldeDuValue > 0);
                return matchesSearch && matchesFilter;
            });

            if (filtered.length === 0) {
                clientsContainer.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center py-4">
                            <p class="text-muted mb-0">Aucun client ne correspond à votre recherche.</p>
                        </td>
                    </tr>
                `;
            } else {
                clientsContainer.innerHTML = filtered.map((row) => `
                    <tr>
                        <td>
                            <div class="d-flex align-items-center gap-2">
                                <span class="avatar avatar-32 rounded-circle bg-theme-1 text-white d-flex align-items-center justify-content-center" style="font-size:11px;">${row.initials}</span>
                                <div>
                                    <p class="mb-0 fw-medium">${row.nom}</p>
                                    <p class="small text-secondary mb-0">${row.email}</p>
                                </div>
                            </div>
                        </td>
                        <td><span class="badge badge-light ${row.typeView.cls}">${row.typeView.label}</span></td>
                        <td class="small">${row.ville}</td>
                        <td class="text-end">${row.totalAchats}</td>
                        <td class="text-end text-danger">${row.soldeDu}</td>
                        <td class="small">${row.dernierAchat}</td>
                        <td class="text-end">
                            <a href="gesco-clients-detail.html?id=${row.id}" class="btn btn-sm btn-square btn-link" title="Consulter"><i class="bi bi-eye"></i></a>
                            <a href="gesco-clients-modifier.html?id=${row.id}" class="btn btn-sm btn-square btn-link" title="Modifier"><i class="bi bi-pencil"></i></a>
                            <button class="btn btn-sm btn-square btn-link text-danger" title="Supprimer" data-action="delete-client" data-id="${row.id}" data-name="${row.nom.replace(/"/g, '&quot;')}"><i class="bi bi-trash"></i></button>
                        </td>
                    </tr>
                `).join('');
            }

            setText('clients-count', `${filtered.length} client${filtered.length > 1 ? 's' : ''} affiché${filtered.length > 1 ? 's' : ''} sur ${rows.length}`);
        };

        searchInput?.addEventListener('input', render);
        typeFilter?.addEventListener('change', render);
        let deleteClientId = null;
        let deleteClientName = '';
        if (clientsContainer && !clientsContainer.dataset.listenerAttached) {
            clientsContainer.dataset.listenerAttached = 'true';
            clientsContainer.addEventListener('click', (event) => {
                const btn = event.target.closest('[data-action="delete-client"]');
                if (!btn) return;
                deleteClientId = btn.getAttribute('data-id');
                deleteClientName = btn.getAttribute('data-name') || 'ce client';
                if (!deleteClientId) return;
                const textEl = document.getElementById('modalDeleteClientText');
                if (textEl) textEl.textContent = `Êtes-vous sûr de vouloir supprimer le client "${deleteClientName}" ?`;
                const modalEl = document.getElementById('modalConfirmDeleteClient');
                if (modalEl && window.bootstrap?.Modal) {
                    const modal = new window.bootstrap.Modal(modalEl);
                    modal.show();
                }
            });
        }
        const confirmDeleteBtn = document.getElementById('btnConfirmDeleteClient');
        if (confirmDeleteBtn && !confirmDeleteBtn.dataset.listenerAttached) {
            confirmDeleteBtn.dataset.listenerAttached = 'true';
            confirmDeleteBtn.addEventListener('click', async () => {
                if (!deleteClientId) return;
                confirmDeleteBtn.disabled = true;
                const originalText = confirmDeleteBtn.textContent;
                confirmDeleteBtn.textContent = 'Suppression...';
                try {
                    const res = await fetch(`/api/clients/${deleteClientId}`, { method: 'DELETE' });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok || data.success === false) {
                        alert(data.message || 'Erreur lors de la suppression du client.');
                        confirmDeleteBtn.disabled = false;
                        confirmDeleteBtn.textContent = originalText;
                        return;
                    }
                    const modalEl = document.getElementById('modalConfirmDeleteClient');
                    if (modalEl && window.bootstrap?.Modal) {
                        const modal = window.bootstrap.Modal.getInstance(modalEl) || new window.bootstrap.Modal(modalEl);
                        modal.hide();
                    }
                    window.location.reload();
                } catch (err) {
                    console.error(err);
                    alert('Erreur réseau lors de la suppression du client.');
                    confirmDeleteBtn.disabled = false;
                    confirmDeleteBtn.textContent = originalText;
                }
            });
        }
        render();
    } catch (error) {
        console.error('Erreur lors du chargement des clients:', error);
        clientsContainer.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="alert alert-danger" role="alert">
                        Impossible de charger la liste des clients. (${error.message || 'Erreur serveur'})
                    </div>
                </td>
            </tr>
        `;
    }
});

// Fonction utilitaire optionnelle pour gérer l'édition
function editClient(clientId) {
    window.location.href = `gesco-clients-modifier.html?id=${clientId}`;
}
