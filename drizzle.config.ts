import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "DATABASE_URL est absent : vérifiez le fichier .env ou les variables d'environnement (src/db/db.ts)."
  );
}
export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: url,
  },
});