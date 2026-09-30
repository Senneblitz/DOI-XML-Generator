// Generic field and repeatable-group rendering.
//
// A field spec is { key, label, type, options?, rows?, wide? } and edits one property of an object.
// A group spec is { key, label, itemLabel, factory, fields, sublists?, optionals? } and edits an array.
// An optional spec is { key, label, factory, fields } and edits a sub-object that may be null.

import { isBlank } from '../model/model.js';

/**
 * Names the entry in one line: its first filled field, e.g. the creator's name or the title.
 * Long texts are shortened, because the question should stay readable.
 */
function describeEntry(value, fields) {
  const candidates = fields ? fields.map((f) => value?.[f.key]) : [value];
  const text = candidates
    .map((v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : ''))
    .find(Boolean) ?? '';
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

/** Asks before something with content is dropped; an empty row goes without a question. */
function confirmRemove(label, value, fields) {
  if (isBlank(value)) return true;
  const what = describeEntry(value, fields);
  return confirm(what ? `${label} „${what}“ wirklich entfernen?` : `${label} wirklich entfernen?`);
}

export function h(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== null && v !== undefined && v !== false) el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of [children].flat()) if (c) el.append(c);
  return el;
}

const LANGS = ['', 'de', 'en'];

// Optional hook: the app uses it to add look-ups (ROR, ORCID) to individual fields.
let enhancer = null;

/** Registers a function called for every rendered field: ({ input, spec, obj, onChange }). */
export const setFieldEnhancer = (fn) => {
  enhancer = fn;
};

/** Renders one field bound to obj[spec.key]; onChange() is called after each edit. */
export function renderField(obj, spec, onChange, { disabled = false } = {}) {
  const id = `f-${Math.random().toString(36).slice(2, 9)}`;
  let input;
  const value = obj[spec.key] ?? '';
  if (spec.type === 'select' || spec.type === 'lang') {
    const options = spec.type === 'lang' ? LANGS : ['', ...spec.options];
    input = h('select', { id, disabled });
    for (const o of options) {
      input.append(h('option', { value: o, text: o === '' ? '– ohne –' : o, selected: o === value }));
    }
  } else if (spec.type === 'textarea') {
    input = h('textarea', { id, rows: spec.rows ?? 4, disabled });
    input.value = value;
  } else {
    input = h('input', { id, type: 'text', disabled, placeholder: spec.placeholder ?? '' });
    input.value = value;
  }
  input.addEventListener('input', () => {
    obj[spec.key] = input.value;
    onChange();
  });
  input.addEventListener('change', () => {
    obj[spec.key] = input.value;
    onChange();
  });
  const field = h('div', { class: `field${spec.wide ? ' wide' : ''}` }, [h('label', { for: id, text: spec.label }), input]);
  if (spec.suggest && !disabled) enhancer?.({ input, spec, obj, onChange });
  return field;
}

export const renderFields = (obj, specs, onChange, opts) =>
  h('div', { class: 'fields' }, specs.map((s) => renderField(obj, s, onChange, opts)));

/**
 * Renders a repeatable group. `rerender()` is called when the number or order of
 * items changes, `onChange()` for plain edits. `itemBadge(item)` may add a node at the top of an
 * item (the app uses it for the per-entry review) and `itemClass(item)` a class on its fieldset.
 */
