import type { VercelRequest, VercelResponse } from '@vercel/node';
import app, { initDb } from '../server.js';

let initPromise: Promise<void> | null = null;

async function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = initDb().catch((err) => {
      initPromise = null; // Reset promise so subsequent invocations safely retry
      throw err;
    });
  }
  return initPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await ensureInitialized();
  } catch (err: any) {
    console.error('[Vercel Serverless] Durable Database Initialization Failed:', err);
    res.setHeader('Content-Type', 'application/json');
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Persistent database initialization failed. Please ensure DATABASE_URL is configured and reachable.',
      code: 'DATABASE_INITIALIZATION_FAILED',
      timestamp: new Date().toISOString(),
    });
  }

  // Restore the real incoming request URL from Vercel's rewrite metadata
  const originalUrl =
    (req.headers['x-matched-path'] as string) ||
    (req.headers['x-vercel-matched-path'] as string) ||
    (req.headers['x-forwarded-uri'] as string) ||
    (req.query?.__path ? `/api/${req.query.__path}` : '') ||
    req.url;

  if (originalUrl && (req.url === '/api/index' || req.url === '/api' || req.url?.startsWith('/api/index?'))) {
    req.url = originalUrl;
  }

  return app(req as any, res as any);
}
