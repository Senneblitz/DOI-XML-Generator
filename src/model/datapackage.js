// The data package a record belongs to. Data packages are registered elsewhere; here they are
// only read, e.g. to reuse their subjects. Which relation points to the data package follows the
// decision in docs/mapping.md, section 6: IsPartOf to a DOI typed as Dataset. Records taken over
// from older registrations may still carry the former IsSupplementTo.

const clone = (v) => JSON.parse(JSON.stringify(v));

const DATA_PACKAGE_RELATIONS = ['IsPartOf', 'IsSupplementTo'];

/** DOI of the linked data package, or null when the record has no such relation. */
export function dataPackageDoi(model) {
  const rel = (model?.relatedIdentifiers ?? []).find(
    (r) => DATA_PACKAGE_RELATIONS.includes(r.relationType)
      && r.relatedIdentifierType === 'DOI'
      && r.resourceTypeGeneral === 'Dataset'
      && String(r.value ?? '').trim(),
  );
  return rel ? rel.value.trim() : null;
}

// Identity of a subject: the same term in the same scheme and language. The language belongs to
// it, because data packages carry their subjects in German and English side by side.
const subjectKey = (s) => [s.value, s.subjectScheme, s.valueURI, s.lang]
  .map((part) => String(part ?? '').trim().toLowerCase())
  .join('|');

/** True when the record already holds this subject. */
export const hasSubject = (model, subject) =>
  (model.subjects ?? []).some((s) => subjectKey(s) === subjectKey(subject));

/**
 * Appends the given subjects, skipping the ones already present. Returns the changed model and
 * the subjects that were added.
 */
export function addSubjects(model, subjects) {
  const next = { ...model, subjects: [...(model.subjects ?? [])] };
  const added = [];
  for (const subject of subjects) {
    if (hasSubject(next, subject)) continue;
    const copy = clone(subject);
    next.subjects.push(copy);
    added.push(copy);
  }
  return { model: next, added };
}
