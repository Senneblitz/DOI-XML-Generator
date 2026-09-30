import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateAgainstSchema, resetSchemaValidator } from '../src/xml/validate-schema.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// The browser reads the schema over HTTP and imports the vendored browser build; that build
// runs xmllint in a Web Worker, which does not exist in Node. The tests therefore inject the
// node build of the same library (same API, same libxml2) plus file system reads, so the
// wrapper and the schema wiring are covered. The vendored browser files are checked for
// equality with the installed package, and verified in the browser itself.
const options = {
  readText: async (path) => readFileSync(join(ROOT, path), 'utf8'),
  importModule: () => import('xmllint-wasm'),
};

const fixture = (f) => readFileSync(join(ROOT, 'fixtures', f), 'utf8');

test('vendored xmllint-wasm matches the installed package', () => {
  const r = spawnSync(process.execPath, [join(ROOT, 'tools/vendor.js'), '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

test('a valid record passes', async () => {
  resetSchemaValidator();
  const result = await validateAgainstSchema(fixture('nac2018-dmr-de_3.0.0.xml'), options);
  assert.deepEqual(result, { valid: true, errors: [] });
});

test('all fixtures pass, the cached validator is reused', async () => {
  for (const f of ['nac2018-dmr-en_3.0.0.xml', 'nac2018_3.0.0.xml', 'sid2021-ins1-att1_1.0.0.xml', 'es-wps.xml']) {
    const result = await validateAgainstSchema(fixture(f), options);
    assert.equal(result.valid, true, `${f}: ${JSON.stringify(result.errors)}`);
  }
});

test('a wrong controlled value is reported with a line number', async () => {
  const broken = fixture('nac2018-dmr-de_3.0.0.xml').replace('resourceTypeGeneral="Report"', 'resourceTypeGeneral="Bericht"');
  const result = await validateAgainstSchema(broken, options);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 1);
  assert.match(result.errors[0].message, /resourceTypeGeneral|Bericht/);
  assert.ok(Number.isInteger(result.errors[0].line), 'line number present');
});

test('a missing mandatory element is reported', async () => {
  const broken = fixture('nac2018-dmr-de_3.0.0.xml').replace(/<titles>[\s\S]*?<\/titles>/, '');
  const result = await validateAgainstSchema(broken, options);
  assert.equal(result.valid, false);
  assert.match(result.errors.map((e) => e.message).join(' '), /titles/);
});

test('malformed XML is reported as an error, not thrown', async () => {
  const result = await validateAgainstSchema('<resource><titles></resource>', options);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 1);
});
