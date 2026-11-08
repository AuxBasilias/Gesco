# Explication — factorisation du menu et des éléments communs

## Objectif

Avant, le header, le menu latéral (sidebar), la recherche plein écran et le footer étaient copiés-collés dans chaque page HTML. La moindre modification du menu devait être répétée sur toutes les pages.

Le but était donc de centraliser ces blocs dans des **partiels** réutilisables, puis de les injecter automatiquement dans les pages au moment où elles sont servies par Express.

## Principe retenu

L'injection se fait **côté serveur**, avant l'envoi de la page au navigateur.

Concrètement :

1. Les blocs communs sont stockés une seule fois dans `src/partials/`.
2. Chaque page HTML contient simplement un marqueur, par exemple :
   ```html
   <!-- include:header -->
   <!-- include:search-modal -->
   <!-- include:sidebar -->
   <!-- include:footer -->
   ```
3. Un middleware Express lit la page demandée, remplace chaque marqueur par le contenu du partiel correspondant, puis renvoie le HTML final.

Avantage par rapport à une solution JavaScript (`fetch` côté navigateur) : aucun flash de chargement, pas de dépendance au JS client, et le HTML envoyé est complet.

## Fichiers créés

### `src/partials/`

Contient les blocs communs :

| Fichier | Contenu |
| --- | --- |
| `header.html` | Barre de navigation supérieure (logo, recherche, mode sombre, profil) |
| `search-modal.html` | Fenêtre de recherche plein écran |
| `sidebar.html` | Menu latéral standard |
| `sidebar-caisse.html` | Variante du menu utilisée par les pages Caisse |
| `footer.html` | Footer standard |
| `footer-compact.html` | Variante compacte du footer (Caisse et Terminal de vente) |

### `src/lib/html-includes.ts`

Contient le middleware `htmlIncludes` :

- intercepte les requêtes `GET`/`HEAD` vers des pages `.html` (ou sans extension) ;
- ignore les routes `/api` ;
- protège contre les remontées de répertoire (`../`) ;
- lit les partiels et les met en cache en mémoire ;
- remplace les marqueurs `<!-- include:nom -->` par le contenu du partiel ;
- applique les en-têtes `Cache-Control: no-store` sur les pages HTML.

### `src/index.ts`

Le middleware est branché avant `express.static` :

```ts
app.use(htmlIncludes({
  publicDir: path.join(__dirname, "public"),
  partialsDir: path.join(__dirname, "partials"),
}));
```

Ainsi, les pages contenant des marqueurs sont rendues par le middleware, et les autres fichiers (CSS, JS, images, pages sans marqueur) restent servis normalement par `express.static`.

## Pages modifiées

Les 24 pages qui utilisaient le menu ont été converties :

- suppression du header, de la recherche, du menu et du footer dupliqués ;
- remplacement par les marqueurs d'inclusion ;
- les pages Caisse utilisent `sidebar-caisse` et `footer-compact` ;
- l'ancien fichier `src/public/header.html`, devenu inutile, a été supprimé.

Les pages publiques (connexion, mot de passe oublié, réinitialisation, index, accès refusé) et les vues d'impression (détails commande, facture, livraison) n'ont pas été modifiées, car elles n'utilisent pas ce menu.

## Ajouter ou modifier un élément du menu

Pour modifier le menu, il suffit désormais de modifier **un seul fichier** :

- `src/partials/sidebar.html` pour le menu standard ;
- `src/partials/sidebar-caisse.html` pour le menu des pages Caisse.

Toutes les pages seront mises à jour automatiquement.

## Ajouter une nouvelle page

Créer la page comme d'habitude, puis ajouter les marqueurs nécessaires :

```html
<!-- include:header -->
<!-- include:search-modal -->
<!-- include:sidebar -->

<main>...</main>

<!-- include:footer -->
```

## Vérifications effectuées

- `npm run typecheck` : aucune erreur.
- Test du serveur : les 24 pages répondent en HTTP 200.
- Aucun marqueur `<!-- include:... -->` ne subsiste dans le HTML envoyé au navigateur.
- Le header, la sidebar et le footer sont bien présents une seule fois dans chaque page.
- Les fichiers statiques (CSS, JS) continuent d'être servis correctement.

## Remarque

Les partiels sont lus depuis `src/partials` à l'exécution via `tsx`. Si le projet est un jour compilé vers `dist`, il faudra copier le dossier `src/partials` dans `dist/partials` lors du build, sinon les marqueurs ne seront pas remplacés.

---

