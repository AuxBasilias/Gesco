# GESCO — guide de reprise du projet

Ce document est un guide pratique pour comprendre, lancer et faire évoluer GESCO
si l'équipe habituelle n'est pas disponible. Il décrit l'état du code tel qu'il
est aujourd'hui ; il ne remplace pas les vérifications nécessaires avant une
mise en production.

## 1. Vue d'ensemble

GESCO est une application de gestion commerciale pour SOLUTECH :

- **Interface** : pages HTML et JavaScript dans `src/public/`.
- **Serveur** : Express et TypeScript dans `src/`.
- **Base de données** : PostgreSQL, avec Drizzle ORM.
- **Port local** : `9000` (défini dans `src/index.ts`).

Les modules principaux sont les produits et stocks, les clients, les
fournisseurs, les commandes et réceptions, les ventes et la caisse, les factures
et paiements, les utilisateurs et l'administration.

## 2. Démarrer le projet

### Prérequis

- Node.js et npm.
- PostgreSQL en cours d'exécution.
- Une base PostgreSQL `boutique` et un utilisateur autorisé à s'y connecter.

### Installation et démarrage local

```sh
npm install
npm run db:migrate
npm run dev
```

Ouvrir ensuite <http://localhost:9000>.

`npm run dev` démarre `tsx watch src/index.ts` : le serveur redémarre lors des
changements TypeScript. Le serveur ne doit pas être lancé avec plusieurs
instances qui écrivent dans la même base.

### Configuration à sécuriser avant tout déploiement

La connexion PostgreSQL est actuellement définie directement dans
`src/db/db.ts` et dans `drizzle.config.ts`. Ces deux fichiers doivent viser la
même base. Pour un environnement partagé ou de production, déplacer l'URL vers
une variable `DATABASE_URL` plutôt que d'inscrire un identifiant dans le code.
Ne jamais inscrire de mot de passe dans ce README, dans Git ou dans une capture
d'écran.

Le module d'authentification exige aussi une variable `JWT_SECRET` de 32
caractères minimum au chargement de l'application. Une valeur absente ou trop
courte empêche le serveur de démarrer. Le fichier `.env` est ignoré par Git ;
utiliser une valeur locale privée et un gestionnaire de secrets pour les
environnements partagés.

## 3. Commandes utiles

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Démarre le serveur local avec rechargement. |
| `npm run typecheck` | Vérifie les types TypeScript sans générer de fichiers. |
| `npm run db:migrate` | Applique les migrations Drizzle non encore exécutées. |
| `npm run test:integration` | Teste la commande/réception fournisseur, la vente, la facture et l'annulation. |

Le test d'intégration écrit temporairement dans la base de l'application. Il est
protégé par deux confirmations et refuse les serveurs qui ne sont pas locaux.
Pour le lancer, après avoir vérifié quelle base est utilisée et démarré le
serveur local :

```sh
RUN_MUTATING_INTEGRATION_TESTS=1 \
ALLOW_SHARED_DATABASE_INTEGRATION=1 \
TEST_BASE_URL=http://localhost:9000 \
npm run test:integration
```

Le script rétablit le stock et le montant attendu en caisse, puis supprime les
enregistrements qu'il a créés. Il restaure aussi le fournisseur associé au stock.
Lancer le test lorsque personne n'utilise la caisse ou le stock concernés et ne
pas l'interrompre pendant son nettoyage. Une base de test isolée reste préférable
si elle est disponible.

Pour les fichiers JavaScript du navigateur, une vérification de syntaxe isolée
est possible avec :

```sh
node --check src/public/assets/js/gesco-data.js
node --check src/public/assets/js/api.js
```

Ajouter le fichier concerné à `node --check` après toute modification de script.

## 4. Où modifier le code

