import "dotenv/config";
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
const url = process.env.DATABASE_URL;
if (!url) {
    throw new Error("DATABASE_URL est absent : vérifiez le fichier .env ou les variables d'environnement (src/db/db.ts).");
}
const queryClient = postgres(url, { max: 10, idle_timeout: 20 });
export const db = drizzle(queryClient, { schema });
/** Ferme proprement le pool de connexions (scripts, tests, arrêt du serveur). */
export const closeDb = async () => {
    await queryClient.end({ timeout: 5 });
};
