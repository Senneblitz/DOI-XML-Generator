// Save file format and file names. DOM-free so it can be tested with node --test.

import { completeResource } from '../model/model.js';

export const SAVE_FORMAT = 'fdz-dzhw-datacite-maker';
export const SAVE_VERSION = 1;

/**
 * Builds the JSON save state (profile, series, placeholder values, model) including the review
 * state of taken-over fields. `taken` is optional: a file without it simply has nothing reviewed,
 * which is why it does not raise the format version.
 */
export function toSaveState({ profileId, seriesId = null, values = {}, model, taken = {}, landing = null }) {
  return {
    format: SAVE_FORMAT,
    formatVersion: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    profileId,
    seriesId,
    values,
    model,
    taken,
    landing,
  };
}

/** Keeps only entries that look like a review state; anything else in the file is dropped. */
function readTaken(taken) {
  if (!taken || typeof taken !== 'object' || Array.isArray(taken)) return {};
  const result = {};
  for (const [field, entry] of Object.entries(taken)) {
    if (!entry || typeof entry !== 'object') continue;
    if (typeof entry.doi !== 'string' || !entry.doi) continue;
    const marks = (list) => (Array.isArray(list) ? list.filter((fp) => typeof fp === 'string') : []);
    result[field] = {
      doi: entry.doi,
      approved: entry.approved === true,
      source: typeof entry.source === 'string' ? entry.source : '',
      items: Array.isArray(entry.items) ? marks(entry.items) : null,
      approvedItems: marks(entry.approvedItems),
    };
  }
  return result;
}

/** Reads a save state; throws on a foreign or newer file. Missing model parts are filled in. */
export function fromSaveState(data) {
  if (!data || data.format !== SAVE_FORMAT) throw new Error('Keine Speicherdatei dieses Werkzeugs.');
  if (data.formatVersion > SAVE_VERSION) {
    throw new Error(`Speicherstand hat Version ${data.formatVersion}, unterstützt wird ${SAVE_VERSION}.`);
  }
  return {
    profileId: data.profileId ?? 'generic',
    seriesId: data.seriesId ?? null,
    values: data.values ?? {},
    model: completeResource(data.model ?? {}),
    taken: readTaken(data.taken),
    landing: typeof data.landing === 'string' ? data.landing : null,
  };
}

/**
 * File name derived from the DOI suffix: 10.21249/DZHW:nac2018-dmr-de:3.0.0
 * -> dzhw_nac2018-dmr-de_3.0.0.xml
 */
export function fileNameFor(doi, extension) {
  const suffix = String(doi || '').split('/').slice(1).join('/');
  const base = (suffix || 'datacite')
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${base || 'datacite'}.${extension}`;
}
