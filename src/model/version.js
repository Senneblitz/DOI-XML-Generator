// Version handling for "create a new version": bump the version, keep the old one as the
// predecessor. The profile then rebuilds identifier, version and relations from these values
// (see syncProfileFields in profile.js).

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

export const PARTS = ['major', 'minor', 'patch'];

/** "3.0.0" + major -> "4.0.0", + minor -> "3.1.0", + patch -> "3.0.1". */
export function bumpVersion(version, part = 'major') {
  const m = SEMVER.exec(String(version).trim());
  if (!m) throw new Error(`„${version}“ ist keine Version im Format x.y.z.`);
  if (!PARTS.includes(part)) throw new Error(`Unbekannter Versionsteil „${part}“.`);
  const [major, minor, patch] = m.slice(1).map(Number);
  if (part === 'major') return `${major + 1}.0.0`;
  if (part === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

/**
 * Placeholder values for the next version: the new version, and the current one as
 * `previousVersion` so the profile can add the IsNewVersionOf relation.
 */
export function nextVersionValues(values, part = 'major') {
  const current = values.version;
  if (!current) throw new Error('Die aktuelle Version ist unbekannt.');
  return { ...values, version: bumpVersion(current, part), previousVersion: current };
}

/**
 * The version that most likely precedes this one: 6.0.0 -> 5.0.0, 6.1.0 -> 6.0.0,
 * 6.0.1 -> 6.0.0. Returns null for a first version (1.0.0) or an unusable value.
 * Only a suggestion — versions can be skipped, so the tool never fills it in silently.
 */
export function previousVersionGuess(version) {
  const m = SEMVER.exec(String(version ?? '').trim());
  if (!m) return null;
  const [major, minor, patch] = m.slice(1).map(Number);
  if (patch > 0) return `${major}.${minor}.${patch - 1}`;
  if (minor > 0) return `${major}.${minor - 1}.0`;
  if (major > 1) return `${major - 1}.0.0`;
  return null;
}

/**
 * Finds relations that still carry the previous version although they are not the
 * IsNewVersionOf link to it — for example the attachment URL of a data package.
 * The tool does not rewrite them (they are single cases), it points them out.
 */
export function staleVersionRelations(model, { previousVersion }) {
  if (!previousVersion) return [];
  return model.relatedIdentifiers.filter(
    (r) => r.relationType !== 'IsNewVersionOf' && String(r.value).includes(previousVersion),
  );
}