# Mise à jour — style du tableau de facture (détail / impression)

## Demande

Faire ressembler le tableau de la facture générée à celui du fichier de référence `tableau.html`.

Après clarification, la modification concerne le **détail / l'impression d'une facture** (`gesco-facturation-detail.html` et le moteur `invoice-engine`), et non la liste des factures de la page Facturation.

## Ce qui a été modifié

### `src/public/assets/css/invoice-engine.css`

Le tableau des articles a été aligné sur le rendu de `tableau.html` :

- bordures des cellules passées à `1px solid #555555` (au lieu de `1.2px` noir) ;
- largeurs de colonnes ajustées pour se rapprocher de la référence :
  - Référence : 11 %
  - Nombre : 10 %
  - Description : 43 %
  - Prix Unitaire : 15 %
  - R % : 7 %
  - Montant : 14 %
- en-têtes de colonnes centrés, sur fond blanc, avec un padding proche de la référence ;
- cellules alignées en haut avec un padding de `1.6mm 2mm` ;
- ajout d'une ligne de titre de section `.titre-section` avec fond jaune `#f5b800` dans la colonne Description ;
- description des articles : première ligne en gras, lignes suivantes en texte normal (comme dans `tableau.html`) ;
- colonnes Prix Unitaire et Montant alignées à droite, colonne Nombre et R % centrées ;
- bordures des cases de totaux passées à `1px solid #555555` ;
- styles d'impression (`@media print`) mis à jour avec les mêmes bordures grises.

### `src/public/assets/js/invoice/invoice-engine.js`

- le bandeau de commande (`orderBanner`) n'est plus inséré dans la cellule Description du premier article ;
- il est désormais rendu comme une **ligne de titre de section** en haut du tableau, avec la cellule Description colorée en jaune, comme dans `tableau.html` ;
- la hauteur du bandeau est déduite du budget de pagination pour ne pas déborder de la page ;
- suppression de la variable d'index devenue inutile dans la boucle des articles.

## Vérifications effectuées

- `node --check src/public/assets/js/invoice/invoice-engine.js` : syntaxe JavaScript valide.
- Contrôle visuel des styles : bordures, alignements et ligne jaune correspondent à la structure de `tableau.html`.
- La pagination, les totaux, les conditions générales, les signatures et le pied de page existants sont conservés.

## Remarque

Le document conserve son en-tête, ses coordonnées client et son pied de page SOLUTECH. Seul le rendu du tableau (et son titre de section) a été aligné sur `tableau.html`, afin de ne pas supprimer les informations nécessaires à une vraie facture.

---

# Mise à jour — rapprochement plus fidèle de `tableau.html`

## Demande

- S'inspirer concrètement du style de `tableau.html`.
- Garder par défaut le texte « Fournitures des équipements informatiques » dans la cellule jaune.
- Permettre à l'utilisateur de modifier ce texte.
- Supprimer les traits horizontaux entre les lignes du tableau.

## Ce qui a été modifié

### Lignes sans séparation horizontale

Dans `src/public/assets/css/invoice-engine.css` :

- les cellules du corps du tableau n'ont plus de `border-bottom` :
  - à l'écran ;
  - à l'impression (`@media print`) ;
- seules les bordures verticales gauche/droite des cellules et la bordure extérieure du tableau restent visibles ;
- la ligne sous l'en-tête est toujours produite par les bordures des `<th>` ;
- la règle spéciale devenue inutile pour les tableaux à une seule ligne a été supprimée.

### Cellule jaune de titre de section

Dans `src/public/assets/js/invoice/invoice-engine.js` :

- ajout d'un champ `sectionTitle` dans `currentInvoice` ;
- valeur par défaut : `Fournitures des équipements informatiques` ;
- la ligne jaune n'utilise plus le bandeau de commande (`orderBanner`) ;
- le titre est rendu dans une ligne dédiée `.titre-section`, avec la cellule Description en jaune, comme dans `tableau.html` ;
- la cellule jaune est maintenant `contenteditable` : l'utilisateur peut cliquer dessus et modifier le texte directement ;
- la saisie met à jour `currentInvoice.sectionTitle` en mémoire ;
- le texte modifié est donc utilisé pour l'impression / l'export PDF tant que la page n'est pas rechargée ;
- la hauteur du titre est toujours prise en compte dans le calcul de pagination.

Dans `src/public/assets/css/invoice-engine.css` :

- ajout d'un curseur texte sur la cellule modifiable ;
- ajout d'un contour visible au focus pour indiquer que la cellule est en cours d'édition ;
- suppression de l'ancien style `.order-banner-row`, devenu inutilisé.

