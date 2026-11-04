# Importation des produits

Documentation technique de l'import Excel/CSV de la page produits GESCO.

## 1. Fonctionnement actuel

L'import est realise cote navigateur, dans `src/public/assets/js/gesco-data.js`.
Il lit le fichier avec la bibliotheque SheetJS deja presente :

- `src/public/assets/js/vendor/xlsx.full.min.js`

Puis il cree les produits un par un via l'API existante :

- `POST /api/produits`

Il n'existe pas encore d'endpoint serveur dedie a l'import en masse.

## 2. Fichiers concernes

| Fichier | Role |
| --- | --- |
| `src/public/gesco-stock-produits.html` | Bouton `Importer`, modale d'import, champs et textes |
| `src/public/assets/js/gesco-data.js` | Lecture du fichier, validation, creation des produits, resume d'import |
| `src/public/assets/js/api.js` | Fonctions `createProduit`, `createCategorie`, `getCategories` |
| `src/services/produits.ts` | Logique serveur de creation d'un produit |
| `src/routes/produits.ts` | Routes `/produits` |
| `src/services/categories.ts` | Creation d'une categorie |
| `src/routes/categories.ts` | Routes `/categories` |
| `src/db/schema.ts` | Tables `produits`, `stocks`, `mouvements_stock` |

## 3. Formats acceptes

- `.xlsx`
- `.xls`
- `.csv`

La premiere feuille du classeur est utilisee. La premiere ligne non vide doit contenir les en-tetes.

Pour un CSV, le separateur `;` fonctionne (format utilise par l'export GESCO).
L'en-tete est insensible a la casse, aux accents et aux espaces multiples.

## 4. Colonnes reconnues

| Colonne | Obligatoire | Alias acceptes | Valeur par defaut |
| --- | --- | --- | --- |
| Designation | Oui | `designation`, `désignation`, `nom`, `nom du produit`, `produit` | - |
| Categorie | Non | `categorie`, `catégorie`, `category`, `categorie produit` | `Non classé` |
| Prix de vente | Non | `prix de vente`, `prix vente`, `prix`, `prix unitaire`, `price` | `0` |
| Stock | Non | `stock`, `stock initial`, `quantite`, `quantité`, `qte` | `0` |
| Seuil | Non | `seuil`, `seuil minimum`, `seuil min`, `seuilminimum` | `0` |
| Description | Non | `description`, `details`, `détails` | vide |

Une colonne absente est simplement ignoree, sauf `Designation` qui reste obligatoire.

## 5. Regles de validation

Pour chaque ligne :

1. La designation doit etre non vide.
2. Le prix de vente est facultatif :
   - une cellule vide ou une colonne absente donne un prix de `0` ;
   - une valeur non vide doit etre un nombre positif ou nul.
3. Le stock et le seuil doivent etre des entiers positifs ou nuls.
4. La categorie est resolue par :
   - son identifiant numerique, si la valeur correspond a un ID existant ;
   - sinon son libelle, sans tenir compte de la casse ou des accents.
5. Si la categorie est vide ou si la colonne categorie est absente :
   - la categorie `Non classé` est utilisee ;
   - elle est creee automatiquement si elle n'existe pas, via `POST /api/categories`.
6. Si la categorie est renseignee mais introuvable, la ligne est rejetee.
7. Les lignes vides sont ignorees.

Les lignes valides sont importees meme si d'autres lignes contiennent des erreurs.
Le resume indique le nombre de produits importes, le nombre de lignes ignorees
et les premieres erreurs avec leur numero de ligne.

## 6. Comportement apres import

Si au moins un produit a ete cree :

- le fichier selectionne est vide ;
- le tableau des produits est recharge automatiquement ;
- les compteurs, filtres et la pagination sont mis a jour.

La modale reste ouverte pour afficher le resultat.

## 7. Contraintes serveur importantes

Meme si l'import accepte une categorie vide, la table `produits` impose
`id_categorie NOT NULL`. Le serveur exige donc toujours une categorie valide.

Si vous creez un import serveur, il faudra :

1. Resoudre ou creer la categorie `Non classé` avant l'insertion.
2. Creer le produit dans `produits`.
3. Creer la ligne de stock dans `stocks`.
4. Creer un mouvement `stock_initial` dans `mouvements_stock` si le stock initial est superieur a 0.

La fonction existante `createProduit` dans `src/services/produits.ts` fait deja
ces operations dans une transaction.

## 8. Points d'entree utiles dans le code

Dans `src/public/assets/js/gesco-data.js` :

- `productExportRow` : mise en forme d'un produit pour l'export.
- `exportProducts` : export Excel/CSV.
- `productImportColumns` : alias des colonnes reconnues.
- `normalizeImportLabel` : normalisation des en-tetes et libelles.
- `readImportRows` : lecture du fichier avec SheetJS.
- `parseProductImportRows` : detection des colonnes et des lignes de donnees.
- `resolveImportReference` : resolution categorie par ID ou libelle.
- `ensureDefaultProductCategory` : creation/reutilisation de `Non classé`.
- `importProducts` : boucle de validation et de creation.
- `renderProductImportSummary` : affichage du resultat.
- `importForm?.addEventListener("submit", ...)` : branchement de la modale.

Dans `src/services/produits.ts` :

- `createProduit` : validation et creation transactionnelle du produit.
- `repondreErreur` : traduction des erreurs PostgreSQL en messages JSON.

## 9. Limites actuelles

- Import sequentiel : un appel HTTP par produit.
- Pas de mise a jour des produits existants (pas d'upsert).
- Pas de detection de doublons par designation.
- Pas de fichier modele telechargeable dans l'interface.
- Pas de test automatise dedie a l'import.
- Pas de traitement transactionnel global : si la ligne 5 echoue, les lignes 1 a 4 restent creees.

## 10. Pistes d'amelioration

- Ajouter un endpoint serveur `POST /api/produits/import` pour un import en masse transactionnel.
- Ajouter une option `Mettre a jour les produits existants`.
- Ajouter un telechargement de modele Excel/CSV depuis la modale.
- Ajouter une previsualisation avant validation.
- Ajouter des tests d'integration avec un fichier CSV de reference.
- Ajouter la creation automatique des categories inconnues si ce comportement est souhaite.

## 11. Verification

Commandes utiles :

```bash
node --check src/public/assets/js/gesco-data.js
npm run typecheck
```
