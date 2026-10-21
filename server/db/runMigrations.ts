import 'dotenv/config';
import pg from 'pg';
import { runPostgresMigrations, EMBEDDED_MIGRATIONS } from './migrations/index.js';

const { Pool } = pg;

async function main() {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL is not set in environment or .env file.');
    console.error('Please configure DATABASE_URL (e.g. postgresql://user:password@ep-...neon.tech/neondb?sslmode=require)');
    process.exit(1);
  }

  console.log('🚀 Running database migrations for AegisFinance...');
  console.log(`Target: ${connectionString.replace(/:[^:@]*@/, ':****@')}`);
  console.log(`Total available migration steps: ${EMBEDDED_MIGRATIONS.length}`);

  const isLocalhost =
    connectionString.includes('localhost') ||
    connectionString.includes('127.0.0.1') ||
    connectionString.includes('::1');

  const cleanConnectionString = connectionString
    .replace(/[?&]sslmode=[^&]+/g, '')
    .replace(/\?$/, '');

  const pool = new Pool({
    connectionString: cleanConnectionString,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  let client: pg.PoolClient | null = null;
  try {
    client = await pool.connect();
    console.log('✅ Connected to PostgreSQL database.');

    const result = await runPostgresMigrations(client);

    if (result.applied.length === 0) {
      console.log(`ℹ️ Schema is up to date. Current migration version: ${result.currentVersion}`);
    } else {
      console.log(`✅ Successfully applied ${result.applied.length} migration(s): ${result.applied.join(', ')}`);
      console.log(`Current migration version: ${result.currentVersion}`);
    }
  } catch (err: any) {
    console.error('❌ Migration failed:', err.message || err);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Fatal error running migrations:', err);
  process.exit(1);
});
