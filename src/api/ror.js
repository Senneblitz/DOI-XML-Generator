// ROR API v2, read-only. See docs/spike.md: `query` matches whole words only, so type-ahead
// uses `query.advanced` (Elasticsearch query string) with AND between words and a trailing
// wildcard on the word being typed. Input must be escaped.

const ENDPOINT = 'https://api.ror.org/v2/organizations';

// Characters with a special meaning in the Elasticsearch query string syntax.
const SPECIAL = /[+\-=&|><!(){}[\]^"~*?:\\/]/g;

export const escapeQuery = (s) => s.replace(SPECIAL, (c) => `\\${c}`);

/**
 * Builds the query.advanced expression: every word must match, the last one as a prefix.
 * Returns null when the input is too short to search for.
 */
export function buildQuery(input, { minLength = 3 } = {}) {
  const words = String(input).trim().split(/\s+/).filter(Boolean);
  if (!words.length || words.join('').length < minLength) return null;
  return words
    .map((w, i) => (i === words.length - 1 ? `${escapeQuery(w)}*` : escapeQuery(w)))
    .join(' AND ');
}

export const searchUrl = (query, { activeOnly = true } = {}) =>
  `${ENDPOINT}?query.advanced=${encodeURIComponent(query)}${activeOnly ? '&filter=status:active' : ''}`;

const nameOf = (org, type) => org.names?.find((n) => n.types?.includes(type))?.value ?? '';
const labelIn = (org, lang) => org.names?.find((n) => n.types?.includes('label') && n.lang === lang)?.value ?? '';

/** Maps one ROR item to the fields the form needs. */
export function mapOrganization(org) {
  const place = org.locations?.[0]?.geonames_details;
  return {
    id: org.id,
    name: nameOf(org, 'ror_display'),
    acronym: nameOf(org, 'acronym'),
    nameDe: labelIn(org, 'de'),
    place: place ? [place.name, place.country_code].filter(Boolean).join(', ') : '',
    status: org.status ?? '',
  };
}

/**
 * Searches organisations. Returns [] for input that is too short.
 * `fetchImpl`, `signal` and `clientId` are injected so this stays testable and abortable.
 */
export async function searchOrganizations(input, { fetchImpl = fetch, signal, clientId = '' } = {}) {
  const query = buildQuery(input);
  if (!query) return [];
  const headers = clientId ? { 'Client-Id': clientId } : undefined;
  const res = await fetchImpl(searchUrl(query), { signal, headers });
  if (!res.ok) throw new Error(`ROR-Suche fehlgeschlagen (HTTP ${res.status}).`);
  const data = await res.json();
  return (data.items ?? []).map(mapOrganization);
}
