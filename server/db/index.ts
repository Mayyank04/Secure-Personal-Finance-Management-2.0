import { IDatabaseAdapter } from './types.js';
import { PostgresAdapter } from './postgres.js';
import { SqliteAdapter } from './sqlite.js';

let activeAdapter: IDatabaseAdapter | null = null;

export function resolveDatabaseProvider(): 'postgresql' | 'sqlite' {
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (dbUrl && (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'))) {
    return 'postgresql';
  }
  return 'sqlite';
}

export function createDatabaseAdapter(overrideProvider?: 'postgresql' | 'sqlite', connectionString?: string): IDatabaseAdapter {
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  const provider = overrideProvider || resolveDatabaseProvider();

  if (isProd && !overrideProvider) {
    const url = connectionString || process.env.DATABASE_URL?.trim();
    if (!url || (!url.startsWith('postgres://') && !url.startsWith('postgresql://'))) {
      throw new Error(
        '[PRODUCTION ERROR] Production deployment on Vercel requires a valid PostgreSQL DATABASE_URL. Ephemeral SQLite /tmp storage cannot be used in production serverless environments.'
      );
    }
    return new PostgresAdapter(url);
  }

  if (provider === 'postgresql') {
    const url = connectionString || process.env.DATABASE_URL;
    if (!url) {
      if (isProd) {
        throw new Error('[PRODUCTION ERROR] DATABASE_URL is required when provider is postgresql in production.');
      }
      console.warn('[DB Abstraction] PostgreSQL requested but DATABASE_URL not set. Falling back to SQLite.');
      return new SqliteAdapter();
    }
    return new PostgresAdapter(url);
  }

  return new SqliteAdapter();
}

export function getDatabaseAdapter(): IDatabaseAdapter {
  if (!activeAdapter) {
    activeAdapter = createDatabaseAdapter();
  }
  return activeAdapter;
}

export function setDatabaseAdapter(adapter: IDatabaseAdapter): void {
  activeAdapter = adapter;
}

export async function initDatabase(): Promise<IDatabaseAdapter> {
  const adapter = getDatabaseAdapter();
  await adapter.init();
  return adapter;
}

export async function closeDatabase(): Promise<void> {
  if (activeAdapter) {
    await activeAdapter.close();
    activeAdapter = null;
  }
}

// Export singleton proxy
export const dbAdapter = new Proxy({} as IDatabaseAdapter, {
  get(_target, prop) {
    const adapter = getDatabaseAdapter();
    const value = (adapter as any)[prop];
    if (typeof value === 'function') {
      return value.bind(adapter);
    }
    return value;
  },
});

export * from './types.js';
export { PostgresAdapter } from './postgres.js';
export { SqliteAdapter } from './sqlite.js';
