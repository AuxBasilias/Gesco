CREATE TABLE IF NOT EXISTS "categories" (
  "id" serial PRIMARY KEY NOT NULL,
  "label" varchar(100) NOT NULL UNIQUE,
  "created_at" timestamp DEFAULT now() NOT NULL
);

INSERT INTO "categories" ("label")
VALUES ('Non classé')
ON CONFLICT ("label") DO NOTHING;

ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "type" varchar(50) NOT NULL DEFAULT 'particulier',
  ADD COLUMN IF NOT EXISTS "ville" varchar(100),
  ADD COLUMN IF NOT EXISTS "tel" varchar(50),
  ADD COLUMN IF NOT EXISTS "nif" varchar(100),
  ADD COLUMN IF NOT EXISTS "limite_credit" numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "delai_paiement" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "total_achats" numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "solde_du" numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "dernier_achat" timestamp,
  ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'phone'
  ) THEN
    UPDATE "clients" SET "tel" = "phone" WHERE "tel" IS NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clients_nom_unique' AND conrelid = 'clients'::regclass
  ) THEN
    ALTER TABLE "clients" DROP CONSTRAINT "clients_nom_unique";
  END IF;
END $$;

ALTER TABLE "utilisateurs"
  ADD COLUMN IF NOT EXISTS "telephone" varchar(50),
  ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'produits' AND column_name = 'nom'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'produits' AND column_name = 'designation'
  ) THEN
    ALTER TABLE "produits" RENAME COLUMN "nom" TO "designation";
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'produits' AND column_name = 'prix_unitaire'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'produits' AND column_name = 'prix_vente'
  ) THEN
    ALTER TABLE "produits" RENAME COLUMN "prix_unitaire" TO "prix_vente";
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'produits' AND column_name = 'image'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'produits' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE "produits" RENAME COLUMN "image" TO "image_url";
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'produits' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE "produits" ADD COLUMN "image_url" text;
  END IF;
END $$;

ALTER TABLE "produits"
  ALTER COLUMN "description" DROP NOT NULL,
  ALTER COLUMN "prix_vente" TYPE numeric(14, 2) USING "prix_vente"::numeric(14, 2),
  ADD COLUMN IF NOT EXISTS "numero_serie" varchar(100),
  ADD COLUMN IF NOT EXISTS "id_categorie" integer,
  ADD COLUMN IF NOT EXISTS "code_barres" varchar(100),
  ADD COLUMN IF NOT EXISTS "prix_achat" numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "image_blob" bytea,
  ADD COLUMN IF NOT EXISTS "garantie" text,
  ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT now();

UPDATE "produits"
SET "id_categorie" = (SELECT "id" FROM "categories" WHERE "label" = 'Non classé')
WHERE "id_categorie" IS NULL;

ALTER TABLE "produits"
  ALTER COLUMN "id_categorie" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'produits_id_categorie_categories_id_fk'
  ) THEN
    ALTER TABLE "produits"
      ADD CONSTRAINT "produits_id_categorie_categories_id_fk"
      FOREIGN KEY ("id_categorie") REFERENCES "categories"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "produits_numero_serie_unique" ON "produits" ("numero_serie");
CREATE UNIQUE INDEX IF NOT EXISTS "produits_code_barres_unique" ON "produits" ("code_barres");