## Vérifications effectuées

- `node --check src/public/assets/js/invoice/invoice-engine.js` : syntaxe JavaScript valide.
- La cellule jaune affiche par défaut « Fournitures des équipements informatiques ».
- Le clic sur cette cellule permet de modifier son contenu.
- Les lignes du tableau n'ont plus de trait horizontal entre elles.
- Les bordures verticales et le cadre extérieur restent conformes à `tableau.html`.
- La pagination et le budget de hauteur tiennent compte de la ligne de titre.

## Comment modifier le titre

1. Ouvrir une facture depuis la page Facturation.
2. Cliquer sur la cellule jaune du tableau.
3. Modifier le texte.
4. Imprimer ou exporter en PDF : le texte saisi est utilisé.

La modification est locale à la page ouverte. Elle n'est pas enregistrée en base de données, car le modèle de facture ne possède pas encore de champ persistant pour ce titre.

---

# Mise à jour — conditions, descriptions produits et images locales

## Demandes

1. Afficher « 60% à l'accord et 40% à la livraison » en rouge et en gras.
2. Ajouter la description des produits sous leur désignation, si elle existe.
3. Permettre d'ajouter une image centrée dans la cellule d'une ligne produit, uniquement pour la facture affichée / imprimée, sans enregistrement sur le serveur.

## Ce qui a été modifié

### Condition de paiement en rouge gras

Dans `src/public/assets/js/invoice/invoice-engine.js` :

- la valeur de `conditions.paymentCondition` est maintenant entourée d'un `<span class="payment-condition-value">` ;
- la classe est appliquée à la valeur affichée, qu'elle vienne de la base ou de la valeur par défaut « 60% à l'accord et 40% à la livraison ».

Dans `src/public/assets/css/invoice-engine.css` :

```css
.payment-condition-value {
  color: #b00020;
  font-weight: 700;
}
```

### Description des produits

Dans `src/public/assets/js/invoice/invoice-engine.js` :

- lors de la construction des lignes de facture, le produit associé à la ligne est récupéré ;
- si `product.description` existe, elle est découpée en lignes et ajoutée après la désignation ;
- si la description est identique à la désignation, elle n'est pas dupliquée ;
- la désignation reste en gras (première ligne), la description s'affiche en texte normal ;
- les descriptions vides sont ignorées ;
- le calcul de hauteur estime aussi le nombre de lignes visuelles des descriptions longues pour éviter les débordements.

### Image locale dans une cellule produit

Dans `src/public/assets/js/invoice/invoice-engine.js` :

- ajout d'un champ `imageDataUrl` sur chaque ligne d'article ;
- chaque cellule Description contient un bouton discret `+ Image` visible uniquement à l'écran (`no-print`) ;
- au clic, un sélecteur de fichier image s'ouvre ;
- l'image choisie est convertie en Data URL via `FileReader`, stockée en mémoire dans la ligne concernée, puis la facture est réaffichée ;
- l'image est insérée dans un conteneur `.product-image-wrap` centré horizontalement dans la cellule ;
- si une image existe déjà, le bouton devient « Changer l'image » ;
- la hauteur de la ligne est automatiquement augmentée de 30 mm lorsqu'une image est présente, afin que la pagination reste correcte ;
- aucune requête réseau ni enregistrement serveur n'est effectué : l'image reste locale à la page.

Dans `src/public/assets/css/invoice-engine.css` :

- `.product-image-wrap` centre l'image dans la cellule ;
- `.product-image-wrap img` limite la taille à 40 mm de large et 28 mm de haut ;
- `.add-product-image` positionne le bouton en bas à droite de la cellule, sans perturber le contenu imprimé ;
- le bouton est masqué à l'impression grâce à la classe `no-print`.

## Vérifications effectuées

- `node --check src/public/assets/js/invoice/invoice-engine.js` : syntaxe JavaScript valide.
- La condition de paiement est rouge et grasse.
- Les descriptions produits sont ajoutées sous la désignation lorsqu'elles existent.
- Le bouton d'ajout d'image ouvre bien un sélecteur de fichier.
- L'image est centrée dans la cellule et n'apparaît pas comme élément imprimé supplémentaire (le bouton est masqué).
- La pagination tient compte de la hauteur supplémentaire des images.

## Remarque

Les images ne sont pas persistées : elles sont perdues au rechargement de la page, conformément à la demande (« juste sur la facture pour l'impression, pas dans le serveur »).
