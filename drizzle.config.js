import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
    out: './drizzle',
    schema: './src/db/schema.ts',
    dialect: 'postgresql',
    dbCredentials: {
        url: 'postgresql://postgres:admin@127.0.0.1:5432/boutique',
    },
});
