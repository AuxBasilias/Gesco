ALTER TABLE "sessions_caisse"
  ALTER COLUMN "id_utilisateur" DROP NOT NULL;

ALTER TABLE "sessions_caisse"
  DROP CONSTRAINT IF EXISTS "sessions_caisse_id_utilisateur_utilisateurs_id_fk";

ALTER TABLE "sessions_caisse"
  ADD CONSTRAINT "sessions_caisse_id_utilisateur_utilisateurs_id_fk"
  FOREIGN KEY ("id_utilisateur") REFERENCES "utilisateurs"("id")
  ON DELETE SET NULL;
