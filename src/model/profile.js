// Document profiles: defaults, locked/recommended fields and DOI patterns (profiles/*.json).
//
// Profile JSON:
//   id, label, extends?          inheritance (deep merge; locked/recommended are united)
//   placeholders                 name -> { label, pattern, example, options?, optional? }
//   derived                      name -> { from, map }: computed from another placeholder
//   doi { prefix, suffix }       suffix with {placeholders}
//   resourceTypeGeneral          allowed values (first is the default)
//   resourceTypeLabels?          resourceTypeGeneral -> resourceType free text
//   defaults                     partial model; strings may contain {placeholders} and {currentYear}
//   relations                    relatedIdentifier templates; skipped while a placeholder is missing
//   locked, recommended          model paths (e.g. "publisher", "resourceType.resourceTypeGeneral")
//   series?                      true if a series (profiles/series.json) can be applied on top
//
// All functions are pure; loading is done by loadProfiles() with an injected JSON reader.

import { completeResource, createRelatedIdentifier, isBlank } from './model.js';

export const PROFILE_IDS = ['dmr-de', 'dmr-en', 'instrument', 'dsreport', 'paper', 'generic'];

const TOKEN = /\{(\w+)\}/g;
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function deepMerge(base, over) {
  if (!isObject(base) || !isObject(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = k in base ? deepMerge(base[k], v) : v;
  return out;
}

const union = (a = [], b = []) => [...new Set([...a, ...b])];

/** Merges a profile over its parent (or a series over a profile). */
function mergeProfiles(parent, child, { concatRelations = false } = {}) {
  const merged = deepMerge(parent, child);
  merged.locked = union(parent.locked, child.locked);
  merged.recommended = union(parent.recommended, child.recommended);
  merged.relations = concatRelations ? [...(parent.relations ?? []), ...(child.relations ?? [])] : child.relations ?? parent.relations ?? [];
  delete merged.extends;
  delete merged.abstract;
  return merged;
}

/** Resolves the `extends` chain. `byId` maps profile id -> raw profile JSON. */
export function resolveProfile(raw, byId) {
  if (!raw.extends) return mergeProfiles({}, raw);
  const parent = byId[raw.extends];
  if (!parent) throw new Error(`Profil „${raw.id}“ erbt von unbekanntem Profil „${raw.extends}“.`);
  return mergeProfiles(resolveProfile(parent, byId), raw);
}

/** Applies a series (entry of profiles/series.json) on top of a resolved profile. */
export function withSeries(profile, series) {
  if (!profile.series) throw new Error(`Profil „${profile.id}“ unterstützt keine Reihen.`);
  const merged = mergeProfiles(profile, { ...series, id: profile.id, label: `${profile.label}: ${series.label}` }, { concatRelations: true });
  merged.seriesId = series.id;
  delete merged.seriesDoi;
  return merged;
}

/** Loads and resolves all profiles and series. `readJson(path)` returns parsed JSON (async). */
export async function loadProfiles(readJson, dir = 'profiles') {
  const ids = ['base', ...PROFILE_IDS];
  const raw = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await readJson(`${dir}/${id}.json`)])));
  const profiles = Object.fromEntries(PROFILE_IDS.map((id) => [id, resolveProfile(raw[id], raw)]));
  const { series } = await readJson(`${dir}/series.json`);
  return { profiles, series };
}

// --- placeholders -------------------------------------------------------------

const tokensIn = (value, out = []) => {
  if (typeof value === 'string') for (const m of value.matchAll(TOKEN)) out.push(m[1]);
  else if (Array.isArray(value)) value.forEach((v) => tokensIn(v, out));
  else if (isObject(value)) Object.values(value).forEach((v) => tokensIn(v, out));
  return out;
};

/** Placeholders the user has to fill for this profile, in order of first use (DOI first). */
export function placeholdersOf(profile) {
  const derived = profile.derived ?? {};
  const names = [];
  for (const t of tokensIn([profile.doi.suffix, profile.defaults, profile.relations])) {
    const name = derived[t] ? derived[t].from : t;
    if (name !== 'currentYear' && !names.includes(name)) names.push(name);
  }
  return names.map((name) => {
    const def = profile.placeholders?.[name];
    if (!def) throw new Error(`Platzhalter {${name}} ist in Profil „${profile.id}“ nicht definiert.`);
    return { name, ...def, optional: Boolean(def.optional) };
  });
}