export function renderGroup(items, spec, { onChange, rerender, disabled = false, itemBadge, itemClass }) {
  // Adding or moving an item rebuilds the DOM, so remember where the focus should land.
  const focusItem = (index) => focusAfterRender(`[data-item="${spec.key}-${index}"] input, [data-item="${spec.key}-${index}"] select`);
  const rows = items.map((item, i) =>
    h('fieldset', { class: `item${itemClass ? ` ${itemClass(item)}` : ''}`, 'data-item': `${spec.key}-${i}` }, [
      h('legend', {}, [
        h('span', { class: 'item-title', text: `${spec.itemLabel ?? spec.label} ${i + 1}` }),
        h('div', { class: 'item-actions' }, [
          h('button', { type: 'button', title: `${spec.itemLabel ?? spec.label} ${i + 1} nach oben`, disabled: disabled || i === 0, text: '↑', onClick: () => {
            focusAfterRender(`[data-item="${spec.key}-${i - 1}"] .item-actions button`);
            move(items, i, -1, rerender);
          } }),
          h('button', { type: 'button', title: `${spec.itemLabel ?? spec.label} ${i + 1} nach unten`, disabled: disabled || i === items.length - 1, text: '↓', onClick: () => {
            focusAfterRender(`[data-item="${spec.key}-${i + 1}"] .item-actions button:nth-child(-n+2)`);
            move(items, i, 1, rerender);
          } }),
          h('button', { type: 'button', title: `${spec.itemLabel ?? spec.label} ${i + 1} entfernen`, disabled, class: 'danger', text: '✕', onClick: () => {
            if (!confirmRemove(`${spec.itemLabel ?? spec.label} ${i + 1}`, items[i], spec.fields)) return;
            items.splice(i, 1);
            focusItem(Math.min(i, items.length - 1));
            rerender();
          } }),
        ]),
      ]),
      itemBadge?.(item) ?? null,
      renderFields(item, spec.fields, onChange, { disabled }),
      ...(spec.optionals ?? []).map((opt) => renderOptional(item, opt, { onChange, rerender, disabled })),
      ...(spec.sublists ?? []).map((sub) =>
        h('div', { class: 'sublist' }, [
          renderGroup(item[sub.key], sub, { onChange, rerender, disabled }),
        ]),
      ),
    ]),
  );
  return h('div', { class: 'group' }, [
    h('div', { class: 'group-head' }, [
      h('h3', { text: `${spec.label} (${items.length})` }),
      h('button', { type: 'button', disabled, text: `+ ${spec.itemLabel ?? spec.label}`, onClick: () => {
        items.push(spec.factory());
        focusItem(items.length - 1);
        rerender();
      } }),
    ]),
    ...rows,
  ]);
}

let pendingFocus = null;

/** Remembers a selector to focus after the next re-render. */
export const focusAfterRender = (selector) => {
  pendingFocus = selector;
};

/**
 * Moves the focus to the element remembered by focusAfterRender().
 * Disabled matches are skipped (e.g. the "up" button of the topmost item).
 */
export function applyPendingFocus(root = document) {
  if (!pendingFocus) return;
  const target = [...root.querySelectorAll(pendingFocus)].find((el) => !el.disabled);
  pendingFocus = null;
  target?.focus();
}

/** Renders a sub-object that may be absent (null), with an add/remove button. */
export function renderOptional(parent, spec, { onChange, rerender, disabled = false }) {
  const present = parent[spec.key] !== null && parent[spec.key] !== undefined;
  const head = h('div', { class: 'group-head' }, [
    h('h3', { text: spec.label }),
    h('button', { type: 'button', disabled, class: present ? 'danger' : '', text: present ? 'entfernen' : '+ hinzufügen', onClick: () => {
      if (present && !confirmRemove(spec.label, parent[spec.key], spec.fields)) return;
      parent[spec.key] = present ? null : spec.factory();
      rerender();
    } }),
  ]);
  return h('div', { class: 'sublist optional' }, [
    head,
    ...(present ? [renderFields(parent[spec.key], spec.fields, onChange, { disabled })] : []),
    ...(present && spec.sublists ? spec.sublists.map((sub) => renderGroup(parent[spec.key][sub.key], sub, { onChange, rerender, disabled })) : []),
  ]);
}

function move(items, i, delta, rerender) {
  const j = i + delta;
  if (j < 0 || j >= items.length) return;
  [items[i], items[j]] = [items[j], items[i]];
  rerender();
}

/** Renders a list of plain strings (sizes, formats). */
export function renderStringGroup(items, spec, { onChange, rerender, disabled = false }) {
  return h('div', { class: 'group' }, [
    h('div', { class: 'group-head' }, [
      h('h3', { text: `${spec.label} (${items.length})` }),
      h('button', { type: 'button', disabled, text: `+ ${spec.itemLabel ?? spec.label}`, onClick: () => {
        items.push('');
        rerender();
      } }),
    ]),
    ...items.map((value, i) => {
      const input = h('input', { type: 'text', disabled });
      input.value = value;
      input.addEventListener('input', () => {
        items[i] = input.value;
        onChange();
      });
      return h('div', { class: 'row' }, [
        input,
        h('button', { type: 'button', class: 'danger', disabled, title: `${spec.itemLabel ?? spec.label} ${i + 1} entfernen`, text: '✕', onClick: () => {
          if (!confirmRemove(`${spec.itemLabel ?? spec.label} ${i + 1}`, items[i], null)) return;
          items.splice(i, 1);
          rerender();
        } }),
      ]);
    }),
  ]);
}
