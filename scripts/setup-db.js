// Creates the tables in the Supabase database. Safe to run more than once.
import { readFile } from 'node:fs/promises';
import { pool } from '../src/db.js';

const sql = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');

try {
  await pool.query(sql);
  const { rows } = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name IN ('startups','founders','blockers','stories')
     ORDER BY table_name`
  );
  console.log('Tables ready:', rows.map((r) => r.table_name).join(', '));
} finally {
  await pool.end();
}
