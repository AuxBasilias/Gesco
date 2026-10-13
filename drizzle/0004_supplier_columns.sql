ALTER TABLE "fournisseurs"
  ADD COLUMN IF NOT EXISTS "nif" varchar(100),
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT now();