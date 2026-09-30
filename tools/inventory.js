// Generates the field inventory table for docs/mapping.md from the fixtures.
//
// Usage: node tools/inventory.js            -> prints markdown to stdout
//        node tools/inventory.js --write    -> replaces the generated block in docs/mapping.md
//
// Dev-only helper. The XML reader below is a deliberately minimal tokenizer that is
// sufficient for DataCite output (no CDATA, no comments inside <resource>, no DTD).
// It is NOT the application parser (see src/xml/, phase 3).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const FIXTURES = [
  { key: 'dmr-de', file: 'fixtures/nac2018-dmr-de_3.0.0.xml' },
  { key: 'dmr-en', file: 'fixtures/nac2018-dmr-en_3.0.0.xml' },
  { key: 'datapackage', file: 'fixtures/nac2018_3.0.0.xml' },
  { key: 'instrument', file: 'fixtures/sid2021-ins1-att1_1.0.0.xml' },
  { key: 'wps-paper', file: 'fixtures/es-wps-012026_1.0.0.xml' },
  { key: 'wps-series', file: 'fixtures/es-wps.xml' },
];

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) =>
    e[0] === '#'
      ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
      : ENTITIES[e] ?? m);

/** Parses XML into { name, attrs, children, text } nodes (element-only tree, text concatenated). */
export function parseXml(xml) {
  const body = xml.replace(/<\?[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  const tagRe = /<(\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  const attrRe = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  const root = { name: '#root', attrs: {}, children: [], text: '' };
  const stack = [root];
  for (const m of body.matchAll(tagRe)) {
    const top = stack.at(-1);
    if (m[5] !== undefined) { top.text += decode(m[5]); continue; }
    const [, closing, name, rawAttrs, selfClosing] = m;
    if (closing) {
      if (top.name !== name) throw new Error(`Mismatched </${name}>, expected </${top.name}>`);
      stack.pop();
      continue;
    }
    const attrs = {};
    for (const a of rawAttrs.matchAll(attrRe)) attrs[a[1]] = decode(a[2] ?? a[3]);
    const node = { name, attrs, children: [], text: '' };
    top.children.push(node);
    if (!selfClosing) stack.push(node);
  }
  if (stack.length !== 1) throw new Error(`Unclosed element <${stack.at(-1).name}>`);
  return root.children[0];
}

const IGNORED_ATTRS = new Set(['xmlns', 'xmlns:xsi', 'xsi:schemaLocation']);

/** Collects path -> list of values (text for elements, attribute values for @attrs). */
export function collect(node, prefix = '', out = new Map()) {
  const push = (p, v) => (out.has(p) ? out.get(p) : out.set(p, []).get(p)).push(v);
  const path = prefix ? `${prefix}/${node.name}` : node.name;
  push(path, node.children.length ? null : node.text.trim().replace(/\s+/g, ' '));
  for (const [k, v] of Object.entries(node.attrs)) {
    if (!IGNORED_ATTRS.has(k)) push(`${path}@${k}`, v);
  }
  for (const c of node.children) collect(c, path, out);
  return out;
}

const MAX = 70;
const esc = (s) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const trunc = (s) => (s.length > MAX ? `${s.slice(0, MAX - 1)}…` : s);

function cell(values) {
  if (!values) return '—';
  const n = values.length;
  const real = values.filter((v) => v !== null);
  if (real.length === 0) return `(Container) ×${n}`;
  const distinct = [...new Set(real)];
  const empty = real.filter((v) => v === '').length;
  if (distinct.length === 1) {
    const v = distinct[0] === '' ? '(leer)' : `\`${esc(trunc(distinct[0]))}\``;
    return n > 1 ? `${v} ×${n}` : v;
  }
  if (distinct.length <= 3) {
    return distinct.map((v) => `\`${esc(trunc(v))}\` ×${real.filter((x) => x === v).length}`).join('<br>');
  }
  return `${n}× , ${distinct.length} versch. Werte${empty ? `, ${empty} leer` : ''}`;
}

function status(cols) {
  if (cols.every((c) => !c || c.every((v) => v === null))) return 'Container';
  // Compare sets of distinct values; occurrence counts are expected to differ.
  const sets = cols.map((c) => c && JSON.stringify([...new Set(c)].sort()));
  const present = sets.filter(Boolean);
  const same = new Set(present).size === 1;
  if (present.length === sets.length) return same ? 'gleich (alle)' : 'variiert';
  const where = FIXTURES.filter((_, i) => sets[i]).map((f) => f.key).join(', ');
  return `nur ${where}${present.length > 1 ? (same ? ' (gleich)' : ' (variiert)') : ''}`;
}

export function buildTable() {
  const maps = FIXTURES.map((f) => collect(parseXml(readFileSync(join(ROOT, f.file), 'utf8'))));
  // Path order: elements in document order (elements missing from earlier fixtures are
  // inserted after their predecessor element); each element is followed by its attributes.
  const elements = [];
  const attrs = new Map();
  for (const m of maps) {
    let prev = null;
    for (const p of m.keys()) {
      const [el, attr] = p.split('@');
      if (attr) {
        const list = attrs.get(el) ?? attrs.set(el, []).get(el);
        if (!list.includes(p)) list.push(p);
        continue;
      }
      if (!elements.includes(el)) elements.splice(prev === null ? elements.length : elements.indexOf(prev) + 1, 0, el);
      prev = el;
    }
  }
  const paths = elements.flatMap((el) => [el, ...(attrs.get(el) ?? [])]);
  const rows = paths.map((p) => {
    const cols = maps.map((m) => m.get(p));
    return `| \`${p.replace(/^resource\//, '')}\` | ${cols.map(cell).join(' | ')} | ${status(cols)} |`;
  });
  return [
    `| Pfad | ${FIXTURES.map((f) => f.key).join(' | ')} | Befund (automatisch) |`,
    `|${'---|'.repeat(FIXTURES.length + 2)}`,
    ...rows,
  ].join('\n');
}

const BEGIN = '<!-- BEGIN GENERATED: tools/inventory.js -->';
const END = '<!-- END GENERATED -->';

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const table = buildTable();
  if (process.argv.includes('--write')) {
    const docPath = join(ROOT, 'docs/mapping.md');
    const doc = readFileSync(docPath, 'utf8');
    const i = doc.indexOf(BEGIN);
    const j = doc.indexOf(END);
    if (i < 0 || j < i) throw new Error('Generated markers not found in docs/mapping.md');
    writeFileSync(docPath, `${doc.slice(0, i + BEGIN.length)}\n${table}\n${doc.slice(j)}`);
    console.log('docs/mapping.md updated');
  } else {
    console.log(table);
  }
}
