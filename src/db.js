// Connection to the hosted PostgreSQL database (Supabase).
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing. Copy .env.example to .env and add your Supabase connection string.');
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase requires an encrypted connection.
  ssl: { rejectUnauthorized: false },
  max: 5,
});

export function query(text, params) {
  return pool.query(text, params);
}

/** Runs fn inside a transaction, rolling back on any error. */
export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
