/**
 * Screenshot helper (dev tool, not a test). Uses the locally installed
 * Chrome — downloads nothing.
 *   node tools/shot.js            → talent screen, zh
 *   node tools/shot.js midlife    → mid-life log, zh
 *   node tools/shot.js summary en → summary, english
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME =
  process.env.CHROME_PATH ||
  [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].find((p) => existsSync(p));

const screen = process.argv[2] || 'talent';
const lang = process.argv[3] || 'zh';
const OUT = join(process.cwd(), 'tools', 'shots');
mkdirSync(OUT, { recursive: true });

const profile = mkdtempSync(join(tmpdir(), 'lrs-shot-'));
const PORT = 9600 + Math.floor(Math.random() * 200);
const browser = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-color-profile=srgb',
    '--window-size=1400,1000',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let wsUrl;
for (let i = 0; i < 100; i++) {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    const j = await r.json();
    if (j.webSocketDebuggerUrl) {
      wsUrl = j.webSocketDebuggerUrl;
      break;
    }
  } catch {}
  await sleep(100);
}

const ws = new WebSocket(wsUrl);
let id = 0;
const pend = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) {
    const p = pend.get(m.id);
    pend.delete(m.id);
    m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
  }
});
await new Promise((r) => ws.addEventListener('open', r));
const send = (method, params = {}, sessionId) =>
  new Promise((res, rej) => {
    const i = ++id;
    pend.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params, sessionId }));
  });

const { targetInfos } = await send('Target.getTargets');
const { sessionId } = await send('Target.attachToTarget', {
  targetId: targetInfos.find((t) => t.type === 'page').targetId,
  flatten: true,
});
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description);
  return r.result.value;
};

await send('Emulation.setDeviceMetricsOverride', {
  width: 1400,
  height: 1000,
  deviceScaleFactor: 2,
  mobile: false,
}, sessionId);

await send('Page.navigate', { url: 'http://localhost:5173/' }, sessionId);
await sleep(1600);
await ev(`localStorage.setItem('lrs.lang', '${lang}'); location.reload()`);
await sleep(1600);

if (screen === 'talent') {
  await ev(`
    (() => {
      const cards = [...document.querySelectorAll('.talent')];
      cards[0].click(); cards[2].click();
    })()
  `);
  await sleep(300);
}

if (screen === 'midlife' || screen === 'summary') {
  await ev(`
    (() => {
      const cards = [...document.querySelectorAll('.talent')];
      cards.slice(0, 3).forEach(c => c.click());
      document.querySelector('.btn--primary').click();
    })()
  `);
  await sleep(700);

  // Play forward until we reach the target point.
  let guard = 0;
  while (guard++ < 600) {
    const st = await ev(`
      (() => {
        if (document.querySelector('.summary__ending')) return { done: true };
        if (document.querySelector('.choice__option, .career')) return { choice: true };
        const age = +(document.getElementById('age-chip')?.textContent?.match(/\\d+/) ?? [0])[0];
        return { next: !!document.getElementById('btn-next'), age };
      })()
    `);
    if (st.done) break;
    if (screen === 'midlife' && st.age >= 42) break;
    if (st.choice) {
      await ev('document.querySelector(".choice__option, .career").click()');
      await sleep(40);
      continue;
    }
    if (st.next) {
      await ev('document.getElementById("btn-next").click()');
      await sleep(30);
      continue;
    }
    await sleep(60);
  }
  if (screen === 'summary') {
    let g2 = 0;
    while (g2++ < 600) {
      const st = await ev(`
        (() => {
          if (document.querySelector('.summary__ending')) return { done: true };
          if (document.querySelector('.choice__option, .career')) return { choice: true };
          return { next: !!document.getElementById('btn-next') };
        })()
      `);
      if (st.done) break;
      if (st.choice) await ev('document.querySelector(".choice__option, .career").click()');
      else if (st.next) await ev('document.getElementById("btn-next").click()');
      else break;
      await sleep(30);
    }
  }
  await sleep(500);
}

const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, sessionId);
const file = join(OUT, `${screen}-${lang}.png`);
writeFileSync(file, Buffer.from(shot.data, 'base64'));
console.log('saved', file);

browser.kill();
process.exit(0);
