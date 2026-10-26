import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  boolean,
  decimal,
  jsonb,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "user", "caissiere", "comptable"]);

const money = (name: string) => decimal(name, { precision: 14, scale: 2 });
const createdAt = () => timestamp("created_at").defaultNow().notNull();

export const utilisateursTable = pgTable("utilisateurs", {
  id: serial("id").primaryKey(),
  nomUtilisateur: text("nom_utilisateur").notNull().unique(),
  email: text("email").notNull().unique(),
  motDePasse: text("mot_de_passe").notNull(),
  role: roleEnum().notNull(),
  actif: boolean("actif").notNull().default(true),
  telephone: varchar("telephone", { length: 50 }),
  tokenVersion: integer("token_version").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  nom: varchar("nom", { length: 150 }).notNull(),
  email: varchar("email", { length: 150 }).unique(),
  type: varchar("type", { length: 50 }).notNull().default("particulier"),
  ville: varchar("ville", { length: 100 }),
  adresse: text("adresse"),
  tel: varchar("tel", { length: 50 }),
  nif: varchar("nif", { length: 100 }),
  limiteCredit: money("limite_credit").notNull().default("0"),
  delaiPaiement: integer("delai_paiement").notNull().default(0),
  totalAchats: money("total_achats").notNull().default("0"),
  soldeDu: money("solde_du").notNull().default("0"),
  dernierAchat: timestamp("dernier_achat"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  label: varchar("label", { length: 100 }).notNull().unique(),
  createdAt: createdAt(),
});

export const fournisseurs = pgTable("fournisseurs", {
  id: serial("id").primaryKey(),
  nom: varchar("nom", { length: 150 }).notNull(),
  tel: varchar("tel", { length: 30 }),
  email: varchar("email", { length: 150 }),
  adresse: text("adresse"),
  nif: varchar("nif", { length: 100 }),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const produits = pgTable("produits", {
  id: serial("id").primaryKey(),
  designation: varchar("designation", { length: 200 }).notNull(),
  idCategorie: integer("id_categorie")
    .notNull()
    .references(() => categories.id, { onDelete: "restrict", onUpdate: "cascade" }),
  description: text("description"),
  prixVente: money("prix_vente").notNull(),
  archive: boolean("archive").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const stocks = pgTable("stocks", {
  id: serial("id").primaryKey(),
  idProduit: integer("id_produit")
    .notNull()
    .unique()
    .references(() => produits.id, { onDelete: "cascade", onUpdate: "cascade" }),
  initial: integer("initial").notNull().default(0),
  quantite: integer("quantite").notNull().default(0),
  seuilMinimum: integer("seuil_minimum").notNull().default(0),
  idFournisseur: integer("id_fournisseur").references(() => fournisseurs.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const mouvementsStock = pgTable(
  "mouvements_stock",
  {
    id: serial("id").primaryKey(),
    idProduit: integer("id_produit")
      .notNull()
      .references(() => produits.id, { onDelete: "restrict" }),
    type: varchar("type", { length: 30 }).notNull(),
    quantite: integer("quantite").notNull(),
    reference: varchar("reference", { length: 100 }),
    motif: text("motif"),
    idUtilisateur: integer("id_utilisateur").references(() => utilisateursTable.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (table) => [index("mouvements_stock_produit_date_idx").on(table.idProduit, table.createdAt)],
);

export const commandesFournisseurs = pgTable("commandes_fournisseurs", {
  id: serial("id").primaryKey(),
  reference: varchar("reference", { length: 50 }).notNull().unique(),
  idFournisseur: integer("id_fournisseur")
    .notNull()
    .references(() => fournisseurs.id, { onDelete: "restrict" }),
  statut: varchar("statut", { length: 30 }).notNull().default("brouillon"),
  dateCommande: timestamp("date_commande").defaultNow().notNull(),
  dateLivraisonPrevue: timestamp("date_livraison_prevue"),
  montantHT: money("montant_ht").notNull().default("0"),
  montantTaxe: money("montant_taxe").notNull().default("0"),
  montantTotal: money("montant_total").notNull().default("0"),
  notes: text("notes"),
  idUtilisateur: integer("id_utilisateur").references(() => utilisateursTable.id, {
    onDelete: "set null",
  }),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const lignesCommande = pgTable("lignes_commande", {
  id: serial("id").primaryKey(),
  idCommande: integer("id_commande")
    .notNull()
    .references(() => commandesFournisseurs.id, { onDelete: "cascade" }),
  idProduit: integer("id_produit")
    .notNull()
    .references(() => produits.id, { onDelete: "restrict" }),
  designation: varchar("designation", { length: 200 }).notNull(),
  quantite: integer("quantite").notNull(),
  quantiteRecue: integer("quantite_recue").notNull().default(0),
  prixUnitaire: money("prix_unitaire").notNull(),
  montantTotal: money("montant_total").notNull(),
});

export const receptions = pgTable("receptions", {
  id: serial("id").primaryKey(),
  reference: varchar("reference", { length: 50 }).notNull().unique(),
  idCommande: integer("id_commande")
    .notNull()
    .references(() => commandesFournisseurs.id, { onDelete: "restrict" }),
  dateReception: timestamp("date_reception").defaultNow().notNull(),
  statut: varchar("statut", { length: 30 }).notNull().default("confirmee"),
  notes: text("notes"),
  idUtilisateur: integer("id_utilisateur").references(() => utilisateursTable.id, {
    onDelete: "set null",
  }),
});

export const lignesReception = pgTable("lignes_reception", {
  id: serial("id").primaryKey(),
  idReception: integer("id_reception")
    .notNull()
    .references(() => receptions.id, { onDelete: "cascade" }),
  idLigneCommande: integer("id_ligne_commande")
    .notNull()
    .references(() => lignesCommande.id, { onDelete: "restrict" }),
  quantiteRecue: integer("quantite_recue").notNull(),
});

export const ventes = pgTable(
  "ventes",
  {
    id: serial("id").primaryKey(),
    reference: varchar("reference", { length: 50 }).notNull().unique(),
    idClient: integer("id_client").references(() => clientsTable.id, { onDelete: "set null" }),
    statut: varchar("statut", { length: 30 }).notNull().default("payee"),
    dateVente: timestamp("date_vente").defaultNow().notNull(),
    montantHT: money("montant_ht").notNull().default("0"),
    montantTaxe: money("montant_taxe").notNull().default("0"),
    tvaAppliquee: boolean("tva_appliquee").notNull().default(true),
    montantTotal: money("montant_total").notNull(),
    montantPaye: money("montant_paye").notNull().default("0"),
    modePaiement: varchar("mode_paiement", { length: 30 }),
    notes: text("notes"),
    donneesDocument: jsonb("donnees_document").$type<Record<string, unknown>>().notNull().default({}),
    idUtilisateur: integer("id_utilisateur").references(() => utilisateursTable.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (table) => [index("ventes_date_idx").on(table.dateVente)],
);

export const lignesVente = pgTable("lignes_vente", {
  id: serial("id").primaryKey(),
  idVente: integer("id_vente")
    .notNull()
    .references(() => ventes.id, { onDelete: "cascade" }),
  idProduit: integer("id_produit")
    .notNull()
    .references(() => produits.id, { onDelete: "restrict" }),
  designation: varchar("designation", { length: 200 }).notNull(),
  quantite: integer("quantite").notNull(),
  prixUnitaire: money("prix_unitaire").notNull(),
  remise: money("remise").notNull().default("0"),
  montantTotal: money("montant_total").notNull(),
});

export const numerosSerieLivraison = pgTable("numeros_serie_livraison", {
  id: serial("id").primaryKey(),
  idVente: integer("id_vente")
    .notNull()
    .references(() => ventes.id, { onDelete: "cascade" }),
  idLigneVente: integer("id_ligne_vente")
    .notNull()
    .references(() => lignesVente.id, { onDelete: "cascade" }),
  numeroSerie: varchar("numero_serie", { length: 200 }).notNull(),
  observation: text("observation"),
  idUtilisateur: integer("id_utilisateur").references(() => utilisateursTable.id, {
    onDelete: "set null",
  }),
  createdAt: createdAt(),
});

export const factures = pgTable(
  "factures",
  {
    id: serial("id").primaryKey(),
    reference: varchar("reference", { length: 50 }).notNull().unique(),
    idClient: integer("id_client").references(() => clientsTable.id, { onDelete: "restrict" }),
    idVente: integer("id_vente").references(() => ventes.id, { onDelete: "set null" }),
    statut: varchar("statut", { length: 30 }).notNull().default("brouillon"),
    dateFacture: timestamp("date_facture").defaultNow().notNull(),
    dateEcheance: timestamp("date_echeance"),
    montantHT: money("montant_ht").notNull().default("0"),
    montantTaxe: money("montant_taxe").notNull().default("0"),
    tvaAppliquee: boolean("tva_appliquee").notNull().default(true),
    montantTotal: money("montant_total").notNull().default("0"),
    montantPaye: money("montant_paye").notNull().default("0"),
    donneesDocument: jsonb("donnees_document").$type<Record<string, unknown>>().notNull().default({}),
    notes: text("notes"),
    relances: integer("relances").notNull().default(0),
    dateDerniereRelance: timestamp("date_derniere_relance"),
    idUtilisateur: integer("id_utilisateur").references(() => utilisateursTable.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("factures_client_date_idx").on(table.idClient, table.dateFacture),
    uniqueIndex("factures_vente_unique_idx").on(table.idVente),
  ],
);

export const lignesFacture = pgTable("lignes_facture", {
  id: serial("id").primaryKey(),
  idFacture: integer("id_facture")
    .notNull()
    .references(() => factures.id, { onDelete: "cascade" }),
  idProduit: integer("id_produit").references(() => produits.id, { onDelete: "set null" }),
  designation: varchar("designation", { length: 200 }).notNull(),
  quantite: integer("quantite").notNull(),
  prixUnitaire: money("prix_unitaire").notNull(),
  montantTotal: money("montant_total").notNull(),
});

export const paiements = pgTable("paiements", {
  id: serial("id").primaryKey(),
  reference: varchar("reference", { length: 50 }).notNull().unique(),
  idFacture: integer("id_facture")
    .notNull()
    .references(() => factures.id, { onDelete: "restrict" }),
  montant: money("montant").notNull(),
  modePaiement: varchar("mode_paiement", { length: 30 }).notNull(),
  datePaiement: timestamp("date_paiement").defaultNow().notNull(),
  notes: text("notes"),
  idPaiementAnnule: integer("id_paiement_annule").references((): AnyPgColumn => paiements.id, {
    onDelete: "set null",
  }),
  idUtilisateur: integer("id_utilisateur").references(() => utilisateursTable.id, {
    onDelete: "set null",
  }),
});

export const retoursVente = pgTable("retours_vente", {
  id: serial("id").primaryKey(),
  reference: varchar("reference", { length: 50 }).notNull().unique(),
  idVente: integer("id_vente")
    .notNull()
    .references(() => ventes.id, { onDelete: "restrict" }),
  statut: varchar("statut", { length: 30 }).notNull().default("en_attente"),
  motif: text("motif"),
  montantRembourse: money("montant_rembourse").notNull().default("0"),
  dateRetour: timestamp("date_retour").defaultNow().notNull(),
  idUtilisateur: integer("id_utilisateur").references(() => utilisateursTable.id, {
    onDelete: "set null",
  }),
});

export const lignesRetourVente = pgTable("lignes_retour_vente", {
  id: serial("id").primaryKey(),
  idRetour: integer("id_retour")
    .notNull()
    .references(() => retoursVente.id, { onDelete: "cascade" }),
  idLigneVente: integer("id_ligne_vente")
    .notNull()
    .references(() => lignesVente.id, { onDelete: "restrict" }),
  quantite: integer("quantite").notNull(),
  montant: money("montant").notNull(),
});

export const inventaires = pgTable("inventaires", {
  id: serial("id").primaryKey(),
  reference: varchar("reference", { length: 50 }).notNull().unique(),
  statut: varchar("statut", { length: 30 }).notNull().default("en_cours"),
  dateInventaire: timestamp("date_inventaire").defaultNow().notNull(),
  notes: text("notes"),
  responsable: varchar("responsable", { length: 150 }),
  idUtilisateur: integer("id_utilisateur").references(() => utilisateursTable.id, {
    onDelete: "set null",
  }),
  createdAt: createdAt(),
});

export const lignesInventaire = pgTable("lignes_inventaire", {
  id: serial("id").primaryKey(),
  idInventaire: integer("id_inventaire")
    .notNull()
    .references(() => inventaires.id, { onDelete: "cascade" }),
  idProduit: integer("id_produit")
    .notNull()
    .references(() => produits.id, { onDelete: "restrict" }),
  quantiteTheorique: integer("quantite_theorique").notNull(),
  quantiteComptee: integer("quantite_comptee"),
  ecart: integer("ecart"),
});

export const parametresBoutique = pgTable("parametres_boutique", {
  id: serial("id").primaryKey(),
  nom: varchar("nom", { length: 150 }).notNull(),
  adresse: text("adresse"),
  telephone: varchar("telephone", { length: 50 }),
  email: varchar("email", { length: 150 }),
  nif: varchar("nif", { length: 100 }),
  devise: varchar("devise", { length: 10 }).notNull().default("XOF"),
  tauxTaxe: decimal("taux_taxe", { precision: 5, scale: 2 }).notNull().default("0"),
  prefixeFacture: varchar("prefixe_facture", { length: 10 }).notNull().default("FAC"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tokensReinitialisation = pgTable(
  "tokens_reinitialisation",
  {
    id: serial("id").primaryKey(),
    idUtilisateur: integer("id_utilisateur")
      .notNull()
      .references(() => utilisateursTable.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
    expireLe: timestamp("expire_le").notNull(),
    utiliseLe: timestamp("utilise_le"),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("tokens_reinitialisation_user_idx").on(table.idUtilisateur)],
);

export const journalActivite = pgTable("journal_activite", {
  id: serial("id").primaryKey(),
  idUtilisateur: integer("id_utilisateur").references(() => utilisateursTable.id, {
    onDelete: "set null",
  }),
  action: varchar("action", { length: 100 }).notNull(),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
});
