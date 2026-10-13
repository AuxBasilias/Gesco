ALTER TABLE "ventes"
  ADD COLUMN "tva_appliquee" boolean NOT NULL DEFAULT true;

ALTER TABLE "factures"
  ADD COLUMN "tva_appliquee" boolean NOT NULL DEFAULT true;
