import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as ror from '../src/api/ror.js';
import * as orcid from '../src/api/orcid.js';
import { loadPeople, searchPeople, toPersonFields } from '../src/api/people.js';
import { collectPeople } from '../tools/people.js';
import { withCache } from '../src/ui/typeahead.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// Built from the fixtures, not read from data/Creators.json: that file holds personal data when
// it is generated from the real records and is therefore not part of the repository.
const people = collectPeople();

/** Minimal fetch stub returning a fixed JSON payload and recording the calls. */
const stubFetch = (payload, { ok = true, status = 200 } = {}) => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    return { ok, status, json: async () => payload };
  };
  return { fetchImpl, calls };
};

// --- ROR ----------------------------------------------------------------------

test('ROR: query builder uses AND and a trailing wildcard, and escapes input', () => {
  assert.equal(ror.buildQuery('Deutsches Zentrum Hochsch'), 'Deutsches AND Zentrum AND Hochsch*');
  assert.equal(ror.buildQuery('DZHW'), 'DZHW*');
  assert.equal(ror.buildQuery('uni (test):'), 'uni AND \\(test\\)\\:*');
  assert.equal(ror.buildQuery('ab'), null, 'below the minimum length');
  assert.equal(ror.buildQuery('   '), null);
});

test('ROR: search URL filters inactive organisations', () => {
  assert.equal(
    ror.searchUrl('Deutsches AND Hochsch*'),
    'https://api.ror.org/v2/organizations?query.advanced=Deutsches%20AND%20Hochsch*&filter=status:active',
  );
  assert.equal(ror.searchUrl('DZHW*', { activeOnly: false }), 'https://api.ror.org/v2/organizations?query.advanced=DZHW*');
});

test('ROR: maps an item to name, acronym, German label and place', () => {
  const item = {
    id: 'https://ror.org/01n8j6z65',
    status: 'active',
    names: [
      { value: 'DZHW', types: ['acronym'], lang: null },
      { value: 'Deutsches Zentrum für Hochschul- und Wissenschaftsforschung', types: ['label'], lang: 'de' },
      { value: 'German Centre for Higher Education Research and Science Studies', types: ['ror_display', 'label'], lang: 'en' },
    ],
    locations: [{ geonames_details: { name: 'Hanover', country_code: 'DE' } }],
  };
  assert.deepEqual(ror.mapOrganization(item), {
    id: 'https://ror.org/01n8j6z65',
    name: 'German Centre for Higher Education Research and Science Studies',
    acronym: 'DZHW',
    nameDe: 'Deutsches Zentrum für Hochschul- und Wissenschaftsforschung',
    place: 'Hanover, DE',
    status: 'active',
  });
});

test('ROR: short input makes no request, errors carry the status', async () => {
  const { fetchImpl, calls } = stubFetch({ items: [] });
  assert.deepEqual(await ror.searchOrganizations('ab', { fetchImpl }), []);
  assert.equal(calls.length, 0);

  const failing = stubFetch({}, { ok: false, status: 429 });
  await assert.rejects(() => ror.searchOrganizations('DZHW', { fetchImpl: failing.fetchImpl }), /HTTP 429/);
});

test('ROR: a client ID is sent as a header when configured', async () => {
  const { fetchImpl, calls } = stubFetch({ items: [] });
  await ror.searchOrganizations('DZHW', { fetchImpl, clientId: 'abc' });
  assert.deepEqual(calls[0].opts.headers, { 'Client-Id': 'abc' });
});

// --- ORCID ---------------------------------------------------------------------

test('ORCID: structured query quotes names with spaces and escapes Solr syntax', () => {
  assert.equal(orcid.buildQuery({ family: 'Carberry', given: 'Josiah' }, { prefix: false }), 'family-name:Carberry AND given-names:Josiah');
  assert.equal(orcid.buildQuery({ family: 'Müller' }, { prefix: true }), 'family-name:Müller*');
  // Names with spaces are quoted; a quoted phrase gets no wildcard.
  assert.equal(
    orcid.buildQuery({ family: 'de Vries', given: 'Anna' }, { prefix: true }),
    'family-name:"de Vries" AND given-names:Anna*',
  );
  assert.equal(orcid.buildQuery({ family: 'Weber(' }, { prefix: true }), 'family-name:Weber\\(*');
  assert.equal(orcid.buildQuery({ family: 'Weber(' }), 'family-name:Weber\\(');
  assert.equal(orcid.buildQuery({ family: 'ab' }), null);
});

test('ORCID: iDs are normalised and the check digit is verified locally', () => {
  assert.equal(orcid.normalizeId('https://orcid.org/0000-0002-1825-0097'), '0000-0002-1825-0097');
  assert.equal(orcid.normalizeId('0000000218250097'), '0000-0002-1825-0097');
  assert.equal(orcid.normalizeId('keine iD'), '');
  assert.equal(orcid.idToUri('0000-0002-1825-0097'), 'https://orcid.org/0000-0002-1825-0097');

  for (const id of ['0000-0002-1825-0097', '0000-0000-0000-0001', '0000-0000-0118-7859', '0000-0000-0031-676X']) {
    assert.equal(orcid.isValidId(id), true, id);
  }
  assert.equal(orcid.isValidId('0000-0002-1825-0098'), false, 'wrong check digit');
  assert.equal(orcid.isValidId('0000-0002-1825-0098'), false);
  assert.equal(orcid.isValidId('unsinn'), false);
});