| Besoin | Fichiers à examiner en premier |
| --- | --- |
| Démarrage, port et montage des routes | `src/index.ts` |
| Tables et relations SQL | `src/db/schema.ts` |
| Accès PostgreSQL | `src/db/db.ts`, `drizzle.config.ts` |
| Routes HTTP métier | `src/routes/` |
| Validations et transactions métier | `src/services/` |
| Client API du navigateur | `src/public/assets/js/api.js` |
| Données, formulaires et tableaux des écrans métier | `src/public/assets/js/gesco-data.js` |
| Facture imprimable liée à une vente | `src/public/gesco-facturation-detail.html`, `src/public/assets/js/invoice/invoice-engine.js` |
| Création et impression des bons de commande | `src/public/gesco-approvisionnement-commandes.html`, `src/public/gesco-approvisionnement-commande-detail.html`, `src/public/assets/js/purchase-order.js`, `src/public/assets/css/purchase-order.css` |
| Migrations PostgreSQL | `drizzle/*.sql`, `drizzle/meta/_journal.json` |

`src/public/assets/js/app13a2.js` charge `api.js` puis `gesco-data.js` dans les
écrans métier. Il s'agit d'un bundle minifié du thème : privilégier la
modification des scripts métier lisibles, pas du bundle.

Les pages sont servies directement comme fichiers statiques par Express. Les
vues de document (facture et bon de commande) chargent leur API et leur script
proprement depuis leur HTML.

## 5. Flux métier importants

### Produits et stock

- Le prix de vente est stocké sur le produit ; les prix d'achat ne sont plus gérés.
- La quantité disponible et le seuil minimum sont dans la table `stocks`.
- Une réception fournisseur augmente le stock et écrit un mouvement de stock.
- Une vente décrémente le stock et écrit également un mouvement.
- Les images de produit ont été retirées du flux applicatif et du schéma.

### Commandes fournisseurs

1. L'écran `gesco-approvisionnement-commandes.html` charge la liste par l'API.
2. « Nouvelle commande » ouvre un formulaire : fournisseur d'abord, puis lignes
   produit, quantité et prix unitaire saisi manuellement.
3. Le total est calculé avant envoi ; le serveur recalcule et persiste la
   commande et ses lignes dans une transaction.
4. Le bouton de consultation mène au bon de commande imprimable.
5. Une réception est enregistrée par l'API de réception et met à jour le stock.

La création actuelle permet de choisir n'importe quel produit avec n'importe
quel fournisseur. Si le métier impose que le fournisseur soit celui associé au
produit, filtrer le catalogue et faire respecter cette règle aussi côté serveur.
L'action de réception dans la liste utilise encore une saisie JSON via une
boîte de dialogue ; elle mérite un formulaire avec les lignes et quantités
livrées.

### Ventes et factures

- Le terminal enregistre une vente directement et décrémente le stock, sans
  gestion de session de caisse.
- La facture commerciale est générée à partir des informations de la vente via
  `POST /api/ventes/:id/facture`.
- La facture possède `idVente` et ses lignes reprennent les lignes de vente.
  L'index unique `factures_vente_unique_idx` empêche de générer plusieurs
  factures pour la même vente.
- Depuis le navigateur, l'ouverture avec `?venteId=<id>` crée la facture si
  nécessaire, puis remplace l'URL par `?id=<idFacture>`.
- Le détail et l'historique des ventes donnent accès à la facture ; elle peut
  ensuite être imprimée ou enregistrée en PDF.
- Une vente comptoir peut ne pas avoir de client : `factures.id_client` est
  nullable pour ce parcours.

Éviter d'utiliser l'ancienne création autonome de facture pour dupliquer une
facture de vente. Les paiements de facture et les factures liées à une vente
doivent rester cohérents avec la vente source.

### Migrations

Les migrations sont ordonnées dans `drizzle/meta/_journal.json`. Les fichiers
SQL existants vont de `0000` à `0020`; ils couvrent le schéma métier, le stock,
les fournisseurs, le retrait des images produit, les factures liées aux ventes
et la suppression des sessions de caisse et des prix d'achat produit.

Pour chaque évolution de base :

1. Modifier le schéma dans `src/db/schema.ts`.
2. Ajouter une nouvelle migration SQL numérotée ; **ne pas modifier une
   migration déjà appliquée**.
3. Ajouter son entrée à `drizzle/meta/_journal.json`.
4. Faire une sauvegarde de la base avant une migration importante.
5. Appliquer avec `npm run db:migrate`, puis vérifier le code et les données.

