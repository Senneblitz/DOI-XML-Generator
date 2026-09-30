// ORCID Public API v3.0, read-only and without authentication (see docs/spike.md).
// Structured search by family and given name. Unescaped Solr syntax makes the API answer
// with HTTP 500, so all input is escaped.

const ENDPOINT = 'https://pub.orcid.org/v3.0';

const SPECIAL = /[+\-&|!(){}[\]^"~*?:\\/]/g;

export const escapeSolr = (s) => s.replace(SPECIAL, (c) => `\\${c}`);

/** Quotes a value that contains spaces, so "de Vries" stays one term. */
const term = (v, { prefix = false } = {}) => {
  const escaped = escapeSolr(v.trim());
  if (/\s/.test(v.trim())) return `"${escaped}"`;
  return prefix ? `${escaped}*` : escaped;
};

/**
 * Builds the Solr query for a structured name search.
 * `prefix` adds a trailing wildcard, for searching while typing.
 */
export function buildQuery({ family = '', given = '' }, { prefix = false, minLength = 3 } = {}) {
  const parts = [];
  if (family.trim()) parts.push(`family-name:${term(family, { prefix })}`);
  if (given.trim()) parts.push(`given-names:${term(given, { prefix })}`);
  if (!parts.length || `${family}${given}`.replace(/\s/g, '').length < minLength) return null;
  return parts.join(' AND ');
}

export const searchUrl = (query, rows = 10) => `${ENDPOINT}/expanded-search/?rows=${rows}&q=${encodeURIComponent(query)}`;
export const personUrl = (id) => `${ENDPOINT}/${normalizeId(id)}/person`;

/** ORCID iD as a bare identifier (0000-0002-1825-0097), or '' if it cannot be read. */
export function normalizeId(input) {
  const m = String(input).trim().match(/(\d{4})-?(\d{4})-?(\d{4})-?(\d{3}[\dX])$/i);
  return m ? `${m[1]}-${m[2]}-${m[3]}-${m[4].toUpperCase()}` : '';
}

export const idToUri = (input) => {
  const id = normalizeId(input);
  return id ? `https://orcid.org/${id}` : '';
};

/**
 * Checks the ORCID check digit (ISO 7064 MOD 11-2), locally and without a request.
 */
export function isValidId(input) {
  const id = normalizeId(input);
  if (!id) return false;
  const digits = id.replace(/-/g, '');
  let total = 0;
  for (const c of digits.slice(0, 15)) total = (total + Number(c)) * 2;
  const expected = (12 - (total % 11)) % 11;
  const check = digits[15] === 'X' ? 10 : Number(digits[15]);
  return expected === check;
}

/** Maps one expanded-search result to the fields the form needs. */
export const mapResult = (r) => ({
  id: r['orcid-id'] ?? '',
  uri: idToUri(r['orcid-id'] ?? ''),
  given: r['given-names'] ?? '',
  family: r['family-names'] ?? '',
  creditName: r['credit-name'] ?? '',
  institutions: r['institution-name'] ?? [],
});

/** Structured search for people. Returns [] when the input is too short. */
export async function searchPeople(name, { fetchImpl = fetch, signal, prefix = true, rows = 10 } = {}) {
  const query = buildQuery(name, { prefix });
  if (!query) return [];
  const res = await fetchImpl(searchUrl(query, rows), { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`ORCID-Suche fehlgeschlagen (HTTP ${res.status}).`);
  const data = await res.json();
  return (data['expanded-result'] ?? []).map(mapResult);
}

/** Looks up a single iD; returns null when it is unknown (HTTP 404). */
export async function fetchPerson(id, { fetchImpl = fetch, signal } = {}) {
  if (!isValidId(id)) throw new Error('ORCID iD ist ungültig (Prüfziffer stimmt nicht).');
  const res = await fetchImpl(personUrl(id), { signal, headers: { Accept: 'application/json' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`ORCID-Abruf fehlgeschlagen (HTTP ${res.status}).`);
  const data = await res.json();
  return {
    id: normalizeId(id),
    uri: idToUri(id),
    given: data.name?.['given-names']?.value ?? '',
    family: data.name?.['family-name']?.value ?? '',
  };
}