CREATE TABLE IF NOT EXISTS "fournisseurs" (
  "id" serial PRIMARY KEY NOT NULL,
  "nom" varchar(150) NOT NULL,
  "tel" varchar(30),
  "email" varchar(150),
  "adresse" text,
  "nif" varchar(100),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "fournisseurs"
  ADD COLUMN IF NOT EXISTS "nif" varchar(100),
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS "stocks" (
  "id" serial PRIMARY KEY NOT NULL,
  "id_produit" integer NOT NULL UNIQUE REFERENCES "produits"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "initial" integer NOT NULL DEFAULT 0,
  "quantite" integer NOT NULL DEFAULT 0,
  "seuil_minimum" integer NOT NULL DEFAULT 0,
  "id_fournisseur" integer REFERENCES "fournisseurs"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "commandes_fournisseurs" (
  "id" serial PRIMARY KEY NOT NULL,
  "reference" varchar(50) NOT NULL UNIQUE,
  "id_fournisseur" integer NOT NULL REFERENCES "fournisseurs"("id") ON DELETE RESTRICT,
  "statut" varchar(30) NOT NULL DEFAULT 'brouillon',
  "date_commande" timestamp NOT NULL DEFAULT now(),
  "date_livraison_prevue" timestamp,
  "montant_ht" numeric(14, 2) NOT NULL DEFAULT 0,
  "montant_taxe" numeric(14, 2) NOT NULL DEFAULT 0,
  "montant_total" numeric(14, 2) NOT NULL DEFAULT 0,
  "notes" text,
  "id_utilisateur" integer REFERENCES "utilisateurs"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "lignes_commande" (
  "id" serial PRIMARY KEY NOT NULL,
  "id_commande" integer NOT NULL REFERENCES "commandes_fournisseurs"("id") ON DELETE CASCADE,
  "id_produit" integer NOT NULL REFERENCES "produits"("id") ON DELETE RESTRICT,
  "designation" varchar(200) NOT NULL,
  "quantite" integer NOT NULL CHECK ("quantite" > 0),
  "quantite_recue" integer NOT NULL DEFAULT 0 CHECK ("quantite_recue" >= 0),
  "prix_unitaire" numeric(14, 2) NOT NULL,
  "montant_total" numeric(14, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS "receptions" (
  "id" serial PRIMARY KEY NOT NULL,
  "reference" varchar(50) NOT NULL UNIQUE,
  "id_commande" integer NOT NULL REFERENCES "commandes_fournisseurs"("id") ON DELETE RESTRICT,
  "date_reception" timestamp NOT NULL DEFAULT now(),
  "statut" varchar(30) NOT NULL DEFAULT 'confirmee',
  "notes" text,
  "id_utilisateur" integer REFERENCES "utilisateurs"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "lignes_reception" (
  "id" serial PRIMARY KEY NOT NULL,
  "id_reception" integer NOT NULL REFERENCES "receptions"("id") ON DELETE CASCADE,
  "id_ligne_commande" integer NOT NULL REFERENCES "lignes_commande"("id") ON DELETE RESTRICT,
  "quantite_recue" integer NOT NULL CHECK ("quantite_recue" > 0)
);

CREATE TABLE IF NOT EXISTS "sessions_caisse" (
  "id" serial PRIMARY KEY NOT NULL,
  "reference" varchar(50) NOT NULL UNIQUE,
  "statut" varchar(20) NOT NULL DEFAULT 'ouverte',
  "date_ouverture" timestamp NOT NULL DEFAULT now(),
  "date_fermeture" timestamp,
  "fond_ouverture" numeric(14, 2) NOT NULL DEFAULT 0,
  "montant_attendu" numeric(14, 2) NOT NULL DEFAULT 0,
  "montant_compte" numeric(14, 2),
  "ecart" numeric(14, 2),
  "id_utilisateur" integer NOT NULL REFERENCES "utilisateurs"("id") ON DELETE RESTRICT,
  "notes" text
);

CREATE INDEX IF NOT EXISTS "sessions_caisse_statut_idx" ON "sessions_caisse" ("statut");

CREATE TABLE IF NOT EXISTS "ventes" (
  "id" serial PRIMARY KEY NOT NULL,
  "reference" varchar(50) NOT NULL UNIQUE,
  "id_client" integer REFERENCES "clients"("id") ON DELETE SET NULL,
  "id_session_caisse" integer REFERENCES "sessions_caisse"("id") ON DELETE SET NULL,
  "statut" varchar(30) NOT NULL DEFAULT 'payee',
  "date_vente" timestamp NOT NULL DEFAULT now(),
  "montant_ht" numeric(14, 2) NOT NULL DEFAULT 0,
  "montant_taxe" numeric(14, 2) NOT NULL DEFAULT 0,
  "montant_total" numeric(14, 2) NOT NULL,
  "montant_paye" numeric(14, 2) NOT NULL DEFAULT 0,
  "mode_paiement" varchar(30),
  "notes" text,
  "id_utilisateur" integer REFERENCES "utilisateurs"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ventes_date_idx" ON "ventes" ("date_vente");

CREATE TABLE IF NOT EXISTS "lignes_vente" (
  "id" serial PRIMARY KEY NOT NULL,
  "id_vente" integer NOT NULL REFERENCES "ventes"("id") ON DELETE CASCADE,
  "id_produit" integer NOT NULL REFERENCES "produits"("id") ON DELETE RESTRICT,
  "designation" varchar(200) NOT NULL,
  "quantite" integer NOT NULL CHECK ("quantite" > 0),
  "prix_unitaire" numeric(14, 2) NOT NULL,
  "remise" numeric(14, 2) NOT NULL DEFAULT 0,
  "montant_total" numeric(14, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS "factures" (
  "id" serial PRIMARY KEY NOT NULL,
  "reference" varchar(50) NOT NULL UNIQUE,
  "id_client" integer NOT NULL REFERENCES "clients"("id") ON DELETE RESTRICT,
  "id_vente" integer REFERENCES "ventes"("id") ON DELETE SET NULL,
  "statut" varchar(30) NOT NULL DEFAULT 'brouillon',
  "date_facture" timestamp NOT NULL DEFAULT now(),
  "date_echeance" timestamp,
  "montant_ht" numeric(14, 2) NOT NULL DEFAULT 0,
  "montant_taxe" numeric(14, 2) NOT NULL DEFAULT 0,
  "montant_total" numeric(14, 2) NOT NULL DEFAULT 0,
  "montant_paye" numeric(14, 2) NOT NULL DEFAULT 0,
  "donnees_document" jsonb NOT NULL DEFAULT '{}',
  "notes" text,
  "id_utilisateur" integer REFERENCES "utilisateurs"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "factures_client_date_idx" ON "factures" ("id_client", "date_facture");

CREATE TABLE IF NOT EXISTS "lignes_facture" (
  "id" serial PRIMARY KEY NOT NULL,
  "id_facture" integer NOT NULL REFERENCES "factures"("id") ON DELETE CASCADE,
  "id_produit" integer REFERENCES "produits"("id") ON DELETE SET NULL,
  "designation" varchar(200) NOT NULL,
  "quantite" integer NOT NULL CHECK ("quantite" > 0),
  "prix_unitaire" numeric(14, 2) NOT NULL,
  "montant_total" numeric(14, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS "paiements" (
  "id" serial PRIMARY KEY NOT NULL,
  "reference" varchar(50) NOT NULL UNIQUE,
  "id_facture" integer NOT NULL REFERENCES "factures"("id") ON DELETE RESTRICT,
  "montant" numeric(14, 2) NOT NULL CHECK ("montant" > 0),
  "mode_paiement" varchar(30) NOT NULL,
  "date_paiement" timestamp NOT NULL DEFAULT now(),
  "notes" text,
  "id_utilisateur" integer REFERENCES "utilisateurs"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "operations_caisse" (
  "id" serial PRIMARY KEY NOT NULL,
  "id_session_caisse" integer NOT NULL REFERENCES "sessions_caisse"("id") ON DELETE RESTRICT,
  "id_vente" integer REFERENCES "ventes"("id") ON DELETE SET NULL,
  "type" varchar(30) NOT NULL,
  "mode_paiement" varchar(30) NOT NULL,
  "montant" numeric(14, 2) NOT NULL,
  "motif" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "id_utilisateur" integer REFERENCES "utilisateurs"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "retours_vente" (
  "id" serial PRIMARY KEY NOT NULL,
  "reference" varchar(50) NOT NULL UNIQUE,
  "id_vente" integer NOT NULL REFERENCES "ventes"("id") ON DELETE RESTRICT,
  "statut" varchar(30) NOT NULL DEFAULT 'confirme',
  "motif" text,
  "montant_rembourse" numeric(14, 2) NOT NULL DEFAULT 0,
  "date_retour" timestamp NOT NULL DEFAULT now(),
  "id_utilisateur" integer REFERENCES "utilisateurs"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "lignes_retour_vente" (
  "id" serial PRIMARY KEY NOT NULL,
  "id_retour" integer NOT NULL REFERENCES "retours_vente"("id") ON DELETE CASCADE,
  "id_ligne_vente" integer NOT NULL REFERENCES "lignes_vente"("id") ON DELETE RESTRICT,
  "quantite" integer NOT NULL CHECK ("quantite" > 0),
  "montant" numeric(14, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS "mouvements_stock" (
  "id" serial PRIMARY KEY NOT NULL,
  "id_produit" integer NOT NULL REFERENCES "produits"("id") ON DELETE RESTRICT,
  "type" varchar(30) NOT NULL,
  "quantite" integer NOT NULL,
  "reference" varchar(100),
  "motif" text,
  "id_utilisateur" integer REFERENCES "utilisateurs"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "mouvements_stock_produit_date_idx" ON "mouvements_stock" ("id_produit", "created_at");

CREATE TABLE IF NOT EXISTS "inventaires" (
  "id" serial PRIMARY KEY NOT NULL,
  "reference" varchar(50) NOT NULL UNIQUE,
  "statut" varchar(30) NOT NULL DEFAULT 'en_cours',
  "date_inventaire" timestamp NOT NULL DEFAULT now(),
  "notes" text,
  "id_utilisateur" integer REFERENCES "utilisateurs"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "lignes_inventaire" (
  "id" serial PRIMARY KEY NOT NULL,
  "id_inventaire" integer NOT NULL REFERENCES "inventaires"("id") ON DELETE CASCADE,
  "id_produit" integer NOT NULL REFERENCES "produits"("id") ON DELETE RESTRICT,
  "quantite_theorique" integer NOT NULL,
  "quantite_comptee" integer,
  "ecart" integer
);

CREATE TABLE IF NOT EXISTS "parametres_boutique" (
  "id" serial PRIMARY KEY NOT NULL,
  "nom" varchar(150) NOT NULL,
  "adresse" text,
  "telephone" varchar(50),
  "email" varchar(150),
  "nif" varchar(100),
  "devise" varchar(10) NOT NULL DEFAULT 'XOF',
  "taux_taxe" numeric(5, 2) NOT NULL DEFAULT 0,
  "prefixe_facture" varchar(10) NOT NULL DEFAULT 'FAC',
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "tokens_reinitialisation" (
  "id" serial PRIMARY KEY NOT NULL,
  "id_utilisateur" integer NOT NULL UNIQUE REFERENCES "utilisateurs"("id") ON DELETE CASCADE,
  "token_hash" varchar(128) NOT NULL UNIQUE,
  "expire_le" timestamp NOT NULL,
  "utilise_le" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "journal_activite" (
  "id" serial PRIMARY KEY NOT NULL,
  "id_utilisateur" integer REFERENCES "utilisateurs"("id") ON DELETE SET NULL,
  "action" varchar(100) NOT NULL,
  "details" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamp NOT NULL DEFAULT now()
);