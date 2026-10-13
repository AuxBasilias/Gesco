document.addEventListener('DOMContentLoaded', async () => {
    const clientsContainer = document.getElementById('clients-container');

    if (!clientsContainer) {
        console.error('Le conteneur #clients-container est introuvable.');
        return;
    }

    // Afficher un indicateur de chargement
    clientsContainer.innerHTML = `
        <div class="col-12 text-center py-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Chargement des clients...</span>
            </div>
        </div>
    `;

    try {
        // 1. Appel de l'API via AA (Assurez-vous que AA.getClients existe dans api.js)
        const response = await AA.getClients();
        
        // Ajustement selon le format de retour de votre API (ex: response.data ou response)
        const clients = Array.isArray(response) ? response : (response.data || []);

        if (clients.length === 0) {
            clientsContainer.innerHTML = `
                <div class="col-12 text-center py-4">
                    <p class="text-muted mb-0">Aucun client trouvé.</p>
                </div>
            `;
            return;
        }

        // 2. Mapping des données clients vers le template HTML
        const clientsHTML = clients.map(client => {
            // Normalisation des champs pour éviter les valeurs 'null' ou 'undefined'
            const nom = client.nom;
            const email = client.email || 'Email non renseigné';
            const ville = client.ville ;
            const totalAchats = client.totalAchats;
            const soldeDu = client.soldeDu;
            const dernierAchat = client.dernierAchat;
            const type = client.type;
            console.log(type);
            console.log(typeof type);
            console.log(type === "particulier"); 





            return `
            <tr>
                                <td>
                                    <div class="d-flex align-items-center gap-2">
                                        <span class="avatar avatar-32 rounded-circle bg-theme-1 text-white d-flex align-items-center justify-content-center" style="font-size:11px;">${nom.slice(0, 2).toUpperCase()}</span>
                                        <div>
                                            <p class="mb-0 fw-medium">${nom}</p>
                                            <p class="small text-secondary mb-0">${email}</p>
                                        </div>
                                    </div>
                                </td>
                                
                                <td><span class="badge badge-light ${type === "particulier" ? "text-bg-secondary" : "text-bg-theme-1"}"> ${type === "particulier" ? "Particulier" : "Entreprise"}</span></td>
                                <td class="small">${ville}</td>
                                <td class="text-end">${totalAchats}</td>
                                <td class="text-end text-danger">${soldeDu}</td>
                                <td class="small">${dernierAchat}</td>
                                <td class="text-end">
                                    <a href="gesco-clients-detail.html?id=${client.id}" class="btn btn-sm btn-square btn-link" title="Consulter"><i class="bi bi-eye"></i></a>
                                    <button class="btn btn-sm btn-square btn-link" title="Modifier"><i class="bi bi-pencil"></i></button>
                                </td>
                            </tr>


                
            `;
        }).join('');

        // 3. Injection du HTML dans le conteneur
        clientsContainer.innerHTML = clientsHTML;

    } catch (error) {
        console.error('Erreur lors du chargement des clients:', error);
        clientsContainer.innerHTML = `
            <div class="col-12">
                <div class="alert alert-danger" role="alert">
                    Impossible de charger la liste des clients. (${error.message || 'Erreur serveur'})
                </div>
            </div>
        `;
    }
});

// Fonction utilitaire optionnelle pour gérer l'édition
function editClient(clientId) {
    console.log('Éditer le client ID:', clientId);
    // Ajoutez ici la logique d'ouverture de modal ou redirection
}
