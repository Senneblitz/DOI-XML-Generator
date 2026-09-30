import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import {
  counterpartOf,
  createCounterpart,
  untranslated,
  mergeNeutralFields,
  mergeFields,
  filledFields,
  compareLanguageVersions,
  NEUTRAL_FIELDS,
  TRANSFERABLE_FIELDS,
  FIELD_LABELS,
} from '../src/model/translate.js';
import { loadProfiles, parseDoi } from '../src/model/profile.js';
import { parse } from '../src/xml/parse.js';
import { validate } from '../src/model/validate.js';
import { createSubject } from '../src/model/model.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const dom = { DOMParser, XMLSerializer };
const readJson = async (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const { profiles } = await loadProfiles(readJson);
const fixture = (f) => parse(readFileSync(join(ROOT, 'fixtures', f), 'utf8'), dom).model;
const NOW = new Date('2026-09-22T00:00:00Z');

const de = () => fixture('nac2018-dmr-de_3.0.0.xml');
const en = () => fixture('nac2018-dmr-en_3.0.0.xml');

const makeCounterpart = (model, fromId) => {
  const values = parseDoi(model.identifier.value, profiles[fromId]);
  const target = counterpartOf(fromId, values);
  return createCounterpart(model, {
    targetProfile: profiles[target.profileId],
    targetValues: target.values,
    sourceLanguage: model.language,
    targetLanguage: profiles[target.profileId].defaults.language,
    now: NOW,
  });
};

test('counterpartOf swaps the DMR profile and flips the lang placeholder', () => {
  assert.deepEqual(counterpartOf('dmr-de', { studie: 'nac2018', version: '3.0.0' }), {
    profileId: 'dmr-en',
    values: { studie: 'nac2018', version: '3.0.0' },
  });
  assert.deepEqual(counterpartOf('dmr-en', { studie: 'x', version: '1.0.0' }).profileId, 'dmr-de');
  assert.deepEqual(counterpartOf('dsreport', { studie: 'nac2018', ds: '1', lang: 'de', version: '3.0.0' }), {
    profileId: 'dsreport',
    values: { studie: 'nac2018', ds: '1', lang: 'en', version: '3.0.0' },
  });
  assert.equal(counterpartOf('instrument', { studie: 'sid2021' }), null);
  assert.equal(counterpartOf('generic', {}), null);
});

test('counterpart: identifier, language and relations switch, content and version stay', () => {
  const source = de();
  const { model } = makeCounterpart(source, 'dmr-de');

  assert.equal(model.identifier.value, '10.21249/DZHW:nac2018-dmr-en:3.0.0');
  assert.equal(model.language, 'en');
  assert.equal(model.version, source.version, 'versions stay coupled');
  assert.equal(model.publicationYear, source.publicationYear, 'year is taken from the source');
  assert.deepEqual(model.dates, source.dates);
  assert.deepEqual(model.creators, source.creators, 'creators including order');
  assert.deepEqual(model.rightsList, source.rightsList);
  assert.deepEqual(model.geoLocations, source.geoLocations);

  const rel = (m, type) => m.relatedIdentifiers.find((r) => r.relationType === type)?.value;
  assert.equal(rel(model, 'IsTranslationOf'), '10.21249/DZHW:nac2018-dmr-de:3.0.0', 'points back at the source');
  assert.equal(rel(model, 'IsPartOf'), '10.21249/DZHW:nac2018:3.0.0');
  assert.deepEqual(validate(model), []);
});

test('counterpart: the source texts are carried over, tagged with the target language and reported', () => {
  const source = de();
  const { model, pending } = makeCounterpart(source, 'dmr-de');

  assert.equal(model.titles[0].value, source.titles[0].value, 'text kept as a translation template');
  assert.equal(model.titles[0].lang, 'en');
  assert.deepEqual(pending.map((p) => p.label), ['Titel 1']);

  // As long as nothing is translated, the item stays pending; editing resolves it.
  assert.deepEqual(untranslated(model, pending).map((p) => p.label), ['Titel 1']);
  model.titles[0].value = 'Nacaps 2018. Data and methods report';
  assert.deepEqual(untranslated(model, pending), []);
});

test('counterpart: subjects in the source language are dropped, neutral ones stay', () => {
  const source = de();
  source.subjects = [
    { ...createSubject(), value: 'Hochschulforschung', lang: 'de' },
    { ...createSubject(), value: 'Higher Education Research', lang: 'en' },
    { ...createSubject(), value: 'EVALUATION', subjectScheme: 'ELSST', valueURI: 'https://thesauri.cessda.eu/x' },
  ];
  const { model } = makeCounterpart(source, 'dmr-de');
  assert.deepEqual(model.subjects.map((s) => s.value), ['Higher Education Research', 'EVALUATION']);
});

test('counterpart of the German fixture matches the English one in the neutral fields', () => {
  const { model } = makeCounterpart(de(), 'dmr-de');
  const english = en();
  const diffs = compareLanguageVersions(model, english).map((d) => d.path);
  assert.deepEqual(new Set(diffs), new Set([
    // Known data errors of dmr-en (docs/mapping.md, section 5).
    'creators[3].name',
    'creators[3].givenName',
    'creators[3].familyName',
    'creators[5].name',
    'creators[5].givenName',
    'creators[5].nameIdentifiers',
    'creators[8].affiliations',
    'publicationYear',
    'dates',
    // Intended: the counterpart follows today's conventions, the old record does not.
    'publisher.schemeURI',
    'resourceType.value',
  ]));
  assert.equal(model.publisher.schemeURI, 'https://ror.org/');
  assert.equal(model.resourceType.value, 'Data and Methods Report');
});

test('compareLanguageVersions finds the known differences between the fixtures', () => {
  const diffs = compareLanguageVersions(de(), en());
  const at = (path) => diffs.find((d) => d.path === path);

  // The fixtures are anonymised (tools/anonymize.js); the differences are the real ones, the names
  // are invented. The divergent spelling of the original became two unrelated given names.
  assert.deepEqual(at('creators[3].name'), { path: 'creators[3].name', a: 'Olive, Wicke', b: 'Wicke, Olive' });
  assert.deepEqual(at('creators[5].name'), { path: 'creators[5].name', a: 'Raute, Peter', b: 'Raute, Quirin' });
  assert.equal(at('creators[5].nameIdentifiers').a, '0 Einträge', 'ORCID missing in the German version');
  assert.equal(at('creators[8].affiliations').b, '0 Einträge', 'an affiliation missing in the English version');
  assert.deepEqual(at('publicationYear'), { path: 'publicationYear', a: '2025', b: '2026' });
  assert.ok(at('dates'), 'the English version has no dates');
  assert.ok(!diffs.some((d) => d.path.startsWith('titles')), 'titles are language-specific, not compared');
});

test('mergeNeutralFields only takes over neutral fields and reports the changes', () => {
  const target = en();
  const { model, changes } = mergeNeutralFields(target, de());

  assert.deepEqual(model.creators, de().creators, 'creators taken over');
  assert.equal(model.publicationYear, '2025');
  assert.equal(model.titles[0].value, target.titles[0].value, 'title untouched');
  assert.equal(model.language, 'en');
  assert.equal(model.identifier.value, target.identifier.value);
  assert.deepEqual(
    changes.map((c) => c.field).sort(),
    ['creators', 'dates', 'publicationYear'],
  );
  assert.deepEqual(compareLanguageVersions(model, de()), [], 'neutral fields are identical afterwards');
});

test('mergeNeutralFields leaves profile-owned fields alone', () => {
  const target = en();
  target.publisher.schemeURI = 'https://ror.org/'; // current convention
  target.resourceType.value = 'Data and Methods Report';
  const outdated = de();
  outdated.publisher.schemeURI = 'https://ror.org'; // old record
  outdated.resourceType.value = 'Data and Method Report';

  const { model, changes } = mergeNeutralFields(target, outdated, {
    skipFields: profiles['dmr-en'].locked, // publisher, resourceType, language, version
  });
  assert.equal(model.publisher.schemeURI, 'https://ror.org/', 'convention kept');
  assert.equal(model.resourceType.value, 'Data and Methods Report');
  assert.deepEqual(model.creators, outdated.creators, 'content still taken over');
  assert.ok(!changes.some((c) => ['publisher', 'resourceType', 'version'].includes(c.field)));
});

test('NEUTRAL_FIELDS excludes everything language-specific', () => {
  for (const key of ['identifier', 'titles', 'descriptions', 'language', 'relatedIdentifiers', 'subjects', 'extra']) {
    assert.ok(!NEUTRAL_FIELDS.includes(key), key);
  }
});

test('mergeFields takes over exactly the chosen fields', () => {
  const target = en();
  const source = de();
  const { model, changes } = mergeFields(target, source, ['creators', 'dates']);

  assert.deepEqual(model.creators, source.creators);
  assert.deepEqual(model.dates, source.dates);
  assert.equal(model.publicationYear, target.publicationYear, 'not chosen, so unchanged');
  assert.equal(model.titles[0].value, target.titles[0].value);
  assert.deepEqual(changes.map((c) => c.field), ['creators', 'dates']);
  assert.deepEqual(mergeFields(target, target, ['creators']).changes, [], 'identical values are no change');
});

test('filledFields lists only fields that hold something', () => {
  const filled = filledFields(de());
  assert.deepEqual(filled, ['creators', 'titles', 'dates', 'publicationYear', 'rightsList', 'geoLocations']);
  // The English fixture has no dates.
  assert.ok(!filledFields(en()).includes('dates'));
  assert.ok(!filled.includes('contributors'), 'the report has no contributors');
});

test('every transferable field has a German label', () => {
  for (const field of TRANSFERABLE_FIELDS) assert.ok(FIELD_LABELS[field], field);
});
