import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import pg from 'pg';
import { PostgresAdapter } from './postgres.js';
import { runPostgresMigrations } from './migrations/index.js';

const { Pool } = pg;

export interface MigrationSummary {
  table: string;
  sqliteCount: number;
  postgresCount: number;
  matched: boolean;
}

export async function migrateSqliteToPostgres(options?: {
  sqlitePath?: string;
  postgresUrl?: string;
}): Promise<{
  success: boolean;
  summaries: MigrationSummary[];
  totalMigratedRows: number;
}> {
  const sqlitePath =
    options?.sqlitePath ||
    (fs.existsSync(path.join(process.cwd(), 'data', 'aegis_finance.sqlite'))
      ? path.join(process.cwd(), 'data', 'aegis_finance.sqlite')
      : path.join(process.cwd(), 'aegis_finance.sqlite'));

  const postgresUrl = options?.postgresUrl || process.env.DATABASE_URL;

  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`[DataMigration] SQLite database file not found at: ${sqlitePath}`);
  }

  if (!postgresUrl) {
    throw new Error(`[DataMigration] PostgreSQL URL not provided or configured in DATABASE_URL.`);
  }

  console.log(`\n================================================================`);
  console.log(`  AEGISFINANCE SQLITE -> POSTGRESQL DATA MIGRATION ENGINE`);
  console.log(`  Source: ${sqlitePath}`);
  console.log(`  Target: ${postgresUrl.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`================================================================\n`);

  // 1. Load SQLite Database
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(sqlitePath);
  const sqliteDb = new SQL.Database(fileBuffer);

  // 2. Connect to PostgreSQL
  const isLocalhost = postgresUrl.includes('localhost') || postgresUrl.includes('127.0.0.1');
  const pool = new Pool({
    connectionString: postgresUrl,
    ssl: !isLocalhost || postgresUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  });

  const pgClient = await pool.connect();
  const summaries: MigrationSummary[] = [];
  let totalMigratedRows = 0;

  try {
    // Run schema migrations on PostgreSQL first
    await runPostgresMigrations(pgClient);

    // List of tables ordered by foreign key dependencies
    const tablesInOrder = [
      'users',
      'profiles',
      'sessions',
      'accounts',
      'transactions',
      'budgets',
      'goals',
      'goal_contributions',
      'bills',
      'subscriptions',
      'loans',
      'receipts',
      'notifications',
      'audit_events',
      'ai_category_feedback',
      'ai_anomaly_feedback',
      'ai_recommendation_history',
      'email_verification_tokens',
      'password_reset_tokens',
      'kyc_records',
    ];

    await pgClient.query('BEGIN;');

    for (const table of tablesInOrder) {
      // Check if table exists in SQLite
      const checkStmt = sqliteDb.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?;`);
      checkStmt.bind([table]);
      const existsInSqlite = checkStmt.step();
      checkStmt.free();

      if (!existsInSqlite) {
        continue;
      }

      // Read rows from SQLite
      const selectStmt = sqliteDb.prepare(`SELECT * FROM ${table};`);
      const rows: any[] = [];
      while (selectStmt.step()) {
        rows.push(selectStmt.getAsObject());
      }
      selectStmt.free();

      const sqliteCount = rows.length;

      if (sqliteCount > 0) {
        const columns = Object.keys(rows[0]);
        const colNames = columns.join(', ');
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

        const conflictTarget = table === 'profiles' || table === 'kyc_records' ? 'user_id' : table.includes('tokens') ? 'token' : 'id';

        const updateSet = columns
          .filter(c => c !== conflictTarget)
          .map(c => `${c} = EXCLUDED.${c}`)
          .join(', ');

        const upsertSql = updateSet.length > 0
          ? `INSERT INTO ${table} (${colNames}) VALUES (${placeholders}) ON CONFLICT (${conflictTarget}) DO UPDATE SET ${updateSet};`
          : `INSERT INTO ${table} (${colNames}) VALUES (${placeholders}) ON CONFLICT (${conflictTarget}) DO NOTHING;`;

        for (const row of rows) {
          const values = columns.map(c => {
            const v = row[c];
            return v === undefined ? null : v;
          });
          await pgClient.query(upsertSql, values);
        }
      }

      // Count in PostgreSQL
      const pgCountRes = await pgClient.query(`SELECT COUNT(*) as count FROM ${table};`);
      const pgCount = parseInt(pgCountRes.rows[0].count, 10);

      const matched = sqliteCount <= pgCount;
      summaries.push({
        table,
        sqliteCount,
        postgresCount: pgCount,
        matched,
      });

      totalMigratedRows += sqliteCount;
      console.log(`  • Table '${table}': SQLite (${sqliteCount} rows) -> PostgreSQL (${pgCount} rows) ${matched ? '✓' : '✗'}`);
    }

    await pgClient.query('COMMIT;');
    console.log(`\n✓ Data migration completed successfully: ${totalMigratedRows} rows migrated.`);

    return {
      success: true,
      summaries,
      totalMigratedRows,
    };
  } catch (err) {
    await pgClient.query('ROLLBACK;');
    console.error('[DataMigration] Migration failed, transaction rolled back:', err);
    throw err;
  } finally {
    pgClient.release();
    sqliteDb.close();
    await pool.end();
  }
}

// Allow CLI execution: tsx server/db/migrateSqliteToPg.ts
if (process.argv[1]?.includes('migrateSqliteToPg')) {
  migrateSqliteToPostgres()
    .then(result => {
      console.log(`\nMigration Summary:`, result.summaries);
      process.exit(0);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
