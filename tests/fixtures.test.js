import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildTable, FIXTURES } from '../tools/inventory.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = 'schema/kernel-4.7/metadata.xsd';

const xmlFiles = [
  ...readdirSync(join(ROOT, 'fixtures')).filter((f) => f.endsWith('.xml')).map((f) => `fixtures/${f}`),
  ...readdirSync(join(ROOT, 'fixtures/_crosscheck')).filter((f) => f.endsWith('.xml')).map((f) => `fixtures/_crosscheck/${f}`),
];

const hasXmllint = spawnSync('xmllint', ['--version']).status === 0;

test('the public fixtures carry no real ORCID iDs', () => {
  // The fixtures are anonymised copies (tools/anonymize.js). Invented iDs live in the 0000-0000
  // block, which ORCID has never issued - a real iD would show up here immediately.
  for (const file of xmlFiles) {
    const found = readFileSync(join(ROOT, file), 'utf8').match(/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/g) ?? [];
    for (const id of found) assert.match(id, /^0000-0000-/, `${file} holds the real iD ${id}`);
  }
});

test('the public fixtures match the originals', { skip: !existsSync(join(ROOT, 'fixtures-private')) && 'fixtures-private/ not present' }, () => {
  const r = spawnSync(process.execPath, [join(ROOT, 'tools/anonymize.js'), '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

test('all fixtures listed in the inventory exist', () => {
  for (const f of FIXTURES) assert.ok(xmlFiles.includes(f.file), `${f.file} missing`);
});

for (const file of xmlFiles) {
  test(`${file} validates against ${SCHEMA}`, { skip: !hasXmllint && 'xmllint not on PATH' }, () => {
    const r = spawnSync('xmllint', ['--nonet', '--noout', '--schema', SCHEMA, file], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  });
}

test('generated inventory in docs/mapping.md is up to date', () => {
  const doc = readFileSync(join(ROOT, 'docs/mapping.md'), 'utf8').replace(/\r\n/g, '\n');
  assert.ok(doc.includes(buildTable()), 'run: node tools/inventory.js --write');
});
