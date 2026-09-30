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
