// Internal JSON data model for a DataCite 4.x resource.
//
// Conventions:
// - Plain JSON only (strings, arrays, objects, null), so a model can be saved/loaded as a file.
// - Every object always carries all of its keys; absent scalar values are ''.
//   Optional sub-objects (point, box, funderIdentifier, awardNumber) are null when absent.
// - Repeatable elements are arrays; their order is significant and preserved.
// - Attribute names follow the DataCite schema; xml:lang is stored as `lang`.
// - Element text is stored as `value` (or `name` for named entities).

export const KERNEL_NS = 'http://datacite.org/schema/kernel-4';
export const XSI_NS = 'http://www.w3.org/2001/XMLSchema-instance';
export const SCHEMA_LOCATION = `${KERNEL_NS} http://schema.datacite.org/meta/kernel-4/metadata.xsd`;

/** True if a value contains no non-empty string anywhere (e.g. an untouched form row). */
export function isBlank(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.every(isBlank);
  if (typeof v === 'object') return Object.values(v).every(isBlank);
  return false;
}

export const createNameIdentifier = () => ({ value: '', nameIdentifierScheme: '', schemeURI: '' });

export const createAffiliation = () => ({
  name: '',
  affiliationIdentifier: '',
  affiliationIdentifierScheme: '',
  schemeURI: '',
});

export const createCreator = () => ({
  name: '',
  nameType: '',
  lang: '',
  givenName: '',
  familyName: '',
  nameIdentifiers: [],
  affiliations: [],
});

export const createContributor = () => ({ contributorType: '', ...createCreator() });

export const createTitle = () => ({ value: '', titleType: '', lang: '' });

export const createSubject = () => ({
  value: '',
  subjectScheme: '',
  schemeURI: '',
  valueURI: '',
  classificationCode: '',
  lang: '',
});

export const createDate = () => ({ value: '', dateType: '', dateInformation: '' });

export const createAlternateIdentifier = () => ({ value: '', alternateIdentifierType: '' });

export const createRelatedIdentifier = () => ({
  value: '',
  relatedIdentifierType: '',
  relationType: '',
  resourceTypeGeneral: '',
  relatedMetadataScheme: '',
  schemeURI: '',
  schemeType: '',
  relationTypeInformation: '',
});

export const createRights = () => ({
  value: '',
  rightsURI: '',
  rightsIdentifier: '',
  rightsIdentifierScheme: '',
  schemeURI: '',
  lang: '',
});

// Line breaks (<br/>) inside a description are represented as '\n' in `value`.
export const createDescription = () => ({ value: '', descriptionType: '', lang: '' });

export const createPoint = () => ({ pointLongitude: '', pointLatitude: '' });

export const createBox = () => ({
  westBoundLongitude: '',
  eastBoundLongitude: '',
  southBoundLatitude: '',
  northBoundLatitude: '',
});

export const createPolygon = () => ({ polygonPoints: [], inPolygonPoint: null });

export const createGeoLocation = () => ({ place: '', point: null, box: null, polygons: [] });

export const createFunderIdentifier = () => ({ value: '', funderIdentifierType: '', schemeURI: '' });

export const createAwardNumber = () => ({ value: '', awardURI: '' });

export const createFundingReference = () => ({
  funderName: '',
  funderIdentifier: null,
  awardNumber: null,
  awardTitle: '',
});

export const createResource = () => ({
  identifier: { value: '', identifierType: 'DOI' },
  creators: [],
  titles: [],
  publisher: { name: '', publisherIdentifier: '', publisherIdentifierScheme: '', schemeURI: '', lang: '' },
  publicationYear: '',
  resourceType: { value: '', resourceTypeGeneral: '' },
  subjects: [],
  contributors: [],
  dates: [],
  language: '',
  alternateIdentifiers: [],
  relatedIdentifiers: [],
  sizes: [],
  formats: [],
  version: '',
  rightsList: [],
  descriptions: [],
  geoLocations: [],
  fundingReferences: [],
  // Top-level elements the model does not cover (e.g. relatedItems), kept verbatim as XML strings.
  extra: [],
});

// Factories for array items and optional sub-objects, keyed by property name.
const ITEM_FACTORIES = {
  creators: createCreator,
  contributors: createContributor,
  nameIdentifiers: createNameIdentifier,
  affiliations: createAffiliation,
  titles: createTitle,
  subjects: createSubject,
  dates: createDate,
  alternateIdentifiers: createAlternateIdentifier,
  relatedIdentifiers: createRelatedIdentifier,
  rightsList: createRights,
  descriptions: createDescription,
  geoLocations: createGeoLocation,
  polygons: createPolygon,
  polygonPoints: createPoint,
  fundingReferences: createFundingReference,
};
const OPTIONAL_FACTORIES = {
  point: createPoint,
  box: createBox,
  inPolygonPoint: createPoint,
  funderIdentifier: createFunderIdentifier,
  awardNumber: createAwardNumber,
};

function complete(template, partial) {
  const out = {};
  for (const [key, tpl] of Object.entries(template)) {
    const v = partial?.[key];
    if (Array.isArray(tpl)) {
      const make = ITEM_FACTORIES[key];
      const items = Array.isArray(v) ? v : [];
      out[key] = make ? items.map((item) => complete(make(), item)) : items.map((s) => String(s ?? ''));
    } else if (tpl === null) {
      out[key] = v ? complete(OPTIONAL_FACTORIES[key](), v) : null;
    } else if (typeof tpl === 'object') {
      out[key] = complete(tpl, v);
    } else {
      out[key] = v === undefined || v === null ? tpl : String(v);
    }
  }
  return out;
}

/**
 * Returns a model with the complete shape, filling everything missing from `partial`
 * with defaults. Unknown keys are dropped. Used for profile defaults and loaded JSON files.
 */
export const completeResource = (partial = {}) => complete(createResource(), partial);
