/**
 * Zero-dependency headless UI check over Chrome DevTools Protocol.
 * Uses the browser already installed on this machine — nothing is downloaded.
 *
 * Checks: page loads, no console errors, talent cards render, a full life
 * can be played by clicking, bilingual switch works, summary appears.
 *
 * Run (server must be up): node test/ui.test.js
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL_BASE = process.env.URL_BASE || 'http://localhost:5173/';
const CHROME =
  process.env.CHROME_PATH ||
  [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].find((p) => existsSync(p));

if (!CHROME) {
  console.error('No local Chrome/Edge found. Set CHROME_PATH.');
  process.exit(1);
}

const profile = mkdtempSync(join(tmpdir(), 'lrs-ui-'));
const PORT = 9333 + Math.floor(Math.random() * 200);

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl() {
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

/** Minimal CDP client over the global WebSocket. */
function connect(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  const events = [];
  const listeners = new Set();

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id != null) {
      const p = pending.get(msg.id);
      if (p) {
        pending.delete(msg.id);
        msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
      }
    } else {
      events.push(msg);
      listeners.forEach((fn) => fn(msg));
    }
  });

  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });

  return {
    ready,
    events,
    on: (fn) => listeners.add(fn),
    send(method, params = {}, sessionId) {
      const msgId = ++id;
      return new Promise((resolve, reject) => {
        pending.set(msgId, { resolve, reject });
        ws.send(JSON.stringify({ id: msgId, method, params, sessionId }));
        setTimeout(() => {
          if (pending.has(msgId)) {
            pending.delete(msgId);
            reject(new Error(`CDP timeout: ${method}`));
          }
        }, 20000);
      });
    },
    close: () => ws.close(),
  };
}

const failures = [];
const consoleErrors = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  ✅' : '  ❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
};

