ALTER TABLE "stocks"
  ADD COLUMN IF NOT EXISTS "quantite" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT now();

UPDATE "stocks"
SET "quantite" = "initial"
WHERE "quantite" = 0 AND "initial" > 0;