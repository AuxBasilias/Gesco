import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const queryClient = postgres('postgresql://postgres:admin@127.0.0.1:5432/boutique');

export const db = drizzle(queryClient, { schema });