async function main() {
  const wsUrl = await getWsUrl();
  const cdp = connect(wsUrl);
  await cdp.ready;

  const { targetInfos } = await cdp.send('Target.getTargets');
  const page = targetInfos.find((t) => t.type === 'page');
  const { sessionId } = await cdp.send('Target.attachToTarget', {
    targetId: page.targetId,
    flatten: true,
  });

  const send = (m, p) => cdp.send(m, p, sessionId);

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Log.enable');

  cdp.on((msg) => {
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      consoleErrors.push(d.exception?.description ?? d.text ?? 'exception');
    }
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      consoleErrors.push(msg.params.entry.text);
    }
  });

  console.log('\n▶ loading', URL_BASE);
  await send('Page.navigate', { url: URL_BASE });
  await sleep(1800);

  const evaluate = async (expression) => {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description ?? 'eval failed');
    }
    return res.result.value;
  };

  console.log('\n▶ rendering');
  const talentCount = await evaluate('document.querySelectorAll(".talent").length');
  check('talent cards render', talentCount === 6, `${talentCount} cards`);

  const statCount = await evaluate('document.querySelectorAll(".stat").length');
  check('stat tiles render', statCount === 5, `${statCount} tiles`);

  const hasHistory = await evaluate('!!document.querySelector(".empty, .history")');
  check('history panel renders', hasHistory);

  /* ── seed replay ───────────────────────────────────────────────── */
  console.log('\n▶ seed replay');
  const seedInput = await evaluate('document.querySelector(".seed-input")?.value ?? null');
  check('seed bar is prefilled with the current seed', /^\d+$/.test(seedInput ?? ''), String(seedInput));

  const replayed = await evaluate(`
    (() => {
      const input = document.querySelector('.seed-input');
      input.value = '123456';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      return true;
    })()
  `);
  await sleep(400);
  const newSeed = await evaluate('document.querySelector(".seed-input")?.value ?? null');
  const seedInFooter = await evaluate('document.querySelector(".footer .seed")?.textContent ?? ""');
  check('loading a seed rebuilds the run', replayed && newSeed === '123456', `input=${newSeed}`);
  check('footer shows the loaded seed', seedInFooter.includes('123456'), seedInFooter);

  const sameTalentSet = await evaluate(`
    (() => {
      const names = [...document.querySelectorAll('.talent__name')].map(n => n.textContent.trim());
      return names.length === 6 && new Set(names).size === 6;
    })()
  `);
  check('seed offers six unique talents', sameTalentSet);

  /* ── reduced motion toggle ─────────────────────────────────────── */
  console.log('\n▶ accessibility');
  const motionBefore = await evaluate('document.documentElement.classList.contains("reduce-motion")');
  await evaluate('document.getElementById("btn-motion").click()');
  await sleep(250);
  const motionAfter = await evaluate('document.documentElement.classList.contains("reduce-motion")');
  check('reduced-motion toggle flips', motionBefore !== motionAfter, `${motionBefore} → ${motionAfter}`);
  const persisted = await evaluate('JSON.parse(localStorage.getItem("lrs.settings") ?? "{}").reduceMotion');
  check('reduced-motion preference persists', persisted === motionAfter, `stored=${persisted}`);
  await evaluate('document.getElementById("btn-motion").click()');
  await sleep(250);

  console.log('\n▶ picking 3 talents + starting');
  await evaluate(`
    (() => {
      const cards = [...document.querySelectorAll('.talent')];
      cards.slice(0, 3).forEach(c => c.click());
      return document.querySelectorAll('.talent.is-picked').length;
    })()
  `);
  const picked = await evaluate('document.querySelectorAll(".talent.is-picked").length');
  check('3 talents selectable', picked === 3, `${picked} picked`);

  // a 4th card must be blocked
  const fourth = await evaluate(`
    (() => {
      const cards = [...document.querySelectorAll('.talent')];
      cards[3].click();
      return document.querySelectorAll('.talent.is-picked').length;
    })()
  `);
  check('4th talent is blocked', fourth === 3, `${fourth} picked after 4th click`);

  await evaluate('document.querySelector(".btn--primary").click()');
  await sleep(600);

  const inLife = await evaluate('!!document.getElementById("log-host")');
  check('life screen opens', inLife);

  const logRows = await evaluate('document.querySelectorAll(".entry").length');
  check('life log has entries', logRows > 0, `${logRows} rows`);

  /* ── language switch mid-life must re-render, not duplicate, the log ── */
  console.log('\n▶ language switch mid-life');
  // Advance a few events first so the log is long enough for a duplicate to
  // show up (the log is rebuilt from engine history on every language change).
  for (let i = 0; i < 6; i++) {
    const canAdvance = await evaluate(
      `(() => { const b = document.getElementById('btn-next'); if (!b) return false; b.click(); return true; })()`,
    );
    if (!canAdvance) break;
    await sleep(40);
  }
  const rowsBeforeSwitch = await evaluate('document.querySelectorAll(".entry").length');
  check('log grew with events', rowsBeforeSwitch > logRows, `${rowsBeforeSwitch} rows`);
  await evaluate(
    `[...document.querySelectorAll('.segmented__item')].find(b => b.textContent.trim() === 'EN').click()`,
  );
  await sleep(400);
  const rowsAfterSwitch = await evaluate('document.querySelectorAll(".entry").length');
  check(
    'log is re-rendered, not duplicated',
    rowsAfterSwitch === rowsBeforeSwitch,
    `${rowsBeforeSwitch} → ${rowsAfterSwitch} rows`,
  );
  await evaluate(
    `[...document.querySelectorAll('.segmented__item')].find(b => b.textContent.trim() === '中文').click()`,
  );
  await sleep(400);
  const rowsBack = await evaluate('document.querySelectorAll(".entry").length');
  check('log survives switching back', rowsBack === rowsBeforeSwitch, `${rowsBack} rows`);

  console.log('\n▶ autoplay');
  // Autoplay is defined to refuse to run while the player owes a decision, so
  // first settle every outstanding prompt. Choosing a prompt runs the engine
  // forward one step, which can surface the *next* prompt — hence the loop.
  for (let i = 0; i < 40; i++) {
    const clicked = await evaluate(
      `(() => { const o = document.querySelector('.choice__option, .career'); if (!o) return false; o.click(); return true; })()`,
    );
    if (!clicked) break;
    await sleep(30);
  }

  const ageBefore = await evaluate('document.getElementById("age-chip")?.textContent ?? ""');
  const beforeAuto = await evaluate('document.querySelectorAll(".entry").length');
  await evaluate('document.getElementById("btn-auto").click()');
  await sleep(2400);
  const autoState = await evaluate(
    `(() => ({
      rows: document.querySelectorAll('.entry').length,
      age: document.getElementById('age-chip')?.textContent ?? '',
      autoOn: document.getElementById('btn-auto')?.classList.contains('is-active') ?? false,
      hasPrompt: Boolean(document.querySelector('.choice__option, .career')),
      ended: Boolean(document.querySelector('.summary__ending')),
    }))()`,
  );
  // A single tick can end exactly on a career milestone, which adds no log
  // row — so "progress" is measured by rows *or* age.
  check(
    'autoplay advances the run',
    autoState.rows > beforeAuto || autoState.age !== ageBefore || autoState.ended,
    `${beforeAuto} rows / ${ageBefore} → ${autoState.rows} rows / ${autoState.age}`,
  );
  check(
    'autoplay stops at a decision',
    !autoState.autoOn || !autoState.hasPrompt,
    autoState.hasPrompt ? 'paused for a prompt' : 'kept running (no prompt yet)',
  );
  // Make sure we are paused, so the rest of the run is deterministic.
  if (autoState.autoOn) await evaluate('document.getElementById("btn-auto").click()');
  await sleep(200);

  console.log('\n▶ playing a full life (clicking through choices)');
  let guard = 0;
  let choicesTaken = 0;
  let summarySeen = false;

  while (guard++ < 900) {
    const state = await evaluate(`
      (() => {
        if (document.querySelector('.summary__ending')) return { done: true };
        const opt = document.querySelector('.choice__option, .career');
        if (opt) return { choice: true };
        const next = document.getElementById('btn-next');
        return { next: !!next };
      })()
    `);

    if (state.done) {
      summarySeen = true;
      break;
    }
    if (state.choice) {
      await evaluate('document.querySelector(".choice__option, .career").click()');
      choicesTaken++;
      await sleep(30);
      continue;
    }
    if (state.next) {
      await evaluate('document.getElementById("btn-next").click()');
      await sleep(20);
      continue;
    }
    await sleep(50);
  }

  check('life reaches an ending', summarySeen, `after ${guard} steps`);
  check('decision prompts appeared', choicesTaken > 0, `${choicesTaken} choices`);

  const summary = await evaluate(`
    (() => {
      const q = (s) => document.querySelector(s)?.textContent?.trim() ?? null;
      return {
        ending: q('.summary__ending'),
        grade: q('.grade'),
        score: q('.summary__score'),
        minis: document.querySelectorAll('.mini').length,
        stats: document.querySelectorAll('.summary .stat').length,
      };
    })()
  `);
  check('summary shows an ending', Boolean(summary.ending), summary.ending ?? '');
  check('summary shows a grade', Boolean(summary.grade), summary.grade ?? '');
  check('summary shows score', Boolean(summary.score), summary.score ?? '');
  check('summary shows 5 stats', summary.stats === 5, `${summary.stats}`);

  console.log('\n▶ language switch');
  const beforeLang = await evaluate('document.documentElement.lang');
  await evaluate(
    `[...document.querySelectorAll('.segmented__item')].find(b => b.textContent.trim() === '${beforeLang.startsWith('zh') ? 'EN' : '中文'}').click()`,
  );
  await sleep(400);
  const afterLang = await evaluate('document.documentElement.lang');
  const titleAfter = await evaluate('document.querySelector(".brand__title")?.textContent');
  check('language toggles', beforeLang !== afterLang, `${beforeLang} → ${afterLang}`);
  check('title is translated', Boolean(titleAfter), titleAfter ?? '');

  // Ignore two legitimately Chinese spots: the language-switch label (each
  // language always shows its own name) and <noscript> (never rendered).
  const leftoverZh = await evaluate(`
    (() => {
      const out = [];
      const walk = (node) => {
        if (node.nodeType === 3) {
          const t = node.textContent.trim();
          if (t && /[\\u4e00-\\u9fa5]/.test(t)) {
            const p = node.parentElement;
            if (p?.closest('.segmented, noscript, script, style')) return;
            out.push(t);
          }
        } else if (node.nodeType === 1 && !['NOSCRIPT','SCRIPT','STYLE'].includes(node.tagName)) {
          for (const c of node.childNodes) walk(c);
        }
      };
      walk(document.body);
      return out;
    })()
  `);
  const expectZh = afterLang.startsWith('zh');
  check(
    'body text matches language',
    expectZh ? true : leftoverZh.length === 0,
    expectZh ? 'Chinese UI' : `untranslated: ${leftoverZh.slice(0, 5).join(' | ')}`,
  );

  console.log('\n▶ live again');
  await evaluate(`[...document.querySelectorAll('.btn--primary')].at(-1).click()`);
  await sleep(500);
  const backToTalent = await evaluate('document.querySelectorAll(".talent").length');
  check('can start a new life', backToTalent === 6, `${backToTalent} cards`);

  const historyRows = await evaluate('document.querySelectorAll(".history__row").length');
  check('previous life saved to history', historyRows >= 1, `${historyRows} rows`);

  console.log('\n▶ replay from history');
  const seedFromHistory = await evaluate('document.querySelector(".history__seed")?.textContent ?? ""');
  await evaluate('document.querySelector(".history__row").click()');
  await sleep(400);
  const seedAfterReplay = await evaluate('document.querySelector(".footer .seed")?.textContent ?? ""');
  check(
    'clicking a past life reloads its seed',
    seedFromHistory.replace('#', '') === seedAfterReplay.replace('#', ''),
    `${seedFromHistory} → ${seedAfterReplay}`,
  );
  const cardsAfterReplay = await evaluate('document.querySelectorAll(".talent").length');
  check('replay returns to the talent screen', cardsAfterReplay === 6, `${cardsAfterReplay} cards`);

  /* ── console hygiene ───────────────────────────────────────────── */
  console.log('\n▶ console');
  check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

  cdp.close();
  browser.kill();

  console.log('');
  if (failures.length) {
    console.error(`❌ ${failures.length} UI check(s) failed: ${failures.join(', ')}\n`);
    process.exit(1);
  }
  console.log('✅ all UI checks passed.\n');
}

main()
  .catch((err) => {
    console.error('\n💥', err.message, '\n');
    browser.kill();
    process.exit(1);
  })
  .finally(() => {
    setTimeout(() => {
      try {
        rmSync(profile, { recursive: true, force: true });
      } catch {
        /* windows may still hold a lock */
      }
    }, 500);
  });