/** Checks placeholder values; returns a list of { name, message }. */
export function checkValues(profile, values) {
  const errors = [];
  for (const p of placeholdersOf(profile)) {
    const v = values[p.name] ?? '';
    if (v === '') {
      if (!p.optional) errors.push({ name: p.name, message: `${p.label} fehlt.` });
    } else if (!new RegExp(`^(?:${p.pattern})$`).test(v)) {
      errors.push({ name: p.name, message: `${p.label} „${v}“ hat nicht das erwartete Format (z. B. ${p.example}).` });
    }
  }
  return errors;
}

function expandValues(profile, values, now) {
  const all = { ...values, currentYear: String(now.getFullYear()) };
  for (const [name, d] of Object.entries(profile.derived ?? {})) {
    if (values[d.from] && d.map[values[d.from]]) all[name] = d.map[values[d.from]];
  }
  return all;
}

/** Replaces {tokens}; returns null if any token has no (non-empty) value. */
export function fill(template, values) {
  let missing = false;
  const s = template.replace(TOKEN, (_, name) => {
    const v = values[name];
    if (v === undefined || v === null || v === '') missing = true;
    return v ?? '';
  });
  return missing ? null : s;
}

const fillDeep = (value, values) => {
  if (typeof value === 'string') return fill(value, values) ?? '';
  if (Array.isArray(value)) return value.map((v) => fillDeep(v, values));
  if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fillDeep(v, values)]));
  return value;
};

// --- DOI ------------------------------------------------------------------------

/** Builds the DOI from placeholder values, or null while values are missing. */
export function buildDoi(profile, values, now = new Date()) {
  const suffix = fill(profile.doi.suffix, expandValues(profile, values, now));
  return suffix === null ? null : `${profile.doi.prefix}/${suffix}`;
}

/**
 * Builds the landing page URL, the address Fabrica registers for the DOI. It is not part of the
 * metadata XML (DataCite keeps it beside it), so the form only offers it for copying. Profiles
 * without an agreed pattern return null; see docs/mapping.md, section 6.
 */
export function buildLandingPage(profile, values, now = new Date()) {
  if (!profile.landingPage) return null;
  return fill(profile.landingPage, expandValues(profile, values, now));
}

/**
 * Extracts placeholder values from a DOI (case-insensitive, as DOIs are).
 * Returns values in lower case, or null if the DOI does not match the profile's pattern.
 */
export function parseDoi(doi, profile) {
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const names = [];
  const source = `${escape(profile.doi.prefix)}/${profile.doi.suffix
    .split(TOKEN)
    .map((part, i) => {
      if (i % 2 === 0) return escape(part);
      names.push(part);
      return `(${profile.placeholders[part].pattern})`;
    })
    .join('')}`;
  const m = new RegExp(`^${source}$`, 'i').exec(doi.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, ''));
  if (!m) return null;
  return Object.fromEntries(names.map((n, i) => [n, m[i + 1].toLowerCase()]));
}

// --- apply / check --------------------------------------------------------------

/** Label for resourceType when the user picks a resourceTypeGeneral (null = keep free text). */
export const resourceTypeLabel = (profile, general) => profile.resourceTypeLabels?.[general] ?? null;

/**
 * Creates a new model from a profile and placeholder values.
 * Missing values leave the affected fields empty and skip the affected relations.
 */
export function applyProfile(profile, values = {}, { now = new Date() } = {}) {
  const all = expandValues(profile, values, now);
  const model = completeResource(fillDeep(profile.defaults, all));
  model.identifier.value = buildDoi(profile, values, now) ?? '';
  const relations = (profile.relations ?? [])
    .map((r) => ({ ...r, value: fill(r.value, all) }))
    .filter((r) => r.value !== null)
    .map((r) => ({ ...createRelatedIdentifier(), ...r }));
  model.relatedIdentifiers = [...model.relatedIdentifiers, ...relations];
  return model;
}

/**
 * Updates the profile-managed parts of an existing model in place: identifier, locked fields
 * (unless deliberately unlocked) and the relations coming from the profile. Everything the
 * user entered — creators, titles, descriptions, extra relations — is kept.
 *
 * Used when a placeholder changes and when a new version is created.
 */
