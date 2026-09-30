import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { parse } from '../src/xml/parse.js';
import { validate } from '../src/model/validate.js';
import { createResource, createCreator, createTitle, createDate, createRelatedIdentifier, createGeoLocation, isBlank } from '../src/model/model.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const dom = { DOMParser, XMLSerializer };
const paths = (errors) => errors.map((e) => e.path);

test('isBlank', () => {
  assert.equal(isBlank(createCreator()), true);
  assert.equal(isBlank({ a: ' ', b: [], c: null, d: { e: '' } }), true);
  assert.equal(isBlank({ a: '', b: ['x'] }), false);
});

test('validate: empty resource reports all mandatory properties', () => {
  assert.deepEqual(paths(validate(createResource())), [
    'identifier',
    'creators',
    'titles',
    'publisher',
    'publicationYear',
    'resourceType.resourceTypeGeneral',
  ]);
});

test('validate: all reference fixtures pass', () => {
  for (const f of ['nac2018-dmr-de_3.0.0.xml', 'nac2018-dmr-en_3.0.0.xml', 'nac2018_3.0.0.xml']) {
    const { model } = parse(readFileSync(join(ROOT, 'fixtures', f), 'utf8'), dom);
    assert.deepEqual(validate(model), [], f);
  }
});

test('validate: blank rows are ignored, partially filled rows are checked', () => {
  const { model: m } = parse(readFileSync(join(ROOT, 'fixtures/nac2018-dmr-de_3.0.0.xml'), 'utf8'), dom);
  m.creators.push(createCreator());
  m.dates.push(createDate());
  m.relatedIdentifiers.push({ ...createRelatedIdentifier(), value: '10.5072/x' });
  m.creators[0].nameIdentifiers.push({ value: '0000-0002-1825-0097', nameIdentifierScheme: '', schemeURI: '' });
  assert.deepEqual(paths(validate(m)), [
    'creators[0].nameIdentifiers[0].nameIdentifierScheme',
    'relatedIdentifiers[4].relatedIdentifierType',
    'relatedIdentifiers[4].relationType',
  ]);
});

test('validate: geo locations need complete points and polygons with at least 4 points', () => {
  const m = createResource();
  m.geoLocations = [
    { ...createGeoLocation(), place: 'Hannover', point: { pointLongitude: '9.73', pointLatitude: '' } },
    {
      ...createGeoLocation(),
      box: { westBoundLongitude: '5.8', eastBoundLongitude: '15.0', southBoundLatitude: '47.2', northBoundLatitude: '' },
      polygons: [{ polygonPoints: [{ pointLongitude: '9', pointLatitude: '52' }], inPolygonPoint: null }],
    },
  ];
  assert.deepEqual(paths(validate(m)).filter((p) => p.startsWith('geoLocations')), [
    'geoLocations[0].point.pointLatitude',
    'geoLocations[1].box.northBoundLatitude',
    'geoLocations[1].polygons[0].polygonPoints',
  ]);
  // A complete geo location passes.
  const ok = createResource();
  ok.geoLocations = [{ ...createGeoLocation(), place: 'Hannover', point: { pointLongitude: '9.73', pointLatitude: '52.37' } }];
  assert.deepEqual(paths(validate(ok)).filter((p) => p.startsWith('geoLocations')), []);
});

test('validate: publicationYear must have four digits', () => {
  const m = createResource();
  Object.assign(m, {
    identifier: { value: '10.5072/x', identifierType: 'DOI' },
    creators: [{ ...createCreator(), name: 'A' }],
    titles: [{ ...createTitle(), value: 'T' }],
    publisher: { ...m.publisher, name: 'P' },
    resourceType: { value: '', resourceTypeGeneral: 'Dataset' },
  });
  m.publicationYear = '25';
  assert.deepEqual(paths(validate(m)), ['publicationYear']);
  m.publicationYear = '2025';
  assert.deepEqual(validate(m), []);
});
