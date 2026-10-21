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
  // 1. Ensure durable database is connected & migrated
  try {
    await ensureInitialized();
  } catch (err: any) {
    console.error('[Vercel Serverless] Durable Database Initialization Failed:', err?.message || err);
    res.setHeader('Content-Type', 'application/json');
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Persistent database initialization failed. Please ensure DATABASE_URL is configured and reachable in Vercel settings.',
      code: 'DATABASE_INITIALIZATION_FAILED',
      timestamp: new Date().toISOString(),
    });
  }

  // 2. Mark req._body = true if @vercel/node already parsed the request body
  if (req.body && typeof req.body === 'object') {
    (req as any)._body = true;
  } else if (typeof req.body === 'string' && req.body.trim().startsWith('{')) {
    try {
      req.body = JSON.parse(req.body);
      (req as any)._body = true;
    } catch {}
  }

  // 3. Accurately reconstruct the incoming request URL from Vercel rewrite metadata
  let targetUrl = req.url || '/';

  if (req.query && req.query.__path) {
    const rawPath = Array.isArray(req.query.__path) ? req.query.__path.join('/') : req.query.__path;
    const cleanPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    targetUrl = cleanPath.startsWith('/api') ? cleanPath : `/api${cleanPath}`;

    // Preserve any other query parameters while removing internal __path
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      parsedUrl.searchParams.delete('__path');
      const search = parsedUrl.searchParams.toString();
      if (search) {
        targetUrl += `?${search}`;
      }
    } catch {}
  } else if (req.headers['x-forwarded-uri'] && typeof req.headers['x-forwarded-uri'] === 'string') {
    const forwardedUri = req.headers['x-forwarded-uri'];
    if (forwardedUri !== '/api/index' && !forwardedUri.startsWith('/api/index?')) {
      targetUrl = forwardedUri;
    }
  } else if (req.headers['x-vercel-matched-path'] && typeof req.headers['x-vercel-matched-path'] === 'string') {
    const matchedPath = req.headers['x-vercel-matched-path'];
    if (matchedPath !== '/api/index' && !matchedPath.startsWith('/api/index?')) {
      targetUrl = matchedPath;
    }
  }

  req.url = targetUrl;

  // 4. Delegate to Express app
  try {
    return app(req as any, res as any);
  } catch (handlerErr: any) {
    console.error('[Vercel Serverless] Unhandled Handler Exception:', handlerErr?.message || handlerErr);
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({
        error: 'An internal server error occurred while processing the request.',
        code: 'INTERNAL_SERVER_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }
}

