// Language versions: create the counterpart of a record (German <-> English), take over
// language-neutral fields from the counterpart's DOI, and compare two language versions.
//
// Which fields are language-neutral follows the fixtures (docs/mapping.md, section 6):
// everything except identifier, titles, descriptions, language, the profile relations and
// subjects carrying the source language.

import { syncProfileFields } from './profile.js';

export const NEUTRAL_FIELDS = [
  'creators',
  'contributors',
  'publisher',
  'publicationYear',
  'resourceType',
  'dates',
  'alternateIdentifiers',
  'sizes',
  'formats',
  'version',
  'rightsList',
  'geoLocations',
  'fundingReferences',
];

const OTHER_LANG = { de: 'en', en: 'de' };
const COUNTERPART_PROFILE = { 'dmr-de': 'dmr-en', 'dmr-en': 'dmr-de' };

const clone = (v) => JSON.parse(JSON.stringify(v));

/** Language of a profile with a fixed language, or of the `lang` placeholder. */
export const languageOf = (profile, values = {}) => profile.defaults?.language?.replace(/^\{.*\}$/, values.lang ?? '') || values.lang || '';

/**
 * Determines the counterpart: the other language profile (dmr-de <-> dmr-en) or the same
 * profile with a flipped `lang` placeholder (dsreport). Returns null when there is none.
 */
export function counterpartOf(profileId, values = {}) {
  if (COUNTERPART_PROFILE[profileId]) {
    return { profileId: COUNTERPART_PROFILE[profileId], values: { ...values } };
  }
  if (values.lang && OTHER_LANG[values.lang]) {
    return { profileId, values: { ...values, lang: OTHER_LANG[values.lang] } };
  }
  return null;
}

/**
 * Builds the counterpart record: profile fields are switched to the target language,
 * language-neutral content is kept, titles and descriptions are carried over as a
 * translation template and reported in `pending`.
 *
 * Year and version stay as in the source (decision of 2026-09-22).
 */
export function createCounterpart(model, { targetProfile, targetValues, sourceLanguage, targetLanguage, now = new Date() }) {
  const copy = clone(model);

  // Drop subjects that are tied to the source language; keep neutral ones (e.g. thesaurus terms).
  copy.subjects = copy.subjects.filter((s) => !s.lang || s.lang !== sourceLanguage);

  // The texts stay, the language attribute already points at the target language.
  for (const item of [...copy.titles, ...copy.descriptions]) {
    if (!item.lang || item.lang === sourceLanguage) item.lang = targetLanguage;
  }

  syncProfileFields(copy, targetProfile, targetValues, { now });

  const pending = [
    ...copy.titles.map((t, i) => ({ path: `titles[${i}]`, label: `Titel ${i + 1}`, text: t.value })),
    ...copy.descriptions.map((d, i) => ({ path: `descriptions[${i}]`, label: `Beschreibung ${i + 1}`, text: d.value })),
  ].filter((p) => p.text.trim());

  return { model: copy, pending };
}

/** Which of the carried-over texts are still unchanged, i.e. not translated yet. */
export function untranslated(model, pending = []) {
  return pending.filter(({ path, text }) => {
    const [, key, index] = /^(\w+)\[(\d+)\]$/.exec(path) ?? [];
    return model[key]?.[Number(index)]?.value === text;
  });
}

// Fields that can be taken over from another record, in the order the panel lists them.
// Identifier, version, language and the profile relations are never part of it: they
// identify the record, and publisher, resourceType and version come from the profile.
export const TRANSFERABLE_FIELDS = [
  'creators',
  'contributors',
  'titles',
  'descriptions',
  'subjects',
  'dates',
  'publicationYear',
  'rightsList',
  'geoLocations',
  'fundingReferences',
  'alternateIdentifiers',
  'sizes',
  'formats',
];

export const FIELD_LABELS = {
  creators: 'Creators',
  contributors: 'Contributors',
  titles: 'Titel',
  descriptions: 'Beschreibungen',
  subjects: 'Schlagwörter',
  dates: 'Zeitangaben',
  publicationYear: 'Erscheinungsjahr',
  rightsList: 'Rechte',
  geoLocations: 'Orte',
  fundingReferences: 'Förderung',
  alternateIdentifiers: 'Alternative Identifier',
  sizes: 'Größenangaben',
  formats: 'Formate',
  publisher: 'Publisher',
  resourceType: 'Ressourcentyp',
  version: 'Version',
};

/** Short description of a field value for the panel and the change list. */
export const describeField = (value) => describe(value);

/** Fields of TRANSFERABLE_FIELDS that hold something in this record. */
export const filledFields = (model) => TRANSFERABLE_FIELDS.filter((key) => !isEmpty(model[key]));

const isEmpty = (value) => (Array.isArray(value) ? value.length === 0 : !String(value ?? '').trim());

/**
 * Takes over the named fields from another record. Returns the changed model and a list of
 * changes for the status line.
 */
export function mergeFields(target, source, fields) {
  const model = clone(target);
  const changes = [];
  for (const key of fields) {
    const before = JSON.stringify(model[key]);
    const after = JSON.stringify(source[key]);
    if (before === after) continue;
    model[key] = clone(source[key]);
    changes.push({ field: key, before: describe(target[key]), after: describe(source[key]) });
  }
  return { model, changes };
}

/**
 * Takes over the language-neutral fields from a counterpart.
 * Fields the profile owns (`skipFields`, from profile.locked) are left alone: otherwise an
 * older counterpart would drag its outdated conventions — publisher, resourceType — back in.
 */
export function mergeNeutralFields(target, source, { skipFields = [] } = {}) {
  const skip = new Set(skipFields.map((path) => path.split('.')[0]));
  return mergeFields(target, source, NEUTRAL_FIELDS.filter((key) => !skip.has(key)));
}

const describe = (value) => {
  if (Array.isArray(value)) return value.length === 1 ? '1 Eintrag' : `${value.length} Einträge`;
  if (value && typeof value === 'object') return value.name || value.value || '(leer)';
  return String(value ?? '') || '(leer)';
};

/**
 * Compares the language-neutral fields of two records and lists the differences —
 * the class of error the fixtures show (swapped names, a missing affiliation or ORCID).
 */
export function compareLanguageVersions(a, b) {
  const diffs = [];
  for (const key of NEUTRAL_FIELDS) diff(a[key], b[key], key, diffs);
  return diffs;
}

function diff(left, right, path, out) {
  if (JSON.stringify(left) === JSON.stringify(right)) return;
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      out.push({ path, a: `${left.length} Einträge`, b: `${right.length} Einträge` });
    }
    for (let i = 0; i < Math.min(left.length, right.length); i++) diff(left[i], right[i], `${path}[${i}]`, out);
    return;
  }
  if (left && right && typeof left === 'object' && typeof right === 'object') {
    for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
      diff(left[key], right[key], `${path}.${key}`, out);
    }
    return;
  }
  out.push({ path, a: String(left ?? ''), b: String(right ?? '') });
}
