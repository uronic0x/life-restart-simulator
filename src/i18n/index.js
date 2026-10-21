import { zh } from './zh.js';
import { en } from './en.js';

export const DICTS = { zh, en };
export const LANGS = [
  { code: 'zh', label: '中文', short: '中' },
  { code: 'en', label: 'English', short: 'EN' },
];

const STORAGE_KEY = 'lrs.lang';

function detect() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && DICTS[saved]) return saved;
  const nav = (navigator.language || 'zh').toLowerCase();
  return nav.startsWith('zh') ? 'zh' : 'en';
}

let current = detect();
const listeners = new Set();

export function getLang() {
  return current;
}

export function setLang(code) {
  if (!DICTS[code] || code === current) return;
  current = code;
  localStorage.setItem(STORAGE_KEY, code);
  document.documentElement.lang = code === 'zh' ? 'zh-CN' : 'en';
  listeners.forEach((fn) => fn(current));
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Resolve a dotted key, falling back to the other language then the key. */
export function t(path, vars) {
  const read = (dict) => path.split('.').reduce((acc, part) => acc?.[part], dict);
  let value = read(DICTS[current]) ?? read(DICTS.zh) ?? path;
  if (typeof value === 'string' && vars) {
    value = value.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
  }
  return value;
}

/** Text for an event, which may be a string or an object with choices. */
export function eventText(id) {
  const entry = t(`events.${id}`);
  if (typeof entry === 'string') {
    return { text: entry, choices: null };
  }
  if (entry && typeof entry === 'object') {
    return { text: entry.text ?? id, choices: entry.choices ?? null };
  }
  return { text: id, choices: null };
}

document.documentElement.lang = current === 'zh' ? 'zh-CN' : 'en';
