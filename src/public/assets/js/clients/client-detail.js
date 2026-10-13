
document.addEventListener('DOMContentLoaded', async () => {
    function getUrlParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

const clientId = getUrlParam('id');
console.log(clientId);
    const clientInfo = document.getElementById('clientInfo');

    if (!clientInfo) {
        console.error('Le conteneur #clientInfo est introuvable.');
        return;
    }

    // Afficher un indicateur de chargement
    clientInfo.innerHTML = `
        <div class="col-12 text-center py-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Chargement des Informations...</span>
            </div>
        </div>
    `;

    try {
        // 1. Appel de l'API via AA (Assurez-vous que AA.getClients existe dans api.js)
        const response = await AA.getClient(clientId);
        console.log(response);
        
        // Ajustement selon le format de retour de votre API (ex: response.data ou response)
        const client = response;
        console.log(client)

        if (!client) {
            clientInfo.innerHTML = `
                <div class="col-12 text-center py-4">
                    <p class="text-muted mb-0">Aucun client trouvé.</p>
                </div>
            `;
            return;
        }
        const reference = client.reference || '';
            const nom = client.nom;
            const email = client.email || 'Email non renseigné';
            const ville = client.ville ;
            const totalAchats = client.totalAchats;
            const soldeDu = client.soldeDu;
            const dernierAchat = client.dernierAchat;
            const type = client.type;
            const nif = client.nif;
            const adresse = client.adresse;


        // 2. Mapping des données clients vers le template HTML
        const clientInfoHTML = `
            <div class="container-fluid mt-3">
        <div class="row gx-1 align-items-center mb-3">
            <div class="col">
                <nav aria-label="breadcrumb" class="mb-1">
                    <ol class="breadcrumb mb-0">
                        <li class="breadcrumb-item"><a href="gesco-dashboard.html"><i class="bi bi-house-door"></i> Accueil</a></li>
                        <li class="breadcrumb-item"><a href="gesco-clients.html">Clients</a></li><li class="breadcrumb-item active" aria-current="page">${nom}</li>
                    </ol>
                </nav>
                <h4 class="mb-0">${nom}</h4>
            </div>
            <div class="col-auto d-flex gap-2">
                <button class="btn btn-outline-secondary"><i class="bi bi-pencil"></i> Modifier</button>
                <a href="gesco-ventes-terminal.html" class="btn btn-theme"><i class="bi bi-plus-lg"></i> Nouvelle vente</a>
            </div>
        </div>

        <div class="row g-4">
            <div class="col-lg-4">
                <div class="card adminuiux-card border-0 shadow-sm mb-4">
                    <div class="card-body text-center p-4">
                        <span class="avatar avatar-70 rounded-circle bg-theme-1 text-white d-flex align-items-center justify-content-center mx-auto mb-3 fw-bold fs-4">${nom.slice(0, 2).toUpperCase()}</span>
                        <h5 class="mb-0">${nom}</h5>
                        <p class="small text-secondary mb-2">Client ${type} depuis mars 2024</p>
                                <td><span class="badge badge-light ${type === "particulier" ? "text-bg-secondary" : "text-bg-theme-1"}"> ${type === "particulier" ? "Particulier" : "Entreprise"}</span></td>
                    </div>
                    <div class="card-body border-top">
                        <p class="text-secondary mb-1"><i class="bi bi-envelope me-2"></i> ${email}</p>
                        <p class="text-secondary mb-1"><i class="bi bi-telephone me-2"></i> ${client.tel}</p>
                        <p class="text-secondary mb-1"><i class="bi bi-geo-alt me-2"></i> ${adresse}</p>
                        <p class="text-secondary mb-0"><i class="bi bi-receipt me-2"></i> NIF : ${nif}</p>
                    </div>
                </div>

                <div class="card adminuiux-card border-0 shadow-sm bg-danger-subtle">
                    <div class="card-body">
                        <h6 class="mb-1"><i class="bi bi-exclamation-triangle text-danger me-1"></i> Solde dû</h6>
                        <h3 class="mb-0 text-danger">${soldeDu} FCFA</h3>
                        <p class="small text-secondary mb-0">Facture FA-2026/0158 — échue le 25/09/2026</p>
                    </div>
                </div>
            </div>

            <div class="col-lg-8">
                <div class="row g-3 mb-4">
                    <div class="col-6 col-lg-3">
                        <div class="card adminuiux-card border-0 shadow-sm h-100"><div class="card-body">
                            <p class="small text-secondary mb-1">Total achats</p><h4 class="mb-0">${totalAchats}</h4>
                        </div></div>
                    </div>
                    <div class="col-6 col-lg-3">
                        <div class="card adminuiux-card border-0 shadow-sm h-100"><div class="card-body">
                            <p class="small text-secondary mb-1">Ventes</p><h4 class="mb-0">34</h4>
                        </div></div>
                    </div>
                    <div class="col-6 col-lg-3">
                        <div class="card adminuiux-card border-0 shadow-sm h-100"><div class="card-body">
                            <p class="small text-secondary mb-1">Panier moyen</p><h4 class="mb-0">141 700</h4>
                        </div></div>
                    </div>
                    <div class="col-6 col-lg-3">
                        <div class="card adminuiux-card border-0 shadow-sm h-100"><div class="card-body">
                            <p class="small text-secondary mb-1">Dernier achat</p><h4 class="mb-0 fs-6 pt-2">${dernierAchat}</h4>
                        </div></div>
                    </div>
                </div>

                <ul class="nav nav-pills adminuiux-nav mb-3">
                    <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#ct-ventes" type="button">Historique des ventes</button></li>
                    <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#ct-factures" type="button">Factures</button></li>
                    <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#ct-paiements" type="button">Paiements</button></li>
                </ul>
                <div class="tab-content">
                    <div class="tab-pane fade show active" id="ct-ventes">
                        <div class="card adminuiux-card border-0 shadow-sm">
                            <div class="table-responsive"><table class="table adminuiux-table align-middle mb-0">
                                <thead><tr><th>Vente</th><th>Date</th><th class="text-end">Montant</th><th>Paiement</th></tr></thead>
                                <tbody>
                                    <tr><td><a href="gesco-ventes-detail.html">V-3392</a></td><td class="small">16/09/2026</td><td class="text-end fw-medium">77 500 FCFA</td><td class="small">Espèces</td></tr>
                                    <tr><td><a href="gesco-ventes-detail.html">V-3301</a></td><td class="small">02/09/2026</td><td class="text-end fw-medium">1 362 900 FCFA</td><td class="small">Virement</td></tr>
                                    <tr><td><a href="gesco-ventes-detail.html">V-3212</a></td><td class="small">18/08/2026</td><td class="text-end fw-medium">245 000 FCFA</td><td class="small">Espèces</td></tr>
                                </tbody>
                            </table></div>
                        </div>
                    </div>
                    <div class="tab-pane fade" id="ct-factures">
                        <div class="card adminuiux-card border-0 shadow-sm">
                            <div class="table-responsive"><table class="table adminuiux-table align-middle mb-0">
                                <thead><tr><th>Facture</th><th>Date</th><th class="text-end">Total</th><th>Statut</th></tr></thead>
                                <tbody>
                                    <tr><td><a href="gesco-facturation-detail.html">FA-2026/0159</a></td><td class="small">16/09/2026</td><td class="text-end fw-medium">77 500 FCFA</td><td><span class="badge badge-light text-bg-success">Payée</span></td></tr>
                                    <tr><td><a href="gesco-facturation-detail.html">FA-2026/0158</a></td><td class="small">10/09/2026</td><td class="text-end fw-medium">1 362 900 FCFA</td><td><span class="badge badge-light text-bg-danger">Impayée</span></td></tr>
                                </tbody>
                            </table></div>
                        </div>
                    </div>
                    <div class="tab-pane fade" id="ct-paiements">
                        <div class="card adminuiux-card border-0 shadow-sm">
                            <div class="table-responsive"><table class="table adminuiux-table align-middle mb-0">
                                <thead><tr><th>Référence</th><th>Date</th><th class="text-end">Montant</th><th>Mode</th></tr></thead>
                                <tbody>
                                    <tr><td class="small">PM-2026-0312</td><td class="small">16/09/2026</td><td class="text-end fw-medium text-success">+77 500 FCFA</td><td class="small">Espèces</td></tr>
                                    <tr><td class="small">PM-2026-0309</td><td class="small">10/09/2026</td><td class="text-end fw-medium text-success">+1 042 900 FCFA</td><td class="small">Virement</td></tr>
                                </tbody>
                            </table></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>


                
            `;
    

        // 3. Injection du HTML dans le conteneur
        clientInfo.innerHTML = clientInfoHTML;

    } catch (error) {
        console.error('Erreur lors du chargement des clients:', error);
        clientInfo.innerHTML = `
            <div class="col-12">
                <div class="alert alert-danger" role="alert">
                    Impossible de charger les Information du client. (${error.message || 'Erreur serveur'})
                </div>
            </div>
        `;
    }
});


