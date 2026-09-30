import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { fetchDoi, normalizeDoi, doiUrl, decodeBase64Xml } from '../src/api/datacite.js';
import { bumpVersion, nextVersionValues, staleVersionRelations, previousVersionGuess, PARTS } from '../src/model/version.js';
import { loadProfiles, syncProfileFields, parseDoi, applyProfile, reconcileRelations } from '../src/model/profile.js';
import { parse } from '../src/xml/parse.js';
import { createRelatedIdentifier } from '../src/model/model.js';
import { validate } from '../src/model/validate.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const dom = { DOMParser, XMLSerializer };
const readJson = async (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const { profiles } = await loadProfiles(readJson);
const fixture = (f) => readFileSync(join(ROOT, 'fixtures', f), 'utf8');

/** Builds the API response for a fixture, exactly as DataCite returns it. */
const apiResponse = (doi, xml, extra = {}) => ({
  data: {
    id: doi,
    attributes: {
      xml: Buffer.from(xml, 'utf8').toString('base64'),
      state: 'findable',
      updated: '2026-01-07T15:58:33.000Z',
      schemaVersion: 'http://datacite.org/schema/kernel-4',
      ...extra,
    },
  },
});

const stubFetch = (payload, { ok = true, status = 200 } = {}) => {
  const calls = [];
  return {
    calls,
    fetchImpl: async (url, opts) => {
      calls.push({ url, opts });
      return { ok, status, json: async () => payload };
    },
  };
};

// --- DataCite API ---------------------------------------------------------------

test('DOIs are normalised and URL-encoded', () => {
  assert.equal(normalizeDoi(' https://doi.org/10.21249/DZHW:nac2018:3.0.0 '), '10.21249/DZHW:nac2018:3.0.0');
  assert.equal(normalizeDoi('doi:10.21249/x'), '10.21249/x');
  assert.equal(doiUrl('10.21249/DZHW:nac2018:3.0.0'), 'https://api.datacite.org/dois/10.21249%2FDZHW%3Anac2018%3A3.0.0');
});

test('base64 decoding keeps umlauts intact', () => {
  const xml = '<resource><title>Größe & Maß</title></resource>';
  assert.equal(decodeBase64Xml(Buffer.from(xml, 'utf8').toString('base64')), xml);
});

test('fetchDoi returns the stored XML plus the record state', async () => {
  const xml = fixture('nac2018-dmr-de_3.0.0.xml');
  const { fetchImpl, calls } = stubFetch(apiResponse('10.21249/dzhw:nac2018-dmr-de:3.0.0', xml));
  const record = await fetchDoi('https://doi.org/10.21249/DZHW:nac2018-dmr-de:3.0.0', { fetchImpl });
  assert.equal(record.xml, xml);
  assert.equal(record.doi, '10.21249/dzhw:nac2018-dmr-de:3.0.0');
  assert.equal(record.state, 'findable');
  assert.match(calls[0].url, /^https:\/\/api\.datacite\.org\/dois\//);
  // The stored XML parses into a valid model.
  const { model, warnings } = parse(record.xml, dom);
  assert.deepEqual(warnings, []);
  assert.deepEqual(validate(model), []);
});

test('fetchDoi: unknown DOI is null, bad input and errors throw', async () => {
  const missing = stubFetch({}, { ok: false, status: 404 });
  assert.equal(await fetchDoi('10.21249/gibtsnicht', { fetchImpl: missing.fetchImpl }), null);
  await assert.rejects(() => fetchDoi('kein-doi', { fetchImpl: stubFetch({}).fetchImpl }), /sieht nicht wie eine DOI aus/);
  const failing = stubFetch({}, { ok: false, status: 503 });
  await assert.rejects(() => fetchDoi('10.21249/x', { fetchImpl: failing.fetchImpl }), /HTTP 503/);
  const empty = stubFetch({ data: { id: '10.21249/x', attributes: {} } });
  await assert.rejects(() => fetchDoi('10.21249/x', { fetchImpl: empty.fetchImpl }), /kein hinterlegtes XML/);
});

// --- versions --------------------------------------------------------------------

test('bumpVersion raises the chosen part and resets the lower ones', () => {
  assert.deepEqual(PARTS.map((p) => bumpVersion('3.2.5', p)), ['4.0.0', '3.3.0', '3.2.6']);
  assert.throws(() => bumpVersion('3.0', 'major'), /Format x\.y\.z/);
  assert.throws(() => bumpVersion('3.0.0', 'build'), /Versionsteil/);
});

test('previousVersionGuess names the likely predecessor', () => {
  assert.equal(previousVersionGuess('6.0.0'), '5.0.0');
  assert.equal(previousVersionGuess('6.1.0'), '6.0.0');
  assert.equal(previousVersionGuess('6.0.1'), '6.0.0');
  assert.equal(previousVersionGuess('6.2.3'), '6.2.2');
  assert.equal(previousVersionGuess('1.0.0'), null, 'a first version has no predecessor');
  assert.equal(previousVersionGuess(''), null);
  assert.equal(previousVersionGuess('3.0'), null);
});

test('nextVersionValues keeps the old version as the predecessor', () => {
  assert.deepEqual(nextVersionValues({ studie: 'nac2018', version: '3.0.0' }), {
    studie: 'nac2018',
    version: '4.0.0',
    previousVersion: '3.0.0',
  });
  assert.throws(() => nextVersionValues({ studie: 'nac2018' }), /aktuelle Version/);
});

// --- load a DOI and create a new version ------------------------------------------

test('new version: identifier, version and relations are updated, content is kept', () => {
  const profile = profiles['dmr-de'];
  const { model } = parse(fixture('nac2018-dmr-de_3.0.0.xml'), dom);
  const values = parseDoi(model.identifier.value, profile);
  assert.deepEqual(values, { studie: 'nac2018', version: '3.0.0' });

  // A relation the user added by hand must survive.
  model.relatedIdentifiers.push({
    value: 'https://example.org/beilage.pdf',
    relatedIdentifierType: 'URL',
    relationType: 'IsSupplementedBy',
    resourceTypeGeneral: 'Text',
    relatedMetadataScheme: '',
    schemeURI: '',
    schemeType: '',
    relationTypeInformation: '',
  });
  const creatorsBefore = JSON.parse(JSON.stringify(model.creators));

  const next = nextVersionValues(values, 'major');
  syncProfileFields(model, profile, next);

  assert.equal(model.identifier.value, '10.21249/DZHW:nac2018-dmr-de:4.0.0');
  assert.equal(model.version, '4.0.0');
  assert.deepEqual(model.creators, creatorsBefore, 'creators unchanged, order preserved');
  assert.equal(model.titles[0].value, parse(fixture('nac2018-dmr-de_3.0.0.xml'), dom).model.titles[0].value);

  const rel = (type) => model.relatedIdentifiers.find((r) => r.relationType === type);
  assert.equal(rel('IsNewVersionOf').value, '10.21249/DZHW:nac2018-dmr-de:3.0.0');
  assert.equal(rel('IsPartOf').value, '10.21249/DZHW:nac2018:4.0.0', 'data package relation follows the version');
  assert.equal(rel('IsTranslationOf').value, '10.21249/DZHW:nac2018-dmr-en:4.0.0');
  const manual = model.relatedIdentifiers.filter((r) => r.relationType === 'IsSupplementedBy');
  assert.deepEqual(
    manual.map((r) => r.value),
    [
      'https://metadata.fdz.dzhw.eu/public/files/data-packages/stu-nac2018$-3.0.0/attachments/nac2018_QuestionOrigin.xlsx',
      'https://example.org/beilage.pdf',
    ],
    'manual relations kept in order',
  );
  assert.deepEqual(validate(model), []);
});

test('new version: relations still pointing at the old version are reported', () => {
  const profile = profiles['dmr-de'];
  const { model } = parse(fixture('nac2018-dmr-de_3.0.0.xml'), dom);
  const next = nextVersionValues({ studie: 'nac2018', version: '3.0.0' }, 'major');
  syncProfileFields(model, profile, next);
  const stale = staleVersionRelations(model, next);
  // IsSupplementTo is the pre-decision data package relation kept from the old record,
  // IsSupplementedBy the attachment URL: both still carry 3.0.0 and need attention.
  assert.deepEqual(stale.map((r) => r.relationType), ['IsSupplementTo', 'IsSupplementedBy']);
  assert.match(stale[0].value, /dzhw:nac2018:3\.0\.0/);
  assert.match(stale[1].value, /stu-nac2018\$-3\.0\.0/);
  // The IsNewVersionOf link to the predecessor is not reported.
  assert.ok(!stale.some((r) => r.relationType === 'IsNewVersionOf'));
});

test('new version: unlocked fields keep the user value', () => {
  const profile = profiles['dmr-de'];
  const model = applyProfile(profile, { studie: 'nac2018', version: '3.0.0' });
  model.version = '3.0.0-beta';
  syncProfileFields(model, profile, nextVersionValues({ studie: 'nac2018', version: '3.0.0' }), {
    unlocked: new Set(['version']),
  });
  assert.equal(model.version, '3.0.0-beta', 'version stays because the user unlocked it');
  assert.equal(model.identifier.value, '10.21249/DZHW:nac2018-dmr-de:4.0.0');
});

test('new version: the legacy data package relation is replaced, attachment URLs follow the version', () => {
  const profile = profiles['dmr-de'];
  const { model } = parse(fixture('nac2018-dmr-de_3.0.0.xml'), dom);
  const next = nextVersionValues({ studie: 'nac2018', version: '3.0.0' }, 'major');

  syncProfileFields(model, profile, next);
  const { removed, retargeted } = reconcileRelations(model, profile, next);

  // The old IsSupplementTo pointed at the data package 3.0.0; IsPartOf 4.0.0 now covers it.
  assert.deepEqual(removed.map((r) => [r.relationType, r.replacedBy]), [['IsSupplementTo', 'IsPartOf']]);
  assert.ok(!model.relatedIdentifiers.some((r) => r.relationType === 'IsSupplementTo'));

  // The attachment URL carried 3.0.0 twice and now points at the new version.
  assert.deepEqual(retargeted.map((r) => r.relationType), ['IsSupplementedBy']);
  const attachment = model.relatedIdentifiers.find((r) => r.relationType === 'IsSupplementedBy');
  assert.match(attachment.value, /stu-nac2018\$-4\.0\.0.*QuestionOrigin/);
  assert.ok(!attachment.value.includes('3.0.0'));

  assert.deepEqual(staleVersionRelations(model, next), [], 'nothing points at the old version any more');
  assert.deepEqual(validate(model), []);
});

test('reconcileRelations keeps unrelated relations and needs no previous version', () => {
  const profile = profiles['dmr-de'];
  const values = { studie: 'nac2018', version: '4.0.0' };
  const model = applyProfile(profile, values);
  model.relatedIdentifiers.push(
    { ...createRelatedIdentifier(), value: '10.21249/DZHW:other:1.0.0', relatedIdentifierType: 'DOI', relationType: 'IsSupplementTo' },
    { ...createRelatedIdentifier(), value: 'https://example.org/doku.pdf', relatedIdentifierType: 'URL', relationType: 'IsDocumentedBy' },
  );
  const { removed, retargeted } = reconcileRelations(model, profile, values);
  assert.deepEqual(removed, [], 'a different target is not superseded');
  assert.deepEqual(retargeted, []);
  assert.equal(model.relatedIdentifiers.length, 4);
});
