import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import {
  loadProfiles,
  placeholdersOf,
  checkValues,
  applyProfile,
  checkProfile,
  buildDoi,
  parseDoi,
  withSeries,
  resourceTypeLabel,
  syncProfileFields,
  typeMismatch,
  buildLandingPage,
  PROFILE_IDS,
} from '../src/model/profile.js';
import { validate } from '../src/model/validate.js';
import { createCreator } from '../src/model/model.js';
import { parse } from '../src/xml/parse.js';
import { serialize } from '../src/xml/serialize.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const dom = { DOMParser, XMLSerializer };
const hasXmllint = spawnSync('xmllint', ['--version']).status === 0;
const tmp = mkdtempSync(join(tmpdir(), 'datacite-profile-'));
const readJson = async (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const { profiles, series } = await loadProfiles(readJson);
const eurostudent = series.find((s) => s.id === 'eurostudent-wps');
const NOW = new Date('2025-06-01T00:00:00Z');

const exampleValues = (profile) => Object.fromEntries(placeholdersOf(profile).map((p) => [p.name, p.example]));
const fixture = (f) => parse(readFileSync(join(ROOT, 'fixtures', f), 'utf8'), dom).model;
const lc = (s) => s.toLowerCase();

// Every profile (and the paper profile with its series), filled with example values.
const VARIANTS = [
  ...PROFILE_IDS.map((id) => ({ name: id, profile: profiles[id] })),
  { name: 'paper+eurostudent-wps', profile: withSeries(profiles.paper, eurostudent) },
];

for (const { name, profile } of VARIANTS) {
  test(`${name}: example values are valid and yield a DOI`, () => {
    const values = exampleValues(profile);
    assert.deepEqual(checkValues(profile, values), []);
    assert.ok(buildDoi(profile, values));
  });

  test(`${name}: DOI pattern roundtrips`, () => {
    const values = exampleValues(profile);
    const doiValues = Object.fromEntries(Object.entries(parseDoi(buildDoi(profile, values), profile)));
    for (const [k, v] of Object.entries(doiValues)) assert.equal(v, lc(values[k]), k);
  });

  test(`${name}: applied profile passes required fields and profile checks, output is schema-valid`, () => {
    const values = exampleValues(profile);
    const m = applyProfile(profile, values, { now: NOW });
    m.creators = [{ ...createCreator(), name: 'Muster, Erika', nameType: 'Personal' }];
    m.titles[0].value = 'Beispieltitel';
    if (!m.language) m.language = 'de';
    assert.deepEqual(validate(m), []);
    assert.deepEqual(checkProfile(m, profile, values, { now: NOW }).filter((i) => i.type !== 'recommended'), []);
    if (hasXmllint) {
      const file = join(tmp, `${name}.xml`);
      writeFileSync(file, serialize(m));
      const r = spawnSync('xmllint', ['--nonet', '--noout', '--schema', join(ROOT, 'schema/kernel-4.7/metadata.xsd'), file], { encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr);
    }
  });
}

test('dmr-de reproduces the nac2018 fixture in unified form', () => {
  const f = fixture('nac2018-dmr-de_3.0.0.xml');
  const m = applyProfile(profiles['dmr-de'], { studie: 'nac2018', version: '3.0.0', previousVersion: '2.0.0' }, { now: NOW });
  assert.equal(lc(m.identifier.value), lc(f.identifier.value));
  assert.deepEqual(m.publisher, { ...f.publisher, schemeURI: 'https://ror.org/' }); // unified: trailing slash
  assert.equal(m.resourceType.resourceTypeGeneral, f.resourceType.resourceTypeGeneral);
  assert.equal(m.resourceType.value, 'Data and Methods Report'); // decided wording
  assert.equal(m.language, f.language);
  assert.equal(m.version, f.version);
  assert.deepEqual(m.dates, f.dates);
  assert.equal(m.titles[0].lang, 'de');
  assert.equal(m.rightsList[0].rightsURI, f.rightsList[0].rightsURI);
  assert.equal(m.rightsList[0].rightsIdentifier, 'cc-by-nc-sa-4.0');

  const rel = (list, type) => list.find((r) => r.relationType === type);
  for (const type of ['IsNewVersionOf', 'IsTranslationOf']) {
    assert.equal(lc(rel(m.relatedIdentifiers, type).value), lc(rel(f.relatedIdentifiers, type).value), type);
  }
  // Decided change: data package relation is IsPartOf instead of IsSupplementTo.
  assert.equal(lc(rel(m.relatedIdentifiers, 'IsPartOf').value), lc(rel(f.relatedIdentifiers, 'IsSupplementTo').value));
  assert.equal(rel(m.relatedIdentifiers, 'IsSupplementTo'), undefined);
});

test('parseDoi reads registered DOIs (case-insensitive, with or without resolver URL)', () => {
  assert.deepEqual(parseDoi('10.21249/DZHW:NAC2018-DMR-DE:3.0.0', profiles['dmr-de']), { studie: 'nac2018', version: '3.0.0' });
  assert.deepEqual(parseDoi('https://doi.org/10.21249/DZHW:SID2021-INS1-ATT1:1.0.0', profiles.instrument), {
    studie: 'sid2021', ins: '1', att: '1', version: '1.0.0',
  });
  assert.deepEqual(parseDoi('10.21249/ES:WPS:012026:1.0.0', withSeries(profiles.paper, eurostudent)), {
    nr: '01', jahr: '2026', version: '1.0.0',
  });
  assert.deepEqual(parseDoi('10.21249/DZHW:nac2018-ds1_DsReport_en:3.0.0', profiles.dsreport), {
    studie: 'nac2018', ds: '1', lang: 'en', version: '3.0.0',
  });
  assert.equal(parseDoi('10.21249/DZHW:NAC2018-DMR-EN:3.0.0', profiles['dmr-de']), null);
  assert.equal(parseDoi('10.21249/DZHW:nac2018:3.0.0', profiles.instrument), null);
});

test('missing values: empty identifier, relations skipped; optional previousVersion only drops IsNewVersionOf', () => {
  const p = profiles['dmr-en'];
  const none = applyProfile(p, {}, { now: NOW });
  assert.equal(none.identifier.value, '');
  assert.equal(none.version, '');
  assert.deepEqual(none.relatedIdentifiers, []);
  const some = applyProfile(p, { studie: 'nac2018', version: '3.0.0' }, { now: NOW });
  assert.deepEqual(some.relatedIdentifiers.map((r) => r.relationType), ['IsPartOf', 'IsTranslationOf']);
  assert.deepEqual(checkValues(p, { studie: 'nac2018', version: '3.0.0' }), []);
});

test('checkValues reports missing and malformed placeholders', () => {
  const errors = checkValues(profiles.instrument, { studie: 'SID 2021', ins: 'x', att: '1' });
  assert.deepEqual(errors.map((e) => e.name), ['studie', 'ins', 'version']);
});

test('dsreport derives the other language for IsTranslationOf', () => {
  const m = applyProfile(profiles.dsreport, { studie: 'nac2018', ds: '1', lang: 'en', version: '3.0.0' }, { now: NOW });
  assert.equal(m.language, 'en');
  assert.equal(m.titles[0].lang, 'en');
  const tr = m.relatedIdentifiers.find((r) => r.relationType === 'IsTranslationOf');
  assert.equal(tr.value, '10.21249/DZHW:nac2018-ds1_DsReport_de:3.0.0');
});

test('paper: series supplies publisher, rights, funders and the IsPartOf series relation', () => {
  const p = withSeries(profiles.paper, eurostudent);
  const m = applyProfile(p, { nr: '01', jahr: '2026', version: '1.0.0' }, { now: NOW });
  const f = fixture('es-wps-012026_1.0.0.xml');
  assert.equal(lc(m.identifier.value), lc(f.identifier.value));
  assert.equal(m.publisher.name, f.publisher.name);
  assert.deepEqual(m.rightsList, f.rightsList);
  assert.deepEqual(m.fundingReferences.map((x) => x.funderIdentifier.value), [
    'https://doi.org/10.13039/501100002347',
    'https://doi.org/10.13039/501100000780',
  ]);
  const partOf = m.relatedIdentifiers.find((r) => r.relationType === 'IsPartOf');
  assert.deepEqual([partOf.value, partOf.resourceTypeGeneral], ['10.21249/es:wps', 'Journal']);
  assert.equal(resourceTypeLabel(p, 'DataPaper'), 'Data Paper');
  assert.throws(() => withSeries(profiles['dmr-de'], eurostudent), /unterstützt keine Reihen/);
});

test('checkProfile flags locked deviations, disallowed resourceTypeGeneral and empty recommended fields', () => {
  const p = profiles['dmr-de'];
  const values = { studie: 'nac2018', version: '3.0.0' };
  const m = applyProfile(p, values, { now: NOW });
  m.language = 'en';
  m.resourceType.resourceTypeGeneral = 'Dataset';
  const issues = checkProfile(m, p, values, { now: NOW });
  assert.deepEqual(
    issues.map((i) => `${i.type}:${i.path}`),
    ['locked:resourceType', 'locked:language', 'recommended:geoLocations', 'resourceTypeGeneral:resourceType.resourceTypeGeneral'],
  );
});

test('the landing page follows the registered pattern, and only where one is agreed', () => {
  // Taken from the registered addresses of the DMR DOIs, see docs/mapping.md, section 6.
  assert.equal(
    buildLandingPage(profiles['dmr-de'], { studie: 'phd2014', version: '5.0.0' }),
    'https://metadata.fdz.dzhw.eu/public/files/data-packages/stu-phd2014$-5.0.0/attachments/phd2014_MethodReport_de.pdf',
  );
  assert.equal(
    buildLandingPage(profiles['dmr-en'], { studie: 'scs2023', version: '2.0.0' }),
    'https://metadata.fdz.dzhw.eu/public/files/data-packages/stu-scs2023$-2.0.0/attachments/scs2023_MethodReport_en.pdf',
  );
  assert.equal(buildLandingPage(profiles['dmr-de'], { studie: 'phd2014' }), null, 'without a version there is no address');
  assert.equal(buildLandingPage(profiles.instrument, { studie: 'sid2021', ins: '1', att: '1', version: '1.0.0' }), null,
    'questionnaires have no agreed pattern yet (docs/todo.md)');
});

test('typeMismatch reports a record that is typed differently than the profile builds', () => {
  const dataPackage = fixture('nac2018_3.0.0.xml'); // resourceTypeGeneral="Dataset"
  const report = fixture('nac2018-dmr-de_3.0.0.xml');
  assert.deepEqual(typeMismatch(dataPackage, profiles['dmr-de']), {
    actual: 'Dataset',
    value: dataPackage.resourceType.value,
    allowed: ['Report'],
  });
  assert.equal(typeMismatch(report, profiles['dmr-de']), null, 'a report fits the report profile');
  assert.equal(typeMismatch(report, profiles.paper), null, 'Report is one of several allowed types');
  assert.equal(typeMismatch({ resourceType: { resourceTypeGeneral: '' } }, profiles['dmr-de']), null, 'no type, no verdict');
});

test('re-locking restores the profile value, unlocking keeps the user value', () => {
  // Mirrors what the form does: unlock, edit, lock again.
  const p = profiles['dmr-de'];
  const values = { studie: 'nac2018', version: '3.0.0' };
  const model = applyProfile(p, values, { now: NOW });
  const unlocked = new Set(['language']);

  model.language = 'en';
  syncProfileFields(model, p, values, { unlocked, now: NOW });
  assert.equal(model.language, 'en', 'unlocked: the user value survives');

  unlocked.delete('language');
  syncProfileFields(model, p, values, { unlocked, now: NOW });
  assert.equal(model.language, 'de', 'locked again: back to the profile value');
  assert.deepEqual(checkProfile(model, p, values, { now: NOW }).filter((i) => i.type === 'locked'), []);
});
