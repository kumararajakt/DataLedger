import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { pool } from './pool';

async function migrate(): Promise<void> {
  const migrationsDir = path.join(__dirname, 'migrations');

  // Read all SQL files and sort them by filename
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migration files found.');
    await pool.end();
    return;
  }

  console.log(`Found ${files.length} migration file(s). Running migrations...`);

  const client = await pool.connect();

  try {
    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      console.log(`Running migration: ${file}`);

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log(`  ✓ ${file} completed successfully`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ✗ ${file} failed:`, err);
        throw err;
      }
    }

    console.log('\nAll migrations completed successfully.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
