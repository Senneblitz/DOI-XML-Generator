// Type-ahead for text inputs: debounce, minimum length, in-memory cache, and cancelling
// of outdated requests (AbortController). Errors are shown next to the field and never
// block typing (see docs/spike.md).

const DEBOUNCE_MS = 300;
const MIN_LENGTH = 3;

/** Wraps a search function with an in-memory cache keyed by the query. */
export function withCache(search, { max = 100 } = {}) {
  const cache = new Map();
  return async (term, opts) => {
    if (cache.has(term)) return cache.get(term);
    const result = await search(term, opts);
    if (cache.size >= max) cache.delete(cache.keys().next().value);
    cache.set(term, result);
    return result;
  };
}

/**
 * Attaches a suggestion list to an input.
 * options: { search(term, {signal}) -> items, label(item) -> string, hint(item) -> string,
 *            onSelect(item), minLength, delay }
 */
export function attachTypeahead(input, options) {
  const { search, label, hint = () => '', onSelect, minLength = MIN_LENGTH, delay = DEBOUNCE_MS } = options;
  const list = document.createElement('ul');
  list.className = 'suggestions';
  list.setAttribute('role', 'listbox');
  list.hidden = true;
  const status = document.createElement('div');
  status.className = 'suggest-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  input.after(status);
  input.after(list);
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');

  let items = [];
  let active = -1;
  let timer = null;
  let controller = null;

  const close = () => {
    list.hidden = true;
    list.replaceChildren();
    input.setAttribute('aria-expanded', 'false');
    items = [];
    active = -1;
  };

  const choose = (i) => {
    const item = items[i];
    if (!item) return;
    close();
    status.textContent = '';
    onSelect(item);
  };

  const draw = () => {
    list.replaceChildren();
    items.forEach((item, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === active));
      li.className = i === active ? 'active' : '';
      li.append(Object.assign(document.createElement('span'), { className: 'label', textContent: label(item) }));
      const h = hint(item);
      if (h) li.append(Object.assign(document.createElement('span'), { className: 'hint', textContent: h }));
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        choose(i);
      });
      list.append(li);
    });
    list.hidden = !items.length;
    input.setAttribute('aria-expanded', String(Boolean(items.length)));
  };

  const run = async (term) => {
    controller?.abort();
    controller = new AbortController();
    const mine = controller;
    try {
      const result = await search(term, { signal: mine.signal });
      if (mine !== controller) return; // a newer search has started
      items = result;
      active = -1;
      status.textContent = result.length ? '' : 'Keine Treffer.';
      draw();
    } catch (e) {
      if (e.name === 'AbortError' || mine !== controller) return;
      close();
      status.textContent = `Suche nicht verfügbar: ${e.message}`;
    }
  };

  const onInput = () => {
    clearTimeout(timer);
    const term = input.value.trim();
    if (term.length < minLength) {
      controller?.abort();
      close();
      status.textContent = '';
      return;
    }
    timer = setTimeout(() => run(term), delay);
  };

  const onKeyDown = (e) => {
    if (list.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      draw();
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      choose(active);
    } else if (e.key === 'Escape') {
      close();
    }
  };

  input.addEventListener('input', onInput);
  input.addEventListener('keydown', onKeyDown);
  input.addEventListener('blur', () => setTimeout(close, 120));

  return () => {
    clearTimeout(timer);
    controller?.abort();
    close();
  };
}
