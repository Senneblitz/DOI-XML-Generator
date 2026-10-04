import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { toSaveState, fromSaveState, fileNameFor, SAVE_FORMAT } from '../src/ui/storage.js';
import { APP_VERSION } from '../src/version.js';
import { parse } from '../src/xml/parse.js';
import { createResource, completeResource } from '../src/model/model.js';
import { VOCAB } from '../src/model/vocab.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('vocab.js is in sync with the schema', () => {
  const r = spawnSync(process.execPath, [join(ROOT, 'tools/vocab.js'), '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

test('vocab contains the values used by the fixtures', () => {
  for (const v of ['Report', 'Dataset', 'Instrument', 'DataPaper', 'Text']) assert.ok(VOCAB.resourceTypeGeneral.includes(v), v);
  for (const v of ['IsPartOf', 'IsNewVersionOf', 'IsTranslationOf', 'IsSupplementTo']) assert.ok(VOCAB.relationType.includes(v), v);
  for (const v of ['Issued', 'Available', 'Collected']) assert.ok(VOCAB.dateType.includes(v), v);
  for (const v of ['Abstract', 'Methods', 'SeriesInformation']) assert.ok(VOCAB.descriptionType.includes(v), v);
  assert.deepEqual(VOCAB.nameType, ['Organizational', 'Personal']);
});

test('the tool version is the same in src/version.js, package.json and the changelog', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.version, APP_VERSION, 'package.json and src/version.js disagree');
  const changelog = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
  assert.ok(changelog.includes(`## [${APP_VERSION}]`), `CHANGELOG.md has no entry for ${APP_VERSION}`);
});

test('save state roundtrips through JSON', () => {
  const model = parse(readFileSync(join(ROOT, 'fixtures/nac2018-dmr-de_3.0.0.xml'), 'utf8'), { DOMParser, XMLSerializer }).model;
  const state = {
    profileId: 'dmr-de',
    seriesId: null,
    values: { studie: 'nac2018', version: '3.0.0' },
    model,
    taken: { creators: { doi: '10.21249/DZHW:nac2018-dmr-en:3.0.0', approved: true, source: 'a1b2c3d4', items: ['0f0f0f0f'], approvedItems: [] } },
    landing: 'https://metadata.fdz.dzhw.eu/public/files/data-packages/stu-nac2018$-3.0.0/attachments/nac2018_MethodReport_de.pdf',
  };
  const restored = fromSaveState(JSON.parse(JSON.stringify(toSaveState(state))));
  // The file also records which version of the tool wrote it.
  assert.deepEqual(restored, { ...state, savedWith: APP_VERSION });
});

test('save state: the review of taken-over fields survives, unusable entries are dropped', () => {
  const file = {
    format: SAVE_FORMAT,
    formatVersion: 1,
    model: {},
    taken: {
      creators: { doi: '10.21249/DZHW:nac2018-dmr-en:3.0.0', source: 'abcd1234', items: ['1111aaaa', 7], approvedItems: ['1111aaaa'] },
      titles: { doi: '10.21249/DZHW:nac2018-dmr-en:3.0.0', approved: 'yes' },
      rightsList: { approved: true },
      geoLocations: 'nonsense',
    },
  };
  assert.deepEqual(fromSaveState(file).taken, {
    creators: {
      doi: '10.21249/DZHW:nac2018-dmr-en:3.0.0',
      approved: false,
      source: 'abcd1234',
      items: ['1111aaaa'], // the entry that is not a fingerprint is dropped
      approvedItems: ['1111aaaa'],
    },
    titles: { doi: '10.21249/DZHW:nac2018-dmr-en:3.0.0', approved: false, source: '', items: null, approvedItems: [] },
  });
  // Files written before the review existed simply have nothing to review.
  const bare = fromSaveState({ format: SAVE_FORMAT, formatVersion: 1, model: {} });
  assert.deepEqual(bare.taken, {});
  assert.equal(bare.landing, null, 'no landing page in the file means: follow the profile');
});

test('save state rejects foreign files and fills partial models', () => {
  assert.throws(() => fromSaveState({ format: 'something-else' }), /Speicherdatei/);
  assert.throws(() => fromSaveState({ format: SAVE_FORMAT, formatVersion: 99 }), /Version 99/);
  const restored = fromSaveState({ format: SAVE_FORMAT, formatVersion: 1, model: { titles: [{ value: 'T' }] } });
  assert.deepEqual(restored.model, completeResource({ titles: [{ value: 'T' }] }));
  assert.equal(restored.profileId, 'generic');
});

test('file names are derived from the DOI suffix', () => {
  assert.equal(fileNameFor('10.21249/DZHW:nac2018-dmr-de:3.0.0', 'xml'), 'dzhw_nac2018-dmr-de_3.0.0.xml');
  assert.equal(fileNameFor('10.21249/es:wps:012026:1.0.0', 'json'), 'es_wps_012026_1.0.0.json');
  assert.equal(fileNameFor('', 'xml'), 'datacite.xml');
  assert.equal(fileNameFor(createResource().identifier.value, 'xml'), 'datacite.xml');
});
