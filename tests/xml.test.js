import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { parse, XmlParseError } from '../src/xml/parse.js';
import { serialize } from '../src/xml/serialize.js';
import { createResource, createCreator, createTitle, createSubject, createFundingReference } from '../src/model/model.js';
import { canonical } from './helpers/canonical.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const dom = { DOMParser, XMLSerializer };
const hasXmllint = spawnSync('xmllint', ['--version']).status === 0;
const FULL = readFileSync(join(ROOT, 'tests/data/full-kernel.xml'), 'utf8');

const wrap = (inner, rootAttrs = 'xmlns="http://datacite.org/schema/kernel-4"') =>
  `<?xml version="1.0" encoding="UTF-8"?><resource ${rootAttrs}>${inner}</resource>`;

// --- full kernel coverage ---------------------------------------------------

test('full-kernel: roundtrip is content-equivalent (br treated as line break)', () => {
  const { model, warnings } = parse(FULL, dom);
  assert.deepEqual(canonical(serialize(model), { brAsText: true }), canonical(FULL, { brAsText: true }));
  assert.equal(warnings.length, 1, 'only relatedItems should warn');
  assert.match(warnings[0], /relatedItems/);
});

test('full-kernel: serialized output validates against XSD', { skip: !hasXmllint && 'xmllint not on PATH' }, () => {
  const out = join(mkdtempSync(join(tmpdir(), 'datacite-full-')), 'full.xml');
  writeFileSync(out, serialize(parse(FULL, dom).model));
  const r = spawnSync('xmllint', ['--nonet', '--noout', '--schema', join(ROOT, 'schema/kernel-4.7/metadata.xsd'), out], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

test('full-kernel: fields are mapped into the model', () => {
  const { model: m } = parse(FULL, dom);
  assert.equal(m.creators[0].name, 'Beispiel & Partner <Forschung>');
  assert.equal(m.creators[0].lang, 'de');
  assert.equal(m.creators[1].nameIdentifiers.length, 2);
  assert.deepEqual(m.creators[1].affiliations[0], { name: 'Freitext-Institut ohne ID', affiliationIdentifier: '', affiliationIdentifierScheme: '', schemeURI: '' });
  assert.equal(m.titles[1].titleType, 'Subtitle');
  assert.equal(m.subjects[0].classificationCode, '300');
  assert.equal(m.contributors[1].contributorType, 'HostingInstitution');
  assert.equal(m.dates[1].dateInformation, 'Embargo end');
  assert.equal(m.alternateIdentifiers[0].value, 'https://example.org/record?id=1&v=2');
  assert.equal(m.relatedIdentifiers[1].relationTypeInformation, 'Test relation');
  assert.deepEqual(m.sizes, ['15 pages', '2 MB']);
  assert.equal(m.descriptions[0].value, 'First line.\nSecond line.');
  assert.deepEqual(m.geoLocations[0].point, { pointLongitude: '9.73322', pointLatitude: '52.37052' });
  assert.equal(m.geoLocations[1].box.northBoundLatitude, '55.06');
  assert.equal(m.geoLocations[2].polygons[0].polygonPoints.length, 4);
  assert.equal(m.geoLocations[2].polygons[0].inPolygonPoint.pointLatitude, '52.3');
  assert.equal(m.fundingReferences[0].funderIdentifier.funderIdentifierType, 'ROR');
  assert.equal(m.fundingReferences[0].awardNumber.awardURI, 'https://example.org/award/42');
  assert.equal(m.extra.length, 1);
  assert.match(m.extra[0], /^<relatedItems[\s>]/);
});

// --- parser -----------------------------------------------------------------

test('parse: malformed XML throws XmlParseError', () => {
  assert.throws(() => parse('<resource><titles></resource>', dom), XmlParseError);
});

test('parse: wrong root element throws XmlParseError', () => {
  assert.throws(() => parse('<?xml version="1.0"?><foo/>', dom), /erwartet <resource>/);
});

test('parse: foreign namespace produces a warning', () => {
  const { warnings } = parse(wrap('', 'xmlns="http://datacite.org/schema/kernel-3"'), dom);
  assert.match(warnings[0], /Namespace/);
});

test('parse: unknown nested element and attribute produce warnings', () => {
  const { model, warnings } = parse(
    wrap('<creators><creator foo="1"><creatorName>A</creatorName><bogus>x</bogus></creator></creators>'),
    dom,
  );
  assert.equal(model.creators[0].name, 'A');
  assert.equal(warnings.length, 2);
  assert.ok(warnings.some((w) => /Attribut foo/.test(w)));
  assert.ok(warnings.some((w) => /<bogus>/.test(w)));
});

test('parse: missing elements keep model defaults with complete shape', () => {
  const { model } = parse(wrap('<titles><title>T</title></titles>'), dom);
  const expected = createResource();
  expected.titles = [{ ...createTitle(), value: 'T' }];
  assert.deepEqual(model, expected);
});

test('parse: text is kept verbatim (no trimming)', () => {
  const { model } = parse(wrap('<titles><title>Ends with space </title></titles>'), dom);
  assert.equal(model.titles[0].value, 'Ends with space ');
});

// --- serializer -------------------------------------------------------------

test('serialize: escapes special characters in text and attributes', () => {
  const m = createResource();
  m.titles = [{ ...createTitle(), value: 'A & B <C> "D"' }];
  m.subjects = [{ ...createSubject(), value: 'x', valueURI: 'https://e.org/?a=1&b="2"' }];
  const xml = serialize(m);
  assert.match(xml, /<title>A &amp; B &lt;C&gt; "D"<\/title>/);
  assert.match(xml, /valueURI="https:\/\/e.org\/\?a=1&amp;b=&quot;2&quot;"/);
  assert.equal(parse(xml, dom).model.subjects[0].valueURI, 'https://e.org/?a=1&b="2"');
});

test('serialize: keeps $ in URLs unchanged', () => {
  const m = createResource();
  m.rightsList = [{ value: 'see https://x/stu-nac2018$?version=3.0.0', rightsURI: '', rightsIdentifier: '', rightsIdentifierScheme: '', schemeURI: '', lang: '' }];
  assert.match(serialize(m), /stu-nac2018\$\?version=3\.0\.0/);
});

test('serialize: blank rows and empty optional wrappers are omitted', () => {
  const m = createResource();
  m.subjects = [createSubject(), createSubject()];
  m.fundingReferences = [createFundingReference()];
  m.creators = [{ ...createCreator(), name: 'A', nameIdentifiers: [{ value: '', nameIdentifierScheme: '', schemeURI: '' }] }];
  const xml = serialize(m);
  assert.doesNotMatch(xml, /subjects|fundingReferences|sizes|formats|nameIdentifier/);
});

test('serialize: required elements are always present, attributes with empty values omitted', () => {
  const xml = serialize(createResource());
  for (const el of ['identifier', 'creators', 'titles', 'publisher', 'publicationYear', 'resourceType']) {
    assert.match(xml, new RegExp(`<${el}[ />]`), el);
  }
  assert.match(xml, /<resourceType\/>/);
  assert.match(xml, /<identifier identifierType="DOI"\/>/);
});

test('serialize: line breaks in descriptions are written as <br/> and parsed back', () => {
  const m = createResource();
  m.descriptions = [{ value: 'a & b\nc\r\nd', descriptionType: 'Abstract', lang: '' }];
  const xml = serialize(m);
  assert.match(xml, /<description descriptionType="Abstract">a &amp; b<br\/>c<br\/>d<\/description>/);
  assert.equal(parse(xml, dom).model.descriptions[0].value, 'a & b\nc\nd');
});

test('serialize: line breaks outside descriptions stay text', () => {
  const m = createResource();
  m.titles = [{ ...createTitle(), value: 'a\nb' }];
  assert.match(serialize(m), /<title>a\nb<\/title>/);
});
