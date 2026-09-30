import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { parse } from '../src/xml/parse.js';
import { serialize } from '../src/xml/serialize.js';
import { canonical } from './helpers/canonical.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = join(ROOT, 'schema/kernel-4.7/metadata.xsd');
const dom = { DOMParser, XMLSerializer };
const hasXmllint = spawnSync('xmllint', ['--version']).status === 0;
const tmp = mkdtempSync(join(tmpdir(), 'datacite-roundtrip-'));

const FIXTURES = [
  ...readdirSync(join(ROOT, 'fixtures')).filter((f) => f.endsWith('.xml')).map((f) => `fixtures/${f}`),
  ...readdirSync(join(ROOT, 'fixtures/_crosscheck')).filter((f) => f.endsWith('.xml')).map((f) => `fixtures/_crosscheck/${f}`),
];

for (const file of FIXTURES) {
  const name = file.split('/').pop();
  const original = readFileSync(join(ROOT, file), 'utf8');

  test(`${name}: parse without warnings`, () => {
    assert.deepEqual(parse(original, dom).warnings, []);
  });

  test(`${name}: parse -> serialize is content-equivalent`, () => {
    const out = serialize(parse(original, dom).model);
    // Line breaks in descriptions become <br/>, so both sides count <br/> as a line break.
    assert.deepEqual(canonical(out, { brAsText: true }), canonical(original, { brAsText: true }));
  });

  test(`${name}: serialized output validates against XSD`, { skip: !hasXmllint && 'xmllint not on PATH' }, () => {
    const outFile = join(tmp, name);
    writeFileSync(outFile, serialize(parse(original, dom).model));
    const r = spawnSync('xmllint', ['--nonet', '--noout', '--schema', SCHEMA, outFile], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  });

  test(`${name}: model survives JSON save/load and serialization is stable`, () => {
    const { model } = parse(original, dom);
    const reloaded = JSON.parse(JSON.stringify(model));
    assert.deepEqual(reloaded, model);
    const once = serialize(reloaded);
    assert.equal(serialize(parse(once, dom).model), once);
  });
}
