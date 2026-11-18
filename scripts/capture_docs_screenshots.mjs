import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'docs', 'screenshots');
fs.mkdirSync(outDir, { recursive: true });

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = path.join('/tmp', 'docs-chrome-' + Date.now());
fs.mkdirSync(profile, { recursive: true });
const portFile = path.join(profile, 'DevToolsActivePort');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('--- Starting local server on port 4000 in DEMO mode ---');
  const serverProcess = spawn('npx', ['tsx', 'server.ts'], {
    cwd: rootDir,
    env: { ...process.env, PORT: '4000', NODE_ENV: 'development', DEMO_MODE: 'true' },
    stdio: 'ignore'
  });

  let serverUp = false;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    try {
      const res = await fetch('http://127.0.0.1:4000/api/health');
      if (res.ok) {
        serverUp = true;
        break;
      }
    } catch {}
  }
  if (!serverUp) {
    serverProcess.kill();
    throw new Error('Local server failed to start on port 4000');
  }
  console.log('✓ Server listening on http://127.0.0.1:4000');

  console.log('--- Launching Headless Chrome ---');
  const chromeProcess = spawn(chromePath, [
    '--headless=new',
    `--user-data-dir=${profile}`,
    '--remote-debugging-port=0',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--window-size=1440,900',
    'about:blank'
  ], { stdio: 'ignore' });

  let port = null;
  for (let i = 0; i < 100 && !port; i++) {
    await sleep(100);
    try { port = parseInt(fs.readFileSync(portFile, 'utf8'), 10) || null; } catch {}
  }
  if (!port) {
    chromeProcess.kill();
    serverProcess.kill();
    throw new Error('Chrome remote debugging port not found');
  }

  const ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });

  let id = 0;
  const pend = new Map();
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  });

  const send = (method, params = {}, sessionId) => new Promise(r => {
    const i = ++id;
    pend.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params, sessionId }));
  });

  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
  const S = async (m, p) => (await send(m, p, sessionId)).result;
  const ev = async x => (await S('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }))?.result?.value;

  await S('Page.enable');
  await S('Runtime.enable');
  await S('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  console.log('Navigating to http://127.0.0.1:4000 to authenticate demo session...');
  await S('Page.navigate', { url: 'http://127.0.0.1:4000/' });
  await sleep(3000);

  // Authenticate Demo session
  const demoToken = await ev(`
    fetch('/api/auth/demo-session', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      .then(r => r.json())
      .then(d => {
        if (d.token) {
          localStorage.setItem('fintech_session_token', d.token);
          return d.token;
        }
        return null;
      })
  `);
  console.log('Demo session token authenticated:', demoToken ? 'YES' : 'NO');

  // Reload into authenticated app
  await S('Page.navigate', { url: 'http://127.0.0.1:4000/' });
  await sleep(3000);

  // Helper to click sidebar nav items by text
  const navigateTab = async (label) => {
    await ev(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button, a'));
        const target = btns.find(b => b.innerText && b.innerText.toLowerCase().includes('${label}'.toLowerCase()));
        if (target) {
          target.click();
          return true;
        }
        return false;
      })()
    `);
    await sleep(2000);
  };

  // 1. Dashboard
  console.log('Capturing dashboard.png...');
  await navigateTab('dashboard');
  const shotDash = await S('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(outDir, 'dashboard.png'), Buffer.from(shotDash.data, 'base64'));
  console.log('✓ Saved dashboard.png');

  // 2. Transactions
  console.log('Capturing transactions.png...');
  await navigateTab('transactions');
  const shotTx = await S('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(outDir, 'transactions.png'), Buffer.from(shotTx.data, 'base64'));
  console.log('✓ Saved transactions.png');

  // 3. Budgets & Goals
  console.log('Capturing budgets-goals.png...');
  await navigateTab('budgets');
  const shotBudgets = await S('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(outDir, 'budgets-goals.png'), Buffer.from(shotBudgets.data, 'base64'));
  console.log('✓ Saved budgets-goals.png');

  // 4. AI Insights
  console.log('Capturing ai-insights.png...');
  await navigateTab('advisor');
  const shotInsights = await S('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(outDir, 'ai-insights.png'), Buffer.from(shotInsights.data, 'base64'));
  console.log('✓ Saved ai-insights.png');

  // 5. Blockchain Audit Ledger
  console.log('Capturing audit-ledger.png...');
  await navigateTab('blockchain');
  const shotAudit = await S('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(outDir, 'audit-ledger.png'), Buffer.from(shotAudit.data, 'base64'));
  console.log('✓ Saved audit-ledger.png');

  // 6. Mobile View (390 x 844 iPhone)
  console.log('Capturing mobile-view.png...');
  await S('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await navigateTab('dashboard');
  const shotMobile = await S('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(outDir, 'mobile-view.png'), Buffer.from(shotMobile.data, 'base64'));
  console.log('✓ Saved mobile-view.png');

  // Cleanup
  chromeProcess.kill();
  serverProcess.kill();
  console.log('\n--- All 6 screenshots captured and verified successfully ---');
  process.exit(0);
}

main().catch(err => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
