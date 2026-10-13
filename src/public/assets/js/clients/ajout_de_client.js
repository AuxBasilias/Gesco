document.addEventListener("DOMContentLoaded", () => {

    const cardBody = document.querySelector(".col-lg-8 .card-body");


    const btnCreerClient = document.getElementById("btnCreerClient");

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


    btnCreerClient.addEventListener("click", async () => {

        // Récupération du type sélectionné
        const type = document.getElementById("tc1").checked
    ? "particulier"
    : "entreprise";

        // Récupération des valeurs
        const nom = document.getElementById("nom").value.trim();
        const nif = document.getElementById("nif").value.trim();
        const telephone = document.getElementById("telephone").value.trim();
        const email = document.getElementById("email").value.trim();
        const adresse = document.getElementById("adresse").value.trim();
        const ville = document.getElementById("ville").value.trim();

       


        // Validation
        if (!nom) {
            alert("Veuillez renseigner le nom du client.");
            return;
        }

        if (!type) {
            alert("Veuillez sélectionner le type de client.");
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
            type:type,
        };


        console.log("Client à envoyer :", client);


        try {

            const data = await AA.createClient(client);



            console.log("Réponse API :", data);


            if (!data.success) {
                  showAlert(
                data.message || "Erreur lors de la création du client.",
                "danger"
            );

                return;
            }

            showAlert('Client ajouté...', 'success');

            setTimeout(() => {
                window.location.href = data.redirectUrl || '/gesco-clients.html';
            }, 500);


        } catch (error) {

            console.error(
                "Erreur lors de la création du client :",
                error
            );
            showAlert(error,'danger');



            
        }

    });

});