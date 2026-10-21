/** Minimal DOM helpers — no framework, no virtual DOM. */

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'html') el.innerHTML = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'dataset' && typeof value === 'object') Object.assign(el.dataset, value);
    else if (key in el && key !== 'list') el[key] = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function mount(el, node) {
  clear(el);
  if (node) el.append(node);
  return el;
}

let toastTimer = null;

/** Remove every visible toast — used when the language changes. */
export function clearToasts() {
  clearTimeout(toastTimer);
  document.querySelectorAll('.toast').forEach((n) => n.remove());
}

export function toast(message) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const node = h('div', { class: 'toast', text: message });
  root.append(node);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    node.style.transition = 'opacity .3s, transform .3s';
    node.style.opacity = '0';
    node.style.transform = 'translateY(8px)';
    setTimeout(() => node.remove(), 320);
  }, 1800);
}