export function syncProfileFields(model, profile, values, { unlocked = new Set(), now = new Date() } = {}) {
  const fresh = applyProfile(profile, values, { now });
  model.identifier.value = fresh.identifier.value;
  for (const path of profile.locked ?? []) {
    if (unlocked.has(path)) continue;
    const [head, ...rest] = path.split('.');
    if (rest.length === 0) model[head] = fresh[head];
    else model[head][rest[0]] = fresh[head][rest[0]];
  }
  const fromProfile = new Set((profile.relations ?? []).map((r) => r.relationType));
  const manual = model.relatedIdentifiers.filter((r) => !fromProfile.has(r.relationType));
  model.relatedIdentifiers = [...fresh.relatedIdentifiers, ...manual];
  return model;
}

// Relation types that today's profile relation replaces (docs/mapping.md, section 6):
// before the decision, the link to the data package was IsSupplementTo.
const LEGACY_EQUIVALENTS = { IsPartOf: ['IsSupplementTo'] };

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Regex for a relation template with the current placeholder values; version placeholders
 * stay open, so a link to another version of the same target still matches.
 */
function templateRegex(template, profile, values) {
  const source = template
    .split(TOKEN)
    .map((part, i) => {
      if (i % 2 === 0) return escapeRe(part);
      const open = part === 'version' || part === 'previousVersion' || !values[part];
      return open ? `(?:${profile.placeholders[part].pattern})` : escapeRe(values[part]);
    })
    .join('');
  return new RegExp(`^${source}$`, 'i');
}

/**
 * Cleans up relations that were carried over from an older record:
 * - a legacy relation to a target the profile now links itself (IsSupplementTo -> IsPartOf)
 *   is dropped, because the profile relation already covers it;
 * - in the remaining relations the previous version is replaced by the current one,
 *   e.g. an attachment URL carrying `…-5.0.0/…`.
 *
 * Returns what happened, so the form can report it.
 */
export function reconcileRelations(model, profile, values) {
  const templates = profile.relations ?? [];
  const fromProfile = new Set(templates.map((r) => r.relationType));
  const patterns = templates.map((t) => ({ type: t.relationType, regex: templateRegex(t.value, profile, values) }));
  const { version, previousVersion } = values;
  const removed = [];
  const retargeted = [];
  const kept = [];

  for (const relation of model.relatedIdentifiers) {
    if (fromProfile.has(relation.relationType)) {
      kept.push(relation);
      continue;
    }
    const superseded = patterns.find(
      (p) => (LEGACY_EQUIVALENTS[p.type] ?? []).includes(relation.relationType) && p.regex.test(String(relation.value).trim()),
    );
    if (superseded) {
      removed.push({ relationType: relation.relationType, value: relation.value, replacedBy: superseded.type });
      continue;
    }
    if (previousVersion && version && String(relation.value).includes(previousVersion)) {
      const before = relation.value;
      relation.value = String(relation.value).split(previousVersion).join(version);
      retargeted.push({ relationType: relation.relationType, before, after: relation.value });
    }
    kept.push(relation);
  }

  model.relatedIdentifiers = kept;
  return { removed, retargeted };
}

export const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

/**
 * Compares a model with its profile. Returns a list of
 * { type: 'locked' | 'recommended' | 'resourceTypeGeneral', path, message }.
 */
export function checkProfile(model, profile, values = {}, { now = new Date() } = {}) {
  const issues = [];
  const expected = applyProfile(profile, values, { now });
  for (const path of profile.locked ?? []) {
    if (JSON.stringify(getPath(model, path)) !== JSON.stringify(getPath(expected, path))) {
      issues.push({ type: 'locked', path, message: `${path} weicht von der Profilvorgabe ab.` });
    }
  }
  for (const path of profile.recommended ?? []) {
    if (isBlank(getPath(model, path))) issues.push({ type: 'recommended', path, message: `${path} ist empfohlen, aber leer.` });
  }
  const mismatch = typeMismatch(model, profile);
  if (mismatch) {
    issues.push({
      type: 'resourceTypeGeneral',
      path: 'resourceType.resourceTypeGeneral',
      message: `resourceTypeGeneral „${mismatch.actual}“ ist im Profil nicht vorgesehen (${mismatch.allowed.join(', ')}).`,
    });
  }
  return issues;
}

/**
 * Compares a record's type with the document type the profile builds. Returns what was found and
 * what the profile allows, or null when the type fits or one of the two says nothing.
 */
export function typeMismatch(model, profile) {
  const actual = model?.resourceType?.resourceTypeGeneral ?? '';
  const allowed = profile?.resourceTypeGeneral ?? [];
  if (!actual || !allowed.length || allowed.includes(actual)) return null;
  return { actual, value: model.resourceType.value ?? '', allowed };
}
