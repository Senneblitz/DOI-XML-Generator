import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { dataPackageDoi, hasSubject, addSubjects } from '../src/model/datapackage.js';
import { parse } from '../src/xml/parse.js';
import { completeResource } from '../src/model/model.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const dom = { DOMParser, XMLSerializer };
const fixture = (f) => parse(readFileSync(join(ROOT, 'fixtures', f), 'utf8'), dom).model;

const withRelations = (relatedIdentifiers) => completeResource({ relatedIdentifiers });

test('dataPackageDoi finds the data package relation, current and legacy', () => {
  const dataset = { relatedIdentifierType: 'DOI', resourceTypeGeneral: 'Dataset', value: '10.21249/DZHW:nac2018:3.0.0' };
  assert.equal(dataPackageDoi(withRelations([{ ...dataset, relationType: 'IsPartOf' }])), '10.21249/DZHW:nac2018:3.0.0');
  assert.equal(dataPackageDoi(withRelations([{ ...dataset, relationType: 'IsSupplementTo' }])), '10.21249/DZHW:nac2018:3.0.0');
  // A series is also IsPartOf, but it is not a dataset.
  assert.equal(dataPackageDoi(withRelations([
    { relationType: 'IsPartOf', relatedIdentifierType: 'DOI', resourceTypeGeneral: 'Journal', value: '10.21249/es:wps' },
    { ...dataset, relationType: 'IsNewVersionOf' },
  ])), null);
  assert.equal(dataPackageDoi(withRelations([])), null);
});

test('the nac2018 fixture links its data package', () => {
  assert.equal(dataPackageDoi(fixture('nac2018-dmr-de_3.0.0.xml')), '10.21249/dzhw:nac2018:3.0.0');
});

test('addSubjects appends only what is missing, same term and scheme counts as present', () => {
  const model = completeResource({
    subjects: [{ value: 'Studium', subjectScheme: 'TheSoz', schemeURI: '', valueURI: '', classificationCode: '', lang: 'de' }],
  });
  const fromPackage = [
    { value: 'studium', subjectScheme: 'TheSoz', schemeURI: '', valueURI: '', classificationCode: '', lang: 'de' },
    { value: 'Promotion', subjectScheme: 'TheSoz', schemeURI: '', valueURI: '', classificationCode: '', lang: 'de' },
    { value: 'Studium', subjectScheme: '', schemeURI: '', valueURI: '', classificationCode: '', lang: 'de' },
  ];
  assert.equal(hasSubject(model, fromPackage[0]), true, 'same term and scheme, different case');
  assert.equal(hasSubject(model, fromPackage[2]), false, 'same term without a scheme is another subject');
  assert.equal(
    hasSubject(model, { ...fromPackage[0], lang: 'en' }),
    false,
    'the same term in the other language is another subject',
  );

  const { model: next, added } = addSubjects(model, fromPackage);
  assert.deepEqual(added.map((s) => s.value), ['Promotion', 'Studium']);
  assert.deepEqual(next.subjects.map((s) => `${s.value}|${s.subjectScheme}`), ['Studium|TheSoz', 'Promotion|TheSoz', 'Studium|']);
  assert.equal(model.subjects.length, 1, 'the original model is left alone');
  next.subjects[1].value = 'geändert';
  assert.equal(fromPackage[1].value, 'Promotion', 'the source entries are copied, not shared');
});
