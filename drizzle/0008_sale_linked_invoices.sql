ALTER TABLE factures
  ALTER COLUMN id_client DROP NOT NULL;

CREATE UNIQUE INDEX factures_vente_unique_idx
  ON factures (id_vente);
