document.addEventListener('DOMContentLoaded', () => {
    // Si l'utilisateur est déjà connecté, retour direct au tableau de bord
    if (window.AA && typeof AA.isAuthenticated === 'function' && AA.isAuthenticated()) {
        window.location.replace('gesco-dashboard.html');
        return;
    }

    // 1. Sélection des éléments du DOM
    const emailInput = document.getElementById('emailadd');
    const passwordInput = document.getElementById('passwd');
    const rememberMeCheckbox = document.getElementById('rememberme');
    const togglePasswordBtn = document.querySelector('.position-relative .btn-link');
    const loginBtn = document.querySelector('a.btn-theme');

    // 2. Création dynamique d'un composant d'alerte pour les messages d'erreur / succès
    const alertBox = document.createElement('div');
    alertBox.className = 'alert d-none mb-3';
    alertBox.setAttribute('role', 'alert');
    emailInput.closest('.form-floating').insertAdjacentElement('beforebegin', alertBox);

    const showAlert = (message, type = 'danger') => {
        alertBox.className = `alert alert-${type} mb-3`;
        alertBox.textContent = message;
        alertBox.classList.remove('d-none');
    };

    const hideAlert = () => {
        alertBox.classList.add('d-none');
    };

    // 3. Masquer / Afficher le mot de passe (Icône œil)
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const icon = togglePasswordBtn.querySelector('i');
            const isPassword = passwordInput.getAttribute('type') === 'password';

            passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
            icon.className = isPassword ? 'bi bi-eye-slash' : 'bi bi-eye';
        });
    }

    // 4. Traitement de la connexion avec AA.login()
    const handleLogin = async (e) => {
        e.preventDefault();
        hideAlert();

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        const rememberMe = rememberMeCheckbox ? rememberMeCheckbox.checked : false;

        // Validation client rapide
        if (!email || !password) {
            showAlert('Veuillez remplir tous les champs.');
            return;
        }

        // Effet visuel : chargement sur le bouton
        const originalBtnContent = loginBtn.innerHTML;
        loginBtn.classList.add('disabled');
        loginBtn.innerHTML = `Connexion...`;

        try {
            // Appel à la fonction AA.login définie dans votre api.js
            const res = await AA.login({
                email: email,
                motDePasse: password,
            });

            // Si votre fonction `request` renvoie directement le body JSON ou la réponse :
            const data = res.data || res;
            const token = data.token || data.accessToken;
            if (!token || !data.utilisateur?.id) {
                throw new Error('La réponse de connexion est incomplète. Vérifiez le serveur et réessayez.');
            }

            showAlert('Connexion réussie...', 'success');

            AA.setAuthSession(data);

            // Redirection vers le tableau de bord
            setTimeout(() => {
                window.location.replace(data.redirectUrl || 'gesco-dashboard.html');
            }, 500);

        } catch (error) {
            // Gestion des erreurs renvoyées par l'API / serveur
            const errorMessage = error?.message || error?.error || 'Identifiants incorrects ou erreur serveur.';
            showAlert(errorMessage);

            // Réinitialiser le bouton
            loginBtn.classList.remove('disabled');
            loginBtn.innerHTML = originalBtnContent;
        }
    };

    // Événement au clic du bouton
    loginBtn.addEventListener('click', handleLogin);

    // Soumission automatique lors de l'appui sur "Entrée"
    [emailInput, passwordInput].forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleLogin(e);
            }
        });
    });
});