test('ORCID: every ORCID iD in the fixtures passes the check digit', () => {
  for (const p of people) assert.equal(orcid.isValidId(p.orcid), true, p.orcid);
});

test('ORCID: maps expanded-search results', async () => {
  const payload = {
    'num-found': 1,
    'expanded-result': [{
      'orcid-id': '0000-0002-1825-0097',
      'given-names': 'Josiah',
      'family-names': 'Carberry',
      'credit-name': null,
      'institution-name': ['Deutsches Zentrum für Hochschul- und Wissenschaftsforschung GmbH'],
    }],
  };
  const { fetchImpl, calls } = stubFetch(payload);
  const result = await orcid.searchPeople({ family: 'Carberry', given: 'Josiah' }, { fetchImpl });
  assert.deepEqual(result, [{
    id: '0000-0002-1825-0097',
    uri: 'https://orcid.org/0000-0002-1825-0097',
    given: 'Josiah',
    family: 'Carberry',
    creditName: '',
    institutions: ['Deutsches Zentrum für Hochschul- und Wissenschaftsforschung GmbH'],
  }]);
  assert.match(calls[0].url, /expanded-search/);
  assert.equal(calls[0].opts.headers.Accept, 'application/json');
});

test('ORCID: fetchPerson rejects invalid iDs, returns null on 404', async () => {
  await assert.rejects(() => orcid.fetchPerson('0000-0002-1825-0098', { fetchImpl: stubFetch({}).fetchImpl }), /Prüfziffer/);
  const missing = stubFetch({}, { ok: false, status: 404 });
  assert.equal(await orcid.fetchPerson('0000-0002-1825-0097', { fetchImpl: missing.fetchImpl }), null);
  const found = stubFetch({ name: { 'given-names': { value: 'Josiah' }, 'family-name': { value: 'Carberry' } } });
  assert.deepEqual(await orcid.fetchPerson('0000-0002-1825-0097', { fetchImpl: found.fetchImpl }), {
    id: '0000-0002-1825-0097',
    uri: 'https://orcid.org/0000-0002-1825-0097',
    given: 'Josiah',
    family: 'Carberry',
  });
});

// --- local people list ----------------------------------------------------------

test('the people list comes from the fixtures and every entry names its source DOI', async () => {
  assert.ok(people.length >= 20, `only ${people.length} people`);
  // Where the list exists locally it has to match the generator; in a fresh clone it is absent.
  if (existsSync(join(ROOT, 'data/Creators.json'))) {
    const r = spawnSync(process.execPath, [join(ROOT, 'tools/people.js'), '--check'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr || r.stdout);
  }
  assert.deepEqual(await loadPeople(async () => ({ people: [{ name: 'Test' }] })), [{ name: 'Test' }]);
  assert.deepEqual(await loadPeople(async () => ({})), [], 'a file without people is no reason to fail');
  // Nothing without a public source: every entry names the registered DOIs it was read from.
  for (const p of people) {
    assert.ok(p.sources?.length, `${p.name} has no source DOI`);
    for (const doi of p.sources) assert.match(doi, /^10\.\d{4,9}\/\S+$/, `${p.name}: ${doi}`);
  }
});

test('local search matches every word, ignoring case and diacritics', () => {
  assert.deepEqual(searchPeople(people, 'zypresse dav').map((p) => p.name), ['Zypresse, David']);
  assert.deepEqual(searchPeople(people, 'weissdorn').map((p) => p.name), ['Weißdorn, Rita']);
  assert.deepEqual(searchPeople(people, '0000-0000-0000-0001').map((p) => p.name), ['Ginster, Klaus']);
  assert.deepEqual(searchPeople(people, 'gibtesnicht'), []);
});

test('local entries unify ORCID and ROR and map to model fields', () => {
  const [entry] = searchPeople(people, 'Lorbeer, Ulf');
  assert.equal(entry.orcid, 'https://orcid.org/0000-0000-0118-7859');
  const fields = toPersonFields(entry);
  assert.equal(fields.name, 'Lorbeer, Ulf');
  assert.equal(fields.nameType, 'Personal');
  assert.deepEqual(fields.nameIdentifiers, [
    { value: 'https://orcid.org/0000-0000-0118-7859', nameIdentifierScheme: 'ORCID', schemeURI: 'https://orcid.org' },
  ]);
  assert.deepEqual(fields.affiliations[0], {
    name: 'German Centre for Higher Education Research and Science Studies',
    affiliationIdentifier: 'https://ror.org/01n8j6z65',
    affiliationIdentifierScheme: 'ROR',
    schemeURI: 'https://ror.org/',
  });
});

// --- cache ----------------------------------------------------------------------

test('withCache reuses results per query', async () => {
  let calls = 0;
  const search = withCache(async (term) => {
    calls += 1;
    return [term];
  });
  assert.deepEqual(await search('dzhw'), ['dzhw']);
  assert.deepEqual(await search('dzhw'), ['dzhw']);
  await search('andere');
  assert.equal(calls, 2);
});
