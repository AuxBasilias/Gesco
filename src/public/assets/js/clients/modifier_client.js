document.addEventListener("DOMContentLoaded", async () => {

    const cardBody = document.querySelector(".col-lg-8 .card-body");

    const btnModifierClient = document.getElementById("btnModifierClient");

    // Création de l'alerte
    const alertBox = document.createElement("div");

    alertBox.className = "alert d-none mb-3";
    alertBox.setAttribute("role", "alert");

    // On place l'alerte au début du formulaire
    cardBody.insertAdjacentElement("afterbegin", alertBox);

    // Fonction pour afficher l'alerte
    const showAlert = (message, type = "danger") => {
        alertBox.className = `alert alert-${type} mb-3`;
        alertBox.textContent = message;
        alertBox.classList.remove("d-none");
    };

    // Fonction pour cacher l'alerte
    const hideAlert = () => {
        alertBox.classList.add("d-none");
    };

    // Récupération de l'identifiant du client depuis l'URL
    const params = new URLSearchParams(window.location.search);
    const clientId = params.get("id");

    if (!clientId) {
        showAlert("Aucun client sélectionné. Retournez à la liste des clients.");
        btnModifierClient.disabled = true;
        return;
    }

    // Éléments du formulaire
    const champs = {
        nom: document.getElementById("nom"),
        nif: document.getElementById("nif"),
        telephone: document.getElementById("telephone"),
        email: document.getElementById("email"),
        adresse: document.getElementById("adresse"),
        ville: document.getElementById("ville"),
    };

    // Pré-remplissage du formulaire
    try {
        const client = await AA.getClient(clientId);
        const data = client.client ?? client;

        champs.nom.value = data.nom ?? "";
        champs.nif.value = data.nif ?? "";
        champs.telephone.value = data.tel ?? "";
        champs.email.value = data.email ?? "";
        champs.adresse.value = data.adresse ?? "";
        champs.ville.value = data.ville ?? "";

        const estEntreprise = String(data.type ?? "").trim().toLowerCase().startsWith("entr");
        document.getElementById(estEntreprise ? "tc2" : "tc1").checked = true;
    } catch (error) {
        console.error("Erreur lors du chargement du client :", error);
        showAlert(error.message || "Impossible de charger le client.");
        btnModifierClient.disabled = true;
        return;
    }

    btnModifierClient.addEventListener("click", async () => {

        // Récupération du type sélectionné
        const type = document.getElementById("tc1").checked ? "particulier" : "entreprise";

        // Récupération des valeurs
        const nom = champs.nom.value.trim();
        const nif = champs.nif.value.trim();
        const telephone = champs.telephone.value.trim();
        const email = champs.email.value.trim();
        const adresse = champs.adresse.value.trim();
        const ville = champs.ville.value.trim();

        hideAlert();

        // Validation
        if (!nom) {
            showAlert("Veuillez renseigner le nom du client.");
            return;
        }

        // Objet à envoyer à l'API
        const client = {
            nom,
            nif: nif || null,
            tel: telephone || null,
            email: email || null,
            adresse: adresse || null,
            ville: ville || null,
            type,
        };

        console.log("Client à modifier :", client);

        try {
            const data = await AA.updateClient(clientId, client);

            console.log("Réponse API :", data);

            if (!data.success) {
                showAlert(data.message || "Erreur lors de la modification du client.", "danger");
                return;
            }

            showAlert("Client modifié...", "success");

            setTimeout(() => {
                window.location.href = data.redirectUrl || "/gesco-clients.html";
            }, 500);

        } catch (error) {
            console.error("Erreur lors de la modification du client :", error);
            showAlert(error.message || "Erreur lors de la modification du client.", "danger");
        }

    });

});
