import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Configure postgres client with connection pooling to prevent "too many clients" error
// Use transaction mode pooler (port 6543) for better connection management
export const client = postgres(process.env.DATABASE_URL, {
  max: 10, // Maximum number of connections in the pool (reduced from default)
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout in seconds
  prepare: false, // Disable prepared statements for transaction pooler compatibility
});

export const db = drizzle(client, { schema });
