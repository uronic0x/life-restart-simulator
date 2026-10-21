/**
 * Layout probe: drives the local Chrome over CDP and reports geometry
 * problems (horizontal overflow, overlapping boxes, clipped text) on every
 * screen at several widths, in both languages.
 *
 * Zero dependencies — it reuses the Chrome already installed on the machine.
 *
 * Run (server must be up): node tools/probe.js
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL_BASE = process.env.URL_BASE || 'http://localhost:5173/';
const CHROME =
  process.env.CHROME_PATH ||
  [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].find((p) => existsSync(p));

if (!CHROME) {
  console.error('No local Chrome/Edge found. Set CHROME_PATH.');
  process.exit(1);
}

const profile = mkdtempSync(join(tmpdir(), 'lrs-probe-'));
const PORT = 9700 + Math.floor(Math.random() * 200);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-gpu',
    '--window-size=1280,900',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

async function connect() {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const json = await res.json();
      if (json.webSocketDebuggerUrl) return json.webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await sleep(100);
  }
  throw new Error('Chrome did not expose a debugger in time');
}

const ws = new WebSocket(await connect());
await new Promise((res, rej) => {
  ws.addEventListener('open', res);
  ws.addEventListener('error', rej);
});

let seq = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id == null) return;
  const p = pending.get(msg.id);
  if (!p) return;
  pending.delete(msg.id);
  msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
});

const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }
    }, 20000);
  });

const { targetInfos } = await send('Target.getTargets');
const page = targetInfos.find((t) => t.type === 'page');
const { sessionId } = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);

await S('Runtime.enable');
await S('Page.enable');

const evaluate = async (expression) => {
  const res = await S('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? 'eval failed');
  return res.result.value;
};

/** Generic geometry audit of whatever is on screen. */
const AUDIT = `(() => {
  const issues = [];
  const doc = document.documentElement;
  if (doc.scrollWidth > doc.clientWidth + 1) {
    issues.push(\`horizontal overflow: \${doc.scrollWidth} > \${doc.clientWidth}\`);
  }
  // Elements that stick out of the viewport to the right.
  for (const el of document.querySelectorAll('.panel, .btn, .talent, .mini, .ach, .entry, .choice__option, .career, .seedbar, .summary__hero')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    if (r.right > doc.clientWidth + 1) {
      issues.push(\`overflows right: \${el.className.split(' ')[0]} (\${Math.round(r.right)})\`);
    }
  }
  // Text clipped by a too-small box (only flag real clipping, not ellipsis).
  for (const el of document.querySelectorAll('.summary__ending, .summary__desc, .talent__name, .talent__desc, .mini__value, .grade, .brand__title, .panel__title')) {
    if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).textOverflow !== 'ellipsis') {
      issues.push(\`clipped text: \${el.className} "\${el.textContent.trim().slice(0, 24)}"\`);
    }
  }
  // Overlapping siblings inside the hero.
  const boxes = [...document.querySelectorAll('.summary__hero > *')].map((el) => ({
    name: el.className.split(' ')[0],
    r: el.getBoundingClientRect(),
  }));
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].r, b = boxes[j].r;
      const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (overlapX > 2 && overlapY > 2) {
        issues.push(\`hero overlap: \${boxes[i].name} / \${boxes[j].name}\`);
      }
    }
  }
  return issues;
})()`;

const failures = [];

/** Content-level assertions for the summary screen. */
const CONTENT = `(() => {
  const issues = [];
  const names = [...document.querySelectorAll('.ach')].map(n => n.textContent.replace(/\\s+/g, ' ').trim());
  const dupes = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];
  if (dupes.length) issues.push('duplicate achievement chips: ' + dupes.join(', '));
  const heads = [...document.querySelectorAll('.section-head h2')].map(n => n.textContent.trim());
  const repeated = [...new Set(heads.filter((n, i) => heads.indexOf(n) !== i))];
  if (repeated.length) issues.push('repeated section heading: ' + repeated.join(', '));
  const stats = document.querySelectorAll('.summary .stat').length;
  if (stats !== 5) issues.push('summary shows ' + stats + ' stat tiles, expected 5');
  const minis = document.querySelectorAll('.mini').length;
  if (minis !== 5) issues.push('summary shows ' + minis + ' mini tiles, expected 5');
  if (!document.querySelector('.grade')) issues.push('no grade badge');
  if (!document.querySelector('.summary__icon')) issues.push('no ending icon');
  return issues;
})()`;

