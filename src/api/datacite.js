// DataCite REST API, read-only and without credentials.
//
// The stored XML (data.attributes.xml, base64) is used instead of content negotiation:
// it is the record as uploaded, while content negotiation re-serialises it and adds
// SPDX details to rights (see docs/mapping.md, section 2).

const ENDPOINT = 'https://api.datacite.org/dois';

/** Strips a resolver URL and surrounding whitespace: "https://doi.org/10.x/y" -> "10.x/y". */
export const normalizeDoi = (input) =>
  String(input).trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:/i, '');

export const doiUrl = (doi) => `${ENDPOINT}/${encodeURIComponent(normalizeDoi(doi))}`;

/** Decodes base64 to a UTF-8 string (atob alone would mangle umlauts). */
export function decodeBase64Xml(base64) {
  const binary = atob(String(base64).replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

/** Escapes the characters that carry meaning inside a query string value. */
const escapeQuery = (value) => String(value).replace(/([+\-&|!(){}[\]^"~*?:\\/])/g, '\\$1');

/** The version part of a DOI whose suffix ends in ":x.y.z", or '' when it has none. */
export const versionOf = (doi) => {
  const m = /:(\d+\.\d+\.\d+)$/.exec(normalizeDoi(doi));
  return m ? m[1] : '';
};

/**
 * All registered versions of a versioned DOI, newest last, each with its own DOI. Needed because
 * data packages are registered later than the documents that belong to them: the version a record
 * links to is often not published yet, and then an earlier one has to serve.
 * Returns [] when the DOI carries no version or the search finds nothing.
 */
export async function fetchVersions(doi, { fetchImpl = fetch, signal } = {}) {
  const id = normalizeDoi(doi);
  const slash = id.indexOf('/');
  const prefix = id.slice(0, slash);
  const suffix = id.slice(slash + 1);
  if (!versionOf(id)) return []; // nothing to enumerate without a version in the suffix
  const base = suffix.replace(/:[^:]*$/, '');

  const query = `suffix:${escapeQuery(base.toLowerCase())}\\:*`;
  const url = `${ENDPOINT}?query=${encodeURIComponent(query)}&page[size]=100&fields[dois]=doi,state`;
  const res = await fetchImpl(url, { signal, headers: { Accept: 'application/vnd.api+json' } });
  if (!res.ok) throw new Error(`DataCite-Suche fehlgeschlagen (HTTP ${res.status}).`);
  const body = await res.json();

  return (body?.data ?? [])
    .map((d) => ({ doi: d.attributes?.doi ?? d.id, state: d.attributes?.state ?? '' }))
    .filter((d) => d.state === 'findable' && d.doi?.toLowerCase().startsWith(`${prefix.toLowerCase()}/`))
    .map((d) => ({ ...d, version: versionOf(d.doi) }))
    .filter((d) => d.version);
}

/**
 * Fetches one DOI. Returns null when it is unknown (HTTP 404).
 * The result carries the stored XML, the record's state for the status line and the registered
 * landing page (`url`), which is not part of the metadata XML.
 */
export async function fetchDoi(doi, { fetchImpl = fetch, signal } = {}) {
  const id = normalizeDoi(doi);
  if (!/^10\.\d{4,9}\/\S+$/.test(id)) throw new Error(`„${doi}“ sieht nicht wie eine DOI aus.`);
  const res = await fetchImpl(doiUrl(id), { signal, headers: { Accept: 'application/vnd.api+json' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`DataCite-Abruf fehlgeschlagen (HTTP ${res.status}).`);
  const body = await res.json();
  const a = body?.data?.attributes ?? {};
  if (!a.xml) throw new Error('Der Datensatz enthält kein hinterlegtes XML.');
  return {
    doi: body.data.id ?? id,
    xml: decodeBase64Xml(a.xml),
    url: a.url ?? '',
    state: a.state ?? '',
    updated: a.updated ?? '',
    schemaVersion: a.schemaVersion ?? '',
  };
}