Ne pas supprimer une base ou des lignes métier pour réparer un environnement
sans validation explicite. Tester les migrations sur une base de développement
avant la base de présentation ou de production.

## 6. API et organisation serveur

- `src/index.ts` expose les fichiers statiques et monte les routes `/api`.
- `src/routes/operations.ts` monte les opérations transverses : ventes, caisse,
  commandes, réceptions, factures, paiements, stocks, inventaires, rapports.
- Les autres routeurs métier sont séparés par domaine : `clients.ts`,
  `produits.ts`, `fournisseurs.ts`, `categories.ts`, `utilisateurs.ts`.
- Les appels front passent par `window.AA` dans `api.js`.
- Les opérations qui mettent à jour plusieurs tables doivent utiliser une
  transaction Drizzle dans le service.

Principales routes (préfixe `/api`) :

| Domaine | Routes |
| --- | --- |
| Produits | `/produits`, `/categories` |
| Stocks | `/stocks`, `/stocks/mouvements`, `/inventaires` |
| Fournisseurs | `/fournisseurs`, `/commandes`, `/receptions` |
| Ventes | `/ventes`, `/ventes-retours` |
| Facturation | `/factures`, `/paiements` |
| Administration | `/utilisateurs`, `/administration`, `/dashboard`, `/rapports` |

Le tableau de bord accepte `days=7`, `days=30` ou `days=90` (7 jours par
défaut) et calcule ses indicateurs à partir des ventes, lignes de vente,
factures et stocks enregistrés. Les valeurs ne sont pas simulées.

Pour les routes exactes et méthodes HTTP, consulter les fichiers dans
`src/routes/` et les méthodes exposées dans `api.js`.

## 7. Authentification et exposition réseau — important

L'authentification existe (`/api/login`, JWT, middleware dans
`src/auth/auth.ts`), mais le montage global du middleware dans `src/index.ts` est
commenté. Plusieurs opérations de gestion sont donc accessibles sans connexion,
conformément au choix fonctionnel actuel.

**Cette configuration convient au développement ou à une présentation locale,
pas à une exposition publique.** Avant tout déploiement sur Internet ou réseau
non fiable, réactiver une protection adaptée pour toutes les routes de lecture
et d'écriture, vérifier les rôles d'accès, limiter les accès réseau et gérer les
secrets de manière sécurisée. Le simple fait de masquer un lien dans l'interface
ne protège pas une API.

## 8. Contrôles manuels recommandés avant une présentation

Utiliser une base de démonstration restaurable et contrôler les données après
chaque parcours qui écrit en base.

1. Créer un produit puis vérifier ses informations et son stock.
2. Enregistrer une vente et contrôler le stock.
3. Ouvrir la facture depuis le ticket ou l'historique ; comparer les lignes et
   totaux à la vente, puis vérifier l'impression PDF.
4. Créer une commande fournisseur avec plusieurs produits ; vérifier le prix
   proposé, les quantités et le total.
5. Ouvrir et imprimer le bon de commande.
6. Réceptionner la commande et contrôler les quantités de stock et le mouvement.
7. Vérifier les messages d'erreur avec des identifiants inexistants et des
   données incomplètes.
8. Recharger les pages pour confirmer que les données affichées proviennent
   bien de l'API et restent enregistrées.

Les validations navigateur faites pendant le développement peuvent avoir écrit
des données en base. Examiner les ventes, factures, commandes et mouvements
existants avant de présenter l'application ; ne pas supposer que les données
locales sont vierges.

## 9. Règles de contribution prudentes

- Lire le schéma, le service et la route d'un flux avant d'en modifier un seul.
- Mettre les règles métier et les validations côté serveur ; le navigateur ne
  constitue pas une frontière de sécurité.
- Garder les changements multi-tables dans une transaction.
- Pour un nouvel endpoint, mettre à jour le routeur, le service, le client API
  et l'écran concerné.
- Utiliser des messages d'erreur explicites et ne pas convertir une erreur
  serveur en succès silencieux.
- Garder les données d'exemple hors des écrans métier connectés à la base.
- Après une modification : `npm run typecheck`, `node --check` sur les scripts
  touchés et test manuel ciblé dans le navigateur. Restaurer ensuite la base de
  démonstration si le test a créé des données.