/** The history panel should keep one row per stored run, capped at 12. */
const HISTORY = `(() => {
  const issues = [];
  const rows = document.querySelectorAll('.history__row').length;
  if (rows < 1) issues.push('no history rows after playing');
  if (rows > 12) issues.push('history grows past its cap: ' + rows + ' rows');
  return issues;
})()`;

const report = (label, issues) => {
  const ok = issues.length === 0;
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : `\n       · ${issues.join('\n       · ')}`}`);
  if (!ok) failures.push(label);
};

const setViewport = (width, height = 900) =>
  S('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 700 });

async function load() {
  await S('Page.navigate', { url: URL_BASE });
  await sleep(1400);
}

const click = (sel) => evaluate(`(() => { const e = document.querySelector('${sel}'); if (e) { e.click(); return true; } return false; })()`);

async function setLang(code) {
  const label = code === 'en' ? 'EN' : '中文';
  await evaluate(
    `[...document.querySelectorAll('.segmented__item')].find(b => b.textContent.trim() === '${label}')?.click()`,
  );
  await sleep(350);
}

async function playToSummary() {
  let guard = 0;
  while (guard++ < 500) {
    const st = await evaluate(`(() => {
      if (document.querySelector('.summary__ending')) return 'done';
      if (document.querySelector('.choice__option, .career')) { document.querySelector('.choice__option, .career').click(); return 'choice'; }
      const b = document.getElementById('btn-next');
      if (b) { b.click(); return 'next'; }
      return 'wait';
    })()`);
    if (st === 'done') return;
    await sleep(12);
  }
  throw new Error('life never reached the summary');
}

const WIDTHS = [1280, 900, 700, 520, 390];

console.log('\n▶ layout probe\n');

for (const width of WIDTHS) {
  await setViewport(width);
  await load();

  console.log(`  ── ${width}px`);

  // talent screen
  report(`${width} talent (zh)`, await evaluate(AUDIT));
  await setLang('en');
  report(`${width} talent (en)`, await evaluate(AUDIT));
  await setLang('zh');

  // life screen
  await evaluate(`[...document.querySelectorAll('.talent')].slice(0, 3).forEach(c => c.click())`);
  await click('.btn--primary');
  await sleep(300);
  for (let i = 0; i < 8; i++) {
    if (!(await click('#btn-next'))) break;
    await sleep(25);
  }
  report(`${width} life (zh)`, await evaluate(AUDIT));
  await setLang('en');
  report(`${width} life (en)`, await evaluate(AUDIT));
  await setLang('zh');

  // summary (zh + en) — content checks too: no duplicate achievement chips,
  // no repeated section heading, exactly five stat tiles.
  await playToSummary();
  report(`${width} summary (zh)`, await evaluate(AUDIT));
  report(`${width} summary content (zh)`, await evaluate(CONTENT));
  await setLang('en');
  report(`${width} summary (en)`, await evaluate(AUDIT));
  report(`${width} summary content (en)`, await evaluate(CONTENT.replace(/'属性'/g, "'Stats'")));
  await setLang('zh');

  // a few past lives then the history panel
  for (let i = 0; i < 3; i++) {
    await evaluate(`[...document.querySelectorAll('.btn--primary')].at(-1).click()`);
    await sleep(250);
    await evaluate(`[...document.querySelectorAll('.talent')].slice(0, 3).forEach(c => c.click())`);
    await click('.btn--primary');
    await sleep(250);
    await playToSummary();
  }
  await evaluate(`[...document.querySelectorAll('.btn--primary')].at(-1).click()`);
  await sleep(400);
  report(`${width} history panel`, await evaluate(AUDIT));
  report(`${width} history rows`, await evaluate(HISTORY));
  console.log('');
}

ws.close();
browser.kill();

setTimeout(() => {
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    /* windows may still hold a lock */
  }
}, 500);

if (failures.length) {
  console.error(`❌ ${failures.length} layout check(s) failed.\n`);
  process.exit(1);
}
console.log('✅ no layout problems at any tested width or language.\n');
process.exit(0);
