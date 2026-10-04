// Form application: profile selection, all fields from docs/mapping.md, live XML preview,
// check list, file actions (XML download, JSON save/load, open local XML), loading a
// registered DOI from DataCite and creating a new version.

import {
  createCreator,
  createContributor,
  createNameIdentifier,
  createAffiliation,
  createTitle,
  createSubject,
  createDate,
  createAlternateIdentifier,
  createRelatedIdentifier,
  createRights,
  createDescription,
  createGeoLocation,
  createPoint,
  createBox,
  createPolygon,
  createFundingReference,
  createFunderIdentifier,
  createAwardNumber,
} from '../model/model.js';
import { validate } from '../model/validate.js';
import { VOCAB } from '../model/vocab.js';
import {
  loadProfiles,
  applyProfile,
  checkProfile,
  checkValues,
  placeholdersOf,
  buildDoi,
  parseDoi,
  withSeries,
  resourceTypeLabel,
  syncProfileFields,
  reconcileRelations,
  typeMismatch,
  buildLandingPage,
  PROFILE_IDS,
} from '../model/profile.js';
import { parse } from '../xml/parse.js';
import { serialize } from '../xml/serialize.js';
import { validateAgainstSchema } from '../xml/validate-schema.js';
import { h, renderFields, renderGroup, renderStringGroup, applyPendingFocus, focusAfterRender, setFieldEnhancer } from './fields.js';
import { toSaveState, fromSaveState, fileNameFor } from './storage.js';
import { attachTypeahead, withCache } from './typeahead.js';
import { searchOrganizations } from '../api/ror.js';
import { searchPeople as searchOrcid, fetchPerson, isValidId, idToUri, normalizeId } from '../api/orcid.js';
import { loadPeople, searchPeople as searchLocalPeople, toPersonFields } from '../api/people.js';
import { fetchDoi, fetchVersions, versionOf } from '../api/datacite.js';
import {
  bumpVersion,
  nextVersionValues,
  staleVersionRelations,
  previousVersionGuess,
  compareVersions,
  bestAvailableVersion,
} from '../model/version.js';
import { dataPackageDoi, hasSubject, addSubjects } from '../model/datapackage.js';
import {
  markTaken,
  markTakenEntries,
  approveTaken,
  approveItem,
  reviewOf,
  itemReview,
  pendingTaken,
  fingerprint,
} from '../model/takeover.js';
import {
  counterpartOf,
  createCounterpart,
  untranslated,
  mergeFields,
  compareLanguageVersions,
  filledFields,
  describeField,
  FIELD_LABELS,
  NEUTRAL_FIELDS,
} from '../model/translate.js';

const NAME_FIELDS = (nameLabel) => [
  { key: 'name', label: nameLabel, wide: true, suggest: 'person' },
  { key: 'nameType', label: 'Namenstyp', type: 'select', options: VOCAB.nameType },
  { key: 'givenName', label: 'Vorname' },
  { key: 'familyName', label: 'Nachname' },
  { key: 'lang', label: 'Sprache (xml:lang)', type: 'lang' },
];

const POINT_FIELDS = [
  { key: 'pointLongitude', label: 'Länge (-180 bis 180)' },
  { key: 'pointLatitude', label: 'Breite (-90 bis 90)' },
];

const NAME_ID_SUB = {
  key: 'nameIdentifiers',
  label: 'Personen-/Organisations-IDs',
  itemLabel: 'ID',
  factory: createNameIdentifier,
  fields: [
    { key: 'value', label: 'ID (z. B. https://orcid.org/…)', wide: true, suggest: 'orcid' },
    { key: 'nameIdentifierScheme', label: 'Schema' },
    { key: 'schemeURI', label: 'Schema-URI' },
  ],
};

const AFFILIATION_SUB = {
  key: 'affiliations',
  label: 'Affiliationen',
  itemLabel: 'Affiliation',
  factory: createAffiliation,
  fields: [
    { key: 'name', label: 'Name', wide: true, suggest: 'ror' },
    { key: 'affiliationIdentifier', label: 'ROR-ID' },
    { key: 'affiliationIdentifierScheme', label: 'Schema' },
    { key: 'schemeURI', label: 'Schema-URI' },
  ],
};

// Sections of the form; `path` is the model path used for the profile's locked fields.
const SECTIONS = [
  {
    id: 'creators',
    title: 'Creators (Reihenfolge ist zitationsrelevant)',
    path: 'creators',
    group: { key: 'creators', label: 'Creators', itemLabel: 'Creator', factory: createCreator, fields: NAME_FIELDS('Name („Nachname, Vorname“)'), sublists: [NAME_ID_SUB, AFFILIATION_SUB] },
  },
  {
    id: 'titles',
    title: 'Titel',
    path: 'titles',
    group: { key: 'titles', label: 'Titel', itemLabel: 'Titel', factory: createTitle, fields: [
      { key: 'value', label: 'Titel', wide: true },
      { key: 'titleType', label: 'Titeltyp', type: 'select', options: VOCAB.titleType },
      { key: 'lang', label: 'Sprache (xml:lang)', type: 'lang' },
    ] },
  },
  {
    id: 'descriptions',
    title: 'Beschreibungen',
    path: 'descriptions',
    group: { key: 'descriptions', label: 'Beschreibungen', itemLabel: 'Beschreibung', factory: createDescription, fields: [
      { key: 'value', label: 'Text (Zeilenumbrüche werden zu <br/>)', type: 'textarea', wide: true },
      { key: 'descriptionType', label: 'Typ', type: 'select', options: VOCAB.descriptionType },
      { key: 'lang', label: 'Sprache (xml:lang)', type: 'lang' },
    ] },
  },
  {
    id: 'subjects',
    title: 'Schlagwörter',
    path: 'subjects',
    actions: () => subjectActions(),
    group: { key: 'subjects', label: 'Schlagwörter', itemLabel: 'Schlagwort', factory: createSubject, fields: [
      { key: 'value', label: 'Schlagwort', wide: true },
      { key: 'subjectScheme', label: 'Thesaurus' },
      { key: 'schemeURI', label: 'Thesaurus-URI' },
      { key: 'valueURI', label: 'Begriffs-URI' },
      { key: 'classificationCode', label: 'Notation' },
      { key: 'lang', label: 'Sprache (xml:lang)', type: 'lang' },
    ] },
  },
  {
    id: 'contributors',
    title: 'Contributors',
    path: 'contributors',
    group: { key: 'contributors', label: 'Contributors', itemLabel: 'Contributor', factory: createContributor, fields: [
      { key: 'contributorType', label: 'Rolle', type: 'select', options: VOCAB.contributorType },
      ...NAME_FIELDS('Name'),
    ], sublists: [NAME_ID_SUB, AFFILIATION_SUB] },
  },
  {
    id: 'dates',
    title: 'Daten (Zeitangaben)',
    path: 'dates',
    group: { key: 'dates', label: 'Zeitangaben', itemLabel: 'Datum', factory: createDate, fields: [
      { key: 'value', label: 'Datum oder Zeitraum (z. B. 2026 oder 2026-01-01/2026-03-31)', wide: true },
      { key: 'dateType', label: 'Typ', type: 'select', options: VOCAB.dateType },
      { key: 'dateInformation', label: 'Erläuterung' },
    ] },
  },
  {
    id: 'relatedIdentifiers',
    title: 'Verknüpfungen',
    path: 'relatedIdentifiers',
    group: { key: 'relatedIdentifiers', label: 'Verknüpfungen', itemLabel: 'Verknüpfung', factory: createRelatedIdentifier, fields: [
      { key: 'value', label: 'Identifier (DOI oder URL)', wide: true },
      { key: 'relatedIdentifierType', label: 'Identifier-Typ', type: 'select', options: VOCAB.relatedIdentifierType },
      { key: 'relationType', label: 'Beziehung', type: 'select', options: VOCAB.relationType },
      { key: 'resourceTypeGeneral', label: 'Ressourcentyp des Ziels', type: 'select', options: VOCAB.resourceTypeGeneral },
      { key: 'relationTypeInformation', label: 'Erläuterung' },
      { key: 'relatedMetadataScheme', label: 'Metadatenschema' },
      { key: 'schemeURI', label: 'Schema-URI' },
      { key: 'schemeType', label: 'Schema-Typ' },
    ] },
  },
  {
    id: 'alternateIdentifiers',
    title: 'Alternative Identifier',
    path: 'alternateIdentifiers',
    group: { key: 'alternateIdentifiers', label: 'Alternative Identifier', itemLabel: 'Identifier', factory: createAlternateIdentifier, fields: [
      { key: 'value', label: 'Identifier', wide: true },
      { key: 'alternateIdentifierType', label: 'Typ' },
    ] },
  },
  {
    id: 'rightsList',
    title: 'Rechte',
    path: 'rightsList',
    group: { key: 'rightsList', label: 'Rechte', itemLabel: 'Rechteangabe', factory: createRights, fields: [
      { key: 'value', label: 'Bezeichnung', wide: true },
      { key: 'rightsURI', label: 'Lizenz-URI', wide: true },
      { key: 'rightsIdentifier', label: 'Kennung (SPDX)' },
      { key: 'rightsIdentifierScheme', label: 'Schema' },
      { key: 'schemeURI', label: 'Schema-URI' },
      { key: 'lang', label: 'Sprache (xml:lang)', type: 'lang' },
    ] },
  },
  {
    id: 'geoLocations',
    title: 'Orte',
    path: 'geoLocations',
    group: {
      key: 'geoLocations',
      label: 'Orte',
      itemLabel: 'Ort',
      factory: createGeoLocation,
      fields: [{ key: 'place', label: 'Ortsangabe', wide: true }],
      optionals: [
        { key: 'point', label: 'Punkt', factory: createPoint, fields: POINT_FIELDS },
        { key: 'box', label: 'Rechteck', factory: createBox, fields: [
          { key: 'westBoundLongitude', label: 'West (Länge)' },
          { key: 'eastBoundLongitude', label: 'Ost (Länge)' },
          { key: 'southBoundLatitude', label: 'Süd (Breite)' },
          { key: 'northBoundLatitude', label: 'Nord (Breite)' },
        ] },
      ],
      sublists: [
        {
          key: 'polygons',
          label: 'Polygone',
          itemLabel: 'Polygon',
          factory: createPolygon,
          fields: [],
          sublists: [{ key: 'polygonPoints', label: 'Polygonpunkte (mindestens 4, erster = letzter)', itemLabel: 'Punkt', factory: createPoint, fields: POINT_FIELDS }],
          optionals: [{ key: 'inPolygonPoint', label: 'Punkt innerhalb des Polygons', factory: createPoint, fields: POINT_FIELDS }],
        },
      ],
    },
  },
  {
    id: 'fundingReferences',
    title: 'Förderung',
    path: 'fundingReferences',
    group: {
      key: 'fundingReferences',
      label: 'Förderung',
      itemLabel: 'Förderung',
      factory: createFundingReference,
      fields: [
        { key: 'funderName', label: 'Förderer', wide: true },
        { key: 'awardTitle', label: 'Titel der Förderung', wide: true },
      ],
      optionals: [
        { key: 'funderIdentifier', label: 'Förderer-ID', factory: createFunderIdentifier, fields: [
          { key: 'value', label: 'ID (z. B. https://doi.org/10.13039/…)', wide: true },
          { key: 'funderIdentifierType', label: 'Typ', type: 'select', options: VOCAB.funderIdentifierType },
          { key: 'schemeURI', label: 'Schema-URI' },
        ] },
        { key: 'awardNumber', label: 'Förderkennzeichen', factory: createAwardNumber, fields: [
          { key: 'value', label: 'Kennzeichen', wide: true },
          { key: 'awardURI', label: 'URL zur Förderung', wide: true },
        ] },
      ],
    },
  },
];

const state = {
  profiles: {},
  series: [],
  people: [],
  profileId: 'dmr-de',
  seriesId: null,
  values: {},
  model: null,
  unlocked: new Set(),
  warnings: [],
  pending: [],
  comparison: null,
  followup: null,
  takeover: null,
  taken: {},
  alerts: [],
  landing: null, // entered or registered address; null means "follow the profile"
  landingFrom: null, // DOI whose registration supplied the address
  loadMode: null,
  reconciled: null,
  schemaResult: null,
  note: '',
};

const byId = (id) => document.getElementById(id);

const currentProfile = () => {
  const p = state.profiles[state.profileId];
  const s = state.series.find((x) => x.id === state.seriesId);
  return s && p.series ? withSeries(p, s) : p;
};

const isLocked = (path) => {
  const profile = currentProfile();
  return (profile.locked ?? []).some((l) => (path === l || path.startsWith(`${l}.`)) && !state.unlocked.has(l));
};
const lockFor = (path) => (currentProfile().locked ?? []).find((l) => path === l || path.startsWith(`${l}.`));

function newModel() {
  state.model = applyProfile(currentProfile(), state.values);
}

/** True as soon as the record holds anything beyond the profile's own defaults. */
function hasContent() {
  const untouched = applyProfile(currentProfile(), state.values);
  return Object.values(state.values).some(Boolean) || JSON.stringify(state.model) !== JSON.stringify(untouched);
}

/** Empties the record: placeholders, model and all notices from earlier steps. */
function resetRecord() {
  state.values = {};
  state.unlocked.clear();
  state.warnings = [];
  state.pending = [];
  state.comparison = null;
  state.schemaResult = null;
  state.followup = null;
  state.takeover = null;
  state.taken = {};
  state.alerts = [];
  state.landing = null;
  state.landingFrom = null;
  state.loadMode = null;
  state.reconciled = null;
  newModel();
}

// --- rendering ---------------------------------------------------------------

function render() {
  renderProfileBar();
  renderAlert();
  renderLoadMode();
  renderFollowup();
  renderTakeover();
  renderForm();
  refresh();
}

function renderProfileBar() {
  const profile = currentProfile();
  const picker = byId('profile-picker');
  const bar = byId('profile-bar');
  picker.replaceChildren();
  bar.replaceChildren();

  const select = h('select', { id: 'profile-select' });
  for (const id of PROFILE_IDS) {
    select.append(h('option', { value: id, text: state.profiles[id].label, selected: id === state.profileId }));
  }
  select.addEventListener('change', () => {
    state.profileId = select.value;
    state.seriesId = null;
    state.alerts = state.alerts.filter((a) => a.kind !== 'profile'); // answered by this very click
    state.unlocked.clear();
    newModel();
    state.note = 'Profil gewechselt, Formular neu vorbelegt.';
    render();
  });
  picker.append(h('div', { class: 'field' }, [h('label', { text: 'Profil' }), select]));

  if (state.profiles[state.profileId].series) {
    const sel = h('select', {});
    sel.append(h('option', { value: '', text: '– ohne Reihe –', selected: !state.seriesId }));
    for (const s of state.series) sel.append(h('option', { value: s.id, text: s.label, selected: s.id === state.seriesId }));
    sel.addEventListener('change', () => {
      state.seriesId = sel.value || null;
      state.unlocked.clear();
      newModel();
      render();
    });
    picker.append(h('div', { class: 'field' }, [h('label', { text: 'Reihe' }), sel]));
  }

  for (const p of placeholdersOf(profile)) {
    const input = h('input', { type: 'text', placeholder: p.example, list: p.options ? `opt-${p.name}` : null });
    input.value = state.values[p.name] ?? '';
    input.addEventListener('input', () => {
      state.values[p.name] = input.value.trim();
      applyValuesToModel();
      // The form shows what the profile just changed (relations, locked fields). Re-rendering it
      // does not touch this input, so typing continues undisturbed.
      renderFormAndRefresh();
    });
    const field = h('div', { class: 'field' }, [
      h('label', { text: `${p.label}${p.optional ? ' (optional)' : ''}` }),
      input,
    ]);
    if (p.options) {
      const dl = h('datalist', { id: `opt-${p.name}` });
      for (const o of p.options) dl.append(h('option', { value: o }));
      field.append(dl);
    }
    bar.append(field);
  }

  bar.append(h('div', { class: 'field wide' }, [
    h('label', { text: 'DOI' }),
    h('output', { id: 'doi-out', class: 'doi' }),
  ]));

  bar.append(renderLandingPage());
}

/**
 * The landing page: the address Fabrica registers for the DOI. DataCite keeps it beside the
 * metadata, not inside the XML, so the form can only offer it for copying.
 */
function renderLandingPage() {
  const input = h('input', { type: 'text', id: 'landing-input', class: 'doi', placeholder: 'https://…' });
  input.value = landingPageValue();
  input.addEventListener('input', () => {
    state.landing = input.value; // an own address wins over the profile's pattern
    state.landingFrom = null;
  });

  const copy = h('button', { type: 'button', id: 'btn-copy-landing', text: 'Kopieren', onClick: async () => {
    if (!input.value) return;
    state.note = (await copyToClipboard(input))
      ? 'Landingpage in die Zwischenablage kopiert.'
      : 'Kopieren war hier nicht erlaubt; die Adresse ist markiert (Strg+C).';
    refresh();
  } });

  const field = h('div', { class: 'field wide' }, [
    h('label', { for: 'landing-input', text: 'Landingpage (in Fabrica eintragen, nicht im XML)' }),
    h('div', { class: 'row' }, [input, copy]),
  ]);

  field.append(h('span', { class: 'entry-hint', text: landingHint() ?? '' }));
  return field;
}

/**
 * Copies the field's text. Browsers grant the two ways differently, so both are tried; if neither
 * is allowed the text stays selected and the person can copy it themselves.
 */
async function copyToClipboard(input) {
  try {
    await navigator.clipboard.writeText(input.value);
    return true;
  } catch {
    // no permission for the asynchronous way
  }
  input.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  }
}

/** Follows the placeholders while the form stays as it is; an own address is left untouched. */
function refreshLandingPage() {
  const input = byId('landing-input');
  if (!input) return;
  if (state.landing === null) input.value = landingPageValue();
  const hint = input.closest('.field')?.querySelector('.entry-hint');
  if (hint) hint.textContent = landingHint() ?? '';
}

/** The address to show: an own or registered one, otherwise the profile's pattern. */
function landingPageValue() {
  if (state.landing !== null) return state.landing;
  return buildLandingPage(currentProfile(), state.values) ?? '';
}

function landingHint() {
  const pattern = buildLandingPage(currentProfile(), state.values);
  const differs = pattern && state.landing !== null && state.landing !== pattern;
  if (state.landingFrom) {
    return `Bei DataCite für ${state.landingFrom} registriert.`
      + (differs ? ` Das Profil würde ${pattern} vorschlagen.` : '');
  }
  if (differs) return `Abweichend vom Muster des Profils: ${pattern}`;
  if (!currentProfile().landingPage) {
    return 'Für dieses Profil ist noch kein Muster festgelegt (siehe docs/todo.md); bitte selbst eintragen.';
  }
  return pattern ? 'Muster des Profils; bei Bedarf anpassen und kopieren.' : 'Vollständig, sobald Studienkürzel und Version eingetragen sind.';
}

/** Re-applies the profile to identifier, locked fields and relations after a placeholder change. */
function applyValuesToModel() {
  const profile = currentProfile();
  syncProfileFields(state.model, profile, state.values, { unlocked: state.unlocked });
  const report = reconcileRelations(state.model, profile, state.values);
  if (report.removed.length || report.retargeted.length) state.reconciled = report;
}

function renderForm() {
  const form = byId('form');
  form.replaceChildren();
  const profile = currentProfile();
  const m = state.model;

  form.append(section('Kerndaten', [
    renderFields(m.identifier, [{ key: 'value', label: 'DOI', wide: true }], refresh, { disabled: true }),
    lockRow('publisher'),
    renderFields(m.publisher, [
      { key: 'name', label: 'Publisher', wide: true },
      { key: 'publisherIdentifier', label: 'ROR-ID' },
      { key: 'publisherIdentifierScheme', label: 'Schema' },
      { key: 'schemeURI', label: 'Schema-URI' },
      { key: 'lang', label: 'Sprache (xml:lang)', type: 'lang' },
    ], refresh, { disabled: isLocked('publisher') }),
    lockRow('resourceType'),
    renderFields(m.resourceType, [
      { key: 'resourceTypeGeneral', label: 'resourceTypeGeneral', type: 'select', options: profile.resourceTypeGeneral ?? VOCAB.resourceTypeGeneral },
      { key: 'value', label: 'Freitext', wide: true },
    ], onResourceTypeChange, { disabled: isLocked('resourceType') }),
    reviewBlock('publicationYear', renderFields(m, [{ key: 'publicationYear', label: 'Erscheinungsjahr' }], refresh, {
      disabled: isLocked('publicationYear'),
    })),
    lockRow('language'),
    renderFields(m, [{ key: 'language', label: 'Sprache' }], refresh, { disabled: isLocked('language') }),
    lockRow('version'),
    renderFields(m, [{ key: 'version', label: 'Version' }], refresh, { disabled: isLocked('version') }),
  ]));

  for (const s of SECTIONS) {
    const options = { onChange: refresh, rerender: renderFormAndRefresh, disabled: isLocked(s.path) };
    if (PER_ITEM_REVIEW.includes(s.path)) {
      options.itemBadge = (item) => itemApproval(s.path, item);
      options.itemClass = (item) => itemReviewClass(s.path, item);
    }
    form.append(section(s.title, [
      lockRow(s.path),
      s.actions?.(),
      reviewBlock(s.path, renderGroup(m[s.group.key], s.group, options)),
    ]));
  }

  form.append(section('Umfang und Formate', [
    reviewBlock('sizes', renderStringGroup(m.sizes, { label: 'Größenangaben', itemLabel: 'Größe' }, { onChange: refresh, rerender: renderFormAndRefresh })),
    reviewBlock('formats', renderStringGroup(m.formats, { label: 'Formate', itemLabel: 'Format' }, { onChange: refresh, rerender: renderFormAndRefresh })),
  ]));

  if (m.extra.length) {
    form.append(section('Unverändert übernommene Elemente', [
      h('p', { class: 'hint', text: 'Diese Elemente kennt das Formular nicht; sie bleiben unverändert im XML.' }),
      h('pre', { class: 'extra', text: m.extra.join('\n') }),
    ]));
  }
}

function onResourceTypeChange() {
  const label = resourceTypeLabel(currentProfile(), state.model.resourceType.resourceTypeGeneral);
  if (label) state.model.resourceType.value = label;
  renderFormAndRefresh();
}

const renderFormAndRefresh = () => {
  renderForm();
  refresh();
  applyPendingFocus();
};

const section = (title, children) => h('section', {}, [h('h2', { text: title }), ...children]);

/** Offers the subjects of the linked data package, as long as one is linked. */
function subjectActions() {
  const doi = dataPackageDoi(state.model);
  if (!doi) return null;
  return h('div', { class: 'actions' }, [
    // Called without an argument: the click event must not end up as the wanted version.
    h('button', { type: 'button', text: 'Schlagwörter aus Datenpaket übernehmen', onClick: () => subjectsFromDataPackage() }),
    h('span', { class: 'entry-hint', text: `Datenpaket: ${doi}` }),
  ]);
}

// Fields whose entries are confirmed one by one. The creator order is citation-relevant and each
// name has to be right, so a single tick for the whole list would say too little.
const PER_ITEM_REVIEW = ['creators'];

const reviewOfField = (field) => reviewOf(state.taken, field, state.model[field]);

/**
 * Review of a taken-over field: one deliberate confirmation, then a green check. Rendered above
 * the field it belongs to, so the confirmation sits where the values are. A field the person has
 * worked on afterwards needs no tick — editing it is the review.
 */
function approvalRow(field) {
  const review = reviewOfField(field);
  if (!review) return null;
  const label = FIELD_LABELS[field] ?? field;

  if (review.state !== 'pending') {
    const text = review.state === 'edited'
      ? `${label}: hier bearbeitet, die Übernahme aus ${review.doi} ist damit erledigt.`
      : `${label}: Übernahme aus ${review.doi} freigegeben.`;
    return h('div', { class: 'approval is-approved', id: `approved-${field}`, tabindex: '-1' }, [
      h('span', { class: 'approval-check', text: '✓' }),
      h('span', { text }),
    ]);
  }

  const perItem = PER_ITEM_REVIEW.includes(field) && review.total > 0;
  const approveAll = () => {
    state.taken = approveTaken(state.taken, field);
    state.note = `${label}: Übernahme freigegeben.`;
    focusAfterRender(`#approved-${field}`); // the control is gone after the re-render
    renderFormAndRefresh();
  };

  if (perItem) {
    return h('div', { class: 'approval' }, [
      h('span', { text: `${label}: ${review.open} von ${review.total} Einträgen aus ${review.doi} noch nicht abgenommen.` }),
      h('button', { type: 'button', id: `approve-${field}`, class: 'plain', text: 'Alle Einträge abnehmen', onClick: approveAll }),
    ]);
  }

  const id = `approve-${field}`;
  const input = h('input', { type: 'checkbox', id });
  input.addEventListener('change', () => {
    if (input.checked) approveAll();
  });
  return h('div', { class: 'approval' }, [
    h('label', { class: 'approval-toggle', for: id }, [input, h('span', { text: 'Übernahme freigeben' })]),
    h('span', { text: `${label}: aus ${review.doi} übernommen, noch nicht geprüft.` }),
  ]);
}

/** Frames the field a review belongs to: red while it is open, green once it is settled. */
function reviewBlock(field, content) {
  const review = reviewOfField(field);
  if (!review) return content;
  return h('div', { class: `review ${review.state === 'pending' ? 'is-pending' : 'is-approved'}`, 'data-review': field }, [
    approvalRow(field),
    content,
  ]);
}

/** Review of a single entry, e.g. one creator. */
function itemApproval(field, item) {
  const state_ = itemReview(state.taken, field, item);
  if (!state_ || state_ === 'own') return null;
  if (state_ === 'approved') {
    return h('div', { class: 'approval approval-item is-approved' }, [
      h('span', { class: 'approval-check', text: '✓' }),
      h('span', { text: 'Eintrag abgenommen.' }),
    ]);
  }
  const id = `approve-${field}-${fingerprint(item)}`;
  const input = h('input', { type: 'checkbox', id });
  input.addEventListener('change', () => {
    if (!input.checked) return;
    state.taken = approveItem(state.taken, field, item);
    state.note = `${FIELD_LABELS[field] ?? field}: ein Eintrag abgenommen.`;
    renderFormAndRefresh();
  });
  return h('div', { class: 'approval approval-item' }, [
    h('label', { class: 'approval-toggle', for: id }, [input, h('span', { text: 'Eintrag abnehmen' })]),
    h('span', { text: 'unverändert übernommen' }),
  ]);
}

const itemReviewClass = (field, item) => {
  const s = itemReview(state.taken, field, item);
  return s === 'pending' ? 'is-pending' : s === 'approved' ? 'is-approved' : '';
};

/**
 * Keeps the review marks current while the form stays as it is: editing a field settles its
 * review, and the borders and lines have to follow without rebuilding the inputs.
 */
function refreshReviews() {
  for (const box of document.querySelectorAll('[data-review]')) {
    const field = box.dataset.review;
    const review = reviewOfField(field);
    box.className = `review ${review?.state === 'pending' ? 'is-pending' : 'is-approved'}`;
    const row = box.querySelector(':scope > .approval');
    const fresh = approvalRow(field);
    if (row && fresh) row.replaceWith(fresh);
  }
  for (const field of PER_ITEM_REVIEW) {
    (state.model[field] ?? []).forEach((item, i) => {
      const node = document.querySelector(`[data-item="${field}-${i}"]`);
      if (!node) return;
      const cls = itemReviewClass(field, item);
      node.className = `item${cls ? ` ${cls}` : ''}`;
      const badge = node.querySelector(':scope > .approval');
      const fresh = itemApproval(field, item);
      if (badge && fresh) badge.replaceWith(fresh);
      else if (badge) badge.remove();
      else if (fresh) node.insertBefore(fresh, node.children[1] ?? null);
    });
  }
}

/** Shows the lock state of a profile field with a toggle. */
function lockRow(path) {
  const lock = lockFor(path);
  if (!lock) return null;
  const locked = isLocked(path);
  return h('div', { class: `lock ${locked ? 'is-locked' : 'is-unlocked'}` }, [
    h('span', { text: locked ? `🔒 Profilvorgabe: ${lock}` : `🔓 Profilvorgabe entsperrt: ${lock}` }),
    h('button', { type: 'button', text: locked ? 'Entsperren' : 'Wieder sperren', onClick: () => {
      if (locked) state.unlocked.add(lock);
      else {
        state.unlocked.delete(lock);
        applyValuesToModel();
      }
      renderFormAndRefresh();
    } }),
  ]);
}

// --- preview and checks -------------------------------------------------------

const PART_LABELS = { major: 'Major', minor: 'Minor', patch: 'Patch' };

/**
 * Points out a likely predecessor when a version above the first one is entered by hand
 * without a previous version: the IsNewVersionOf relation would be missing.
 */
function missingPredecessorHint(profile) {
  const usesPredecessor = placeholdersOf(profile).some((p) => p.name === 'previousVersion');
  if (!usesPredecessor || state.values.previousVersion) return [];
  const guess = previousVersionGuess(state.values.version);
  if (!guess) return [];
  return [{
    kind: 'hint',
    text: `Vorversion ${guess} wäre naheliegend. Ohne sie fehlt die Verknüpfung IsNewVersionOf zur Vorgängerfassung.`,
  }];
}

/** Labels the version options with the version each one would produce. */
function refreshVersionOptions() {
  const current = state.values.version || state.model.version;
  for (const option of byId('version-part').options) {
    let next = null;
    try {
      next = bumpVersion(current, option.value);
    } catch {
      next = null; // no version yet, or not in the x.y.z format
    }
    const label = PART_LABELS[option.value] ?? option.value;
    option.textContent = next ? `${label} (${next})` : label;
  }
  byId('btn-new-version').title = current
    ? `Aktuelle Version: ${current}`
    : 'Es ist noch keine Version eingetragen.';
}

function refresh() {
  const profile = currentProfile();
  const xml = serialize(state.model);
  refreshVersionOptions();
  byId('doi-out').textContent = buildDoi(profile, state.values) ?? '(unvollständig)';
  byId('preview').textContent = xml;
  // A schema result only describes the XML it was run on.
  const schema = state.schemaResult?.xml === xml ? state.schemaResult : null;
  const stale = state.schemaResult && !schema;

  const issues = [
    ...checkValues(profile, state.values).map((e) => ({ kind: 'error', text: `Platzhalter: ${e.message}` })),
    ...validate(state.model).map((e) => ({ kind: 'error', text: `${e.path}: ${e.message}` })),
    ...checkProfile(state.model, profile, state.values).map((i) => ({
      kind: i.type === 'recommended' ? 'hint' : 'warn',
      text: i.message,
    })),
    ...(state.reconciled?.removed ?? []).map((r) => ({
      kind: 'hint',
      text: `Veraltete Verknüpfung „${r.relationType}“ auf ${r.value} entfernt; das Profil verknüpft dasselbe Ziel als „${r.replacedBy}“.`,
    })),
    ...(state.reconciled?.retargeted ?? []).map((r) => ({
      kind: 'hint',
      text: `Verknüpfung „${r.relationType}“ auf die neue Version umgestellt: ${r.after}`,
    })),
    ...pendingTaken(state.taken, state.model).map((r) => ({
      kind: 'warn',
      text: PER_ITEM_REVIEW.includes(r.field)
        ? `${FIELD_LABELS[r.field] ?? r.field}: ${r.open} von ${r.total} übernommenen Einträgen aus ${r.doi} sind noch nicht abgenommen.`
        : `${FIELD_LABELS[r.field] ?? r.field}: Übernahme aus ${r.doi} ist noch nicht freigegeben.`,
    })),
    ...missingPredecessorHint(profile),
    ...staleVersionRelations(state.model, state.values).map((r) => ({
      kind: 'warn',
      text: `Verknüpfung „${r.relationType}“ zeigt noch auf Version ${state.values.previousVersion}: ${r.value}`,
    })),
    ...untranslated(state.model, state.pending).map((p) => ({
      kind: 'warn',
      text: `${p.label} stammt aus der Vorlage und ist noch nicht übersetzt.`,
    })),
    ...(state.comparison?.diffs ?? []).map((d) => ({
      kind: 'hint',
      text: `Vergleich ${d.path}: hier „${d.a}“, in ${state.comparison.doi} „${d.b}“.`,
    })),
    ...(schema?.errors ?? []).map((e) => ({
      kind: 'error',
      text: `Schema${e.line ? ` (Zeile ${e.line})` : ''}: ${e.message}`,
    })),
    ...(stale ? [{ kind: 'hint', text: 'Das XML hat sich seit der Schemaprüfung geändert; bitte erneut prüfen.' }] : []),
    ...state.warnings.map((w) => ({ kind: 'warn', text: `Import: ${w}` })),
  ];
  const list = byId('issues');
  list.replaceChildren();
  byId('issues-head').textContent = issues.length
    ? `Prüfung: ${issues.filter((i) => i.kind === 'error').length} Fehler, ${issues.filter((i) => i.kind !== 'error').length} Hinweise`
    : 'Prüfung: alles vollständig';
  for (const i of issues) list.append(h('li', { class: i.kind, text: i.text }));
  byId('note').textContent = state.note;
  refreshReviews();
  refreshLandingPage();
}

// --- look-ups (ROR, ORCID, local people) ---------------------------------------

const rorSearch = withCache((term, opts) => searchOrganizations(term, opts));
const orcidSearch = withCache((term, opts) => searchOrcid(splitName(term), opts));

/** "Carberry, Josiah" -> { family, given }; without a comma the input counts as family name. */
export function splitName(input) {
  const [family, given = ''] = String(input).split(',');
  return { family: family.trim(), given: given.trim() };
}

/** Local list first, then ORCID; the source is shown in the suggestion. */
async function searchPersons(term, opts) {
  const local = searchLocalPeople(state.people, term).map((p) => ({ source: 'local', person: p }));
  const known = new Set(local.map((l) => normalizeId(l.person.orcid)));
  let remote = [];
  try {
    remote = (await orcidSearch(term, opts))
      .filter((r) => !known.has(normalizeId(r.id)))
      .map((r) => ({ source: 'orcid', person: {
        name: `${r.family}, ${r.given}`.replace(/^, |, $/, ''),
        givenName: r.given,
        familyName: r.family,
        nameType: 'Personal',
        orcid: r.uri,
        affiliations: [],
        institutions: r.institutions,
      } }));
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    if (!local.length) throw e; // no local hits: show the error
  }
  return [...local, ...remote];
}

function enhanceField({ input, spec, obj }) {
  if (spec.suggest === 'ror') {
    attachTypeahead(input, {
      search: (term, opts) => rorSearch(term, opts),
      label: (org) => org.name,
      hint: (org) => [org.acronym, org.nameDe, org.place].filter(Boolean).join(' · '),
      onSelect: (org) => {
        Object.assign(obj, {
          name: org.name,
          affiliationIdentifier: org.id,
          affiliationIdentifierScheme: 'ROR',
          schemeURI: 'https://ror.org/',
        });
        renderFormAndRefresh();
      },
    });
    return;
  }

  if (spec.suggest === 'person') {
    attachTypeahead(input, {
      search: searchPersons,
      label: ({ person }) => person.name,
      hint: ({ source, person }) =>
        [source === 'local' ? 'lokal' : 'ORCID', person.orcid?.replace('https://orcid.org/', ''), ...(person.institutions ?? []).slice(0, 1)]
          .filter(Boolean)
          .join(' · '),
      onSelect: ({ person }) => {
        const fields = toPersonFields(person);
        Object.assign(obj, fields, {
          // Keep affiliations the user already entered.
          affiliations: obj.affiliations?.length ? obj.affiliations : fields.affiliations,
          contributorType: obj.contributorType ?? undefined,
        });
        renderFormAndRefresh();
      },
    });
    return;
  }

  if (spec.suggest === 'orcid') {
    const note = h('div', { class: 'suggest-status', role: 'status', 'aria-live': 'polite' });
    const check = h('button', { type: 'button', class: 'inline', text: 'iD prüfen' });
    input.after(h('div', { class: 'row' }, [check]));
    input.after(note);

    const showState = () => {
      const value = input.value.trim();
      if (!value) return (note.textContent = '');
      if (!normalizeId(value)) return (note.textContent = obj.nameIdentifierScheme === 'ORCID' ? 'Keine ORCID iD erkannt.' : '');
      note.textContent = isValidId(value) ? '✓ Prüfziffer stimmt.' : '✗ Prüfziffer stimmt nicht.';
    };

    input.addEventListener('input', showState);
    showState();

    check.addEventListener('click', async () => {
      const value = input.value.trim();
      note.textContent = 'Wird geprüft …';
      try {
        const person = await fetchPerson(value);
        if (!person) return (note.textContent = 'Diese iD ist bei ORCID nicht bekannt.');
        Object.assign(obj, { value: person.uri, nameIdentifierScheme: 'ORCID', schemeURI: 'https://orcid.org' });
        // Rebuild the form so the sibling fields (scheme, scheme URI) show the new values;
        // the result goes to the status line because this note is replaced by the rebuild.
        state.note = `ORCID ${person.uri} geprüft: ${person.family}, ${person.given}`;
        renderFormAndRefresh();
      } catch (e) {
        note.textContent = `Prüfung nicht möglich: ${e.message}`;
      }
    });
  }
}

// --- file actions -------------------------------------------------------------

function download(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function openFile(accept) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept });
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      resolve(file ? { name: file.name, text: await file.text() } : null);
    });
    input.click();
  });
}

function detectProfile(model) {
  for (const id of PROFILE_IDS) {
    for (const series of [null, ...state.series]) {
      const base = state.profiles[id];
      if (series && !base.series) continue;
      const profile = series ? withSeries(base, series) : base;
      const values = parseDoi(model.identifier.value, profile);
      if (values) return { profileId: id, seriesId: series?.id ?? null, values };
    }
  }
  return { profileId: 'generic', seriesId: null, values: {} };
}

/** Raises the version of the record that is open and links the predecessor. */
function createNewVersion(part) {
  try {
    // Everything that travels into the new registration is content from the predecessor and
    // therefore waits for its confirmation.
    state.landing = null; // the new version gets the address of its own version from the pattern
    state.landingFrom = null;
    const predecessor = state.model.identifier.value || buildDoi(currentProfile(), state.values) || 'der Vorversion';
    const carried = filledFields(state.model);
    state.values = nextVersionValues(state.values, part);
    state.reconciled = null;
    applyValuesToModel();
    state.followup = null;
    const { removed = [], retargeted = [] } = state.reconciled ?? {};
    const extra = [
      removed.length ? `${removed.length} veraltete Verknüpfung(en) entfernt` : null,
      retargeted.length ? `${retargeted.length} Verknüpfung(en) auf die neue Version umgestellt` : null,
    ].filter(Boolean);
    state.taken = markTaken(state.taken, carried, predecessor, state.model);
    if (carried.length) extra.push(`${carried.length} Feld(er) zur Abnahme markiert`);
    state.note = `Neue Version ${state.values.version} angelegt (Vorgänger ${state.values.previousVersion})`
      + (extra.length ? `, ${extra.join(', ')}.` : '.');
    render();
  } catch (e) {
    state.note = `Neue Version nicht möglich: ${e.message}`;
    refresh();
  }
}

/**
 * Deutliche Warnung über dem Formular. For a loaded record the mismatch is re-checked on every
 * render, so correcting the type makes the warning go away by itself.
 */
function renderAlert() {
  const box = byId('alert');
  box.replaceChildren();
  // A type warning only holds as long as the type still differs; correcting it clears the box.
  state.alerts = state.alerts.filter((a) => a.kind !== 'record' || typeMismatch(state.model, currentProfile()));
  box.hidden = !state.alerts.length;
  if (box.hidden) return;

  for (const alert of state.alerts) {
    box.append(h('div', { class: `alert ${alert.level === 'info' ? 'is-info' : ''}` }, [
      h('span', { class: 'alert-sign', text: alert.level === 'info' ? 'ℹ' : '⚠' }),
      h('div', { class: 'alert-text' }, [
        h('strong', { text: alert.head }),
        ...alertLines(alert).map((text) => h('span', { text })),
      ]),
      h('button', { type: 'button', class: 'plain', text: 'Ausblenden', onClick: () => {
        state.alerts = state.alerts.filter((a) => a !== alert);
        renderAlert();
      } }),
    ]));
  }
}

/** The wording of one notice; the type warning is phrased from the current state. */
function alertLines(alert) {
  if (alert.kind === 'profile') return alert.lines;
  const live = alert.kind === 'record' ? typeMismatch(state.model, currentProfile()) : alert;
  const typed = `„${live.actual}“ typisiert${live.value ? ` („${live.value}“)` : ''}`;
  return alert.kind === 'record'
    ? [
      `Der geladene Datensatz ${alert.doi} ist als ${typed}.`,
      `Das Profil „${currentProfile().label}“ erzeugt dagegen ${alert.allowedText}. Bitte prüfen, ob die DOI oder das Profil falsch ist.`,
    ]
    : [
      `Die Quelle ${alert.doi} ist als ${typed}, das Profil „${currentProfile().label}“ erzeugt ${alert.allowedText}.`,
      'Übernommene Inhalte können zu einem anderen Dokumenttyp gehören.',
    ];
}

/** Remembers a type mismatch so the warning can be shown; `kind` is 'record' or 'source'. */
function noteTypeMismatch(kind, doi, model) {
  const mismatch = typeMismatch(model, currentProfile());
  if (!mismatch) return false;
  state.alerts.push({
    kind,
    level: 'warn',
    head: 'Achtung: Der Typ passt nicht zum Profil.',
    doi,
    ...mismatch,
    allowedText: mismatch.allowed.map((t) => `„${t}“`).join(' oder '),
  });
  return true;
}

/**
 * The profile is recognised from the DOI, so loading can put a different document type on the
 * screen than the one that was selected. That switch is said out loud.
 */
function noteProfileSwitch(doi, before) {
  const now = { profileId: state.profileId, seriesId: state.seriesId };
  if (before.profileId === now.profileId && before.seriesId === now.seriesId) return false;
  state.alerts.push({
    kind: 'profile',
    level: 'info',
    head: 'Das Profil wurde gewechselt.',
    doi,
    lines: [
      `${doi} gehört zum Profil „${state.profiles[now.profileId].label}“; ausgewählt war „${state.profiles[before.profileId].label}“.`,
      'Das Formular ist jetzt auf den erkannten Dokumenttyp eingestellt. Stimmt das nicht, oben das Profil wieder umstellen.',
    ],
  });
  return true;
}

/** Version parts that lead somewhere, each with the version it would produce. */
function versionParts(version) {
  const parts = [];
  for (const part of ['major', 'minor', 'patch']) {
    try {
      parts.push({ part, next: bumpVersion(version, part) });
    } catch {
      // no version yet, or not in the x.y.z format: this part leads nowhere
    }
  }
  return parts;
}

/**
 * Asked right after a DOI was loaded: work on from it as a new version, or leave it as registered.
 * Escape and the backdrop mean "unchanged", the harmless of the two.
 */
function renderLoadMode() {
  const box = byId('loadmode');
  box.replaceChildren();
  if (!state.loadMode) {
    if (box.open) box.close();
    return;
  }

  const { doi, version } = state.loadMode;
  const parts = versionParts(version);
  box.append(
    h('h3', { id: 'loadmode-head', text: 'Wie soll weitergearbeitet werden?' }),
    h('p', { class: 'entry-hint', text: `${doi} ist als Version ${version} registriert.` }),
  );

  // The notices sit behind the modal, so they are repeated where the decision is made.
  for (const alert of state.alerts) {
    box.append(h('p', { class: `loadmode-notice ${alert.level === 'info' ? 'is-info' : ''}`, text: `${alert.level === 'info' ? 'ℹ' : '⚠'} ${alert.head} ${alertLines(alert)[0]}` }));
  }

  const select = h('select', { id: 'loadmode-part' });
  for (const { part, next } of parts) select.append(h('option', { value: part, text: `${PART_LABELS[part]} (${next})` }));

  box.append(h('div', { class: 'actions' }, [
    h('button', { type: 'button', text: 'Als Vorlage für eine neue Version', onClick: () => {
      const part = select.value;
      state.loadMode = null;
      createNewVersion(part);
    } }),
    select,
    h('span', { class: 'sep', text: '·' }),
    h('button', { type: 'button', class: 'plain', text: `Unverändert laden (${version})`, onClick: keepLoaded }),
  ]));

  box.append(h('p', { class: 'entry-hint', text: 'Eine neue Version zählt Version und DOI hoch, trägt die Vorversion ein, stellt die Verknüpfungen um und markiert alle übernommenen Felder zur Abnahme.' }));

  if (!box.open) {
    box.showModal();
    box.addEventListener('cancel', (e) => { // Escape: keep the record as it is
      e.preventDefault();
      keepLoaded();
    }, { once: true });
  }
  box.querySelector('button')?.focus();
}

function keepLoaded() {
  if (!state.loadMode) return;
  const { doi, version } = state.loadMode;
  state.loadMode = null;
  state.note = `${doi} unverändert geladen (Version ${version}). „Nachfolger anlegen“ macht daraus später eine neue Version.`;
  render();
}

/**
 * Line shown right after a DOI was loaded: it names the record and offers the two
 * steps that usually follow, with the concrete version instead of an abstract label.
 */
function renderFollowup() {
  const box = byId('followup');
  box.replaceChildren();
  box.hidden = !state.followup;
  if (!state.followup) return;

  const { doi } = state.followup;
  const next = (() => {
    try {
      return bumpVersion(state.values.version, 'major');
    } catch {
      return null;
    }
  })();

  box.append(h('span', { text: `Geladen: ${doi}` }));
  if (next) {
    box.append(h('button', { type: 'button', text: `Nachfolger ${next} anlegen`, onClick: () => createNewVersion('major') }));
  }
  if (counterpartTarget()) {
    box.append(h('button', { type: 'button', text: 'Sprachfassung erzeugen', onClick: createOtherLanguage }));
  }
  box.append(h('button', { type: 'button', class: 'plain', text: 'Ausblenden', onClick: () => {
    state.followup = null;
    renderFollowup();
  } }));
}

// --- language versions ----------------------------------------------------------

const counterpartTarget = () => {
  const target = counterpartOf(state.profileId, state.values);
  return target && state.profiles[target.profileId] ? target : null;
};

const languageOfProfile = (profile, values) => profile.defaults?.language?.replace(/^\{lang\}$/, values.lang ?? '') ?? '';

/** Builds the record in the other language from the one currently open. */
function createOtherLanguage() {
  const target = counterpartTarget();
  if (!target) {
    state.note = 'Dieses Profil hat keine zweite Sprachfassung.';
    return refresh();
  }
  const targetProfile = state.profiles[target.profileId];
  const { model, pending } = createCounterpart(state.model, {
    targetProfile,
    targetValues: target.values,
    sourceLanguage: languageOfProfile(currentProfile(), state.values),
    targetLanguage: languageOfProfile(targetProfile, target.values),
  });
  Object.assign(state, {
    profileId: target.profileId,
    values: target.values,
    model,
    pending,
    unlocked: new Set(),
    warnings: [],
    taken: {},
  });
  state.followup = null;
  state.note = `Sprachfassung ${targetProfile.label} erzeugt. Titel und Beschreibungen stammen aus der Vorlage und sind noch zu übersetzen.`;
  render();
}

/** Loads the counterpart's DOI and either merges its neutral fields or compares them. */
async function fromCounterpart(mode) {
  const target = counterpartTarget();
  if (!target) {
    state.note = 'Dieses Profil hat keine zweite Sprachfassung.';
    return refresh();
  }
  const doi = buildDoi(state.profiles[target.profileId], target.values);
  if (!doi) {
    state.note = 'Die DOI des Gegenstücks ist noch unvollständig.';
    return refresh();
  }
  state.note = `Gegenstück ${doi} wird geladen …`;
  refresh();
  try {
    const record = await fetchDoi(doi);
    if (!record) {
      state.note = `Das Gegenstück ${doi} ist bei DataCite nicht registriert. Über „Felder übernehmen“ oben lässt sich jede andere DOI als Quelle wählen.`;
      return refresh();
    }
    const other = parse(record.xml).model;
    if (mode === 'compare') {
      state.comparison = { doi: record.doi, diffs: compareLanguageVersions(state.model, other) };
      state.note = state.comparison.diffs.length
        ? `Vergleich mit ${record.doi}: ${state.comparison.diffs.length} Unterschiede in sprachneutralen Feldern.`
        : `Vergleich mit ${record.doi}: keine Unterschiede in sprachneutralen Feldern.`;
      return refresh();
    }
    openTakeover({ doi: record.doi, source: other, kind: 'counterpart' });
  } catch (e) {
    state.note = `Gegenstück nicht verfügbar: ${e.message}`;
    refresh();
  }
}

/** Loads the previous version of this record so its content can be taken over. */
async function fromPreviousVersion() {
  const previous = state.values.previousVersion || previousVersionGuess(state.values.version);
  const doi = previous ? buildDoi(currentProfile(), { ...state.values, version: previous }) : null;
  if (!doi) {
    state.note = `Ohne Vorversion lässt sich die DOI der Vorgängerfassung nicht bilden. Über „Felder übernehmen“ oben lässt sich jede andere DOI als Quelle wählen.`;
    return refresh();
  }
  state.note = `Vorversion ${doi} wird geladen …`;
  refresh();
  try {
    const record = await fetchDoi(doi);
    if (!record) {
      state.note = `Die Vorversion ${doi} ist bei DataCite nicht registriert. Über „Felder übernehmen“ oben lässt sich jede andere DOI als Quelle wählen.`;
      return refresh();
    }
    openTakeover({ doi: record.doi, source: parse(record.xml).model, kind: 'previous' });
  } catch (e) {
    state.note = `Vorversion nicht verfügbar: ${e.message}`;
    refresh();
  }
}

const TAKEOVER_HEADINGS = {
  counterpart: 'Felder aus dem Gegenstück übernehmen',
  previous: 'Felder aus der Vorversion übernehmen',
  doi: 'Felder aus der geladenen DOI übernehmen',
};

/**
 * Opens the modal checkbox list. `entries` is [{ key, label }], `preselected` the ticked keys;
 * `onApply` receives the keys that are still ticked when the user confirms.
 */
function openPicker({ heading, hint, entries, preselected, note, onApply, controls = null }) {
  state.takeover = { heading, hint, entries, selection: new Set(preselected), onApply, controls };
  state.note = note;
  render();
}

/**
 * Opens the picker for the fields to take over. Preselected are the fields that hold
 * something in the source; for a counterpart the language-specific ones stay unticked.
 */
function openTakeover({ doi, source, kind }) {
  const available = filledFields(source);
  if (!available.length) {
    state.note = `${doi} enthält keine übernehmbaren Felder.`;
    return refresh();
  }
  noteTypeMismatch('source', doi, source);
  const preselected = kind === 'counterpart' ? available.filter((f) => NEUTRAL_FIELDS.includes(f)) : available;
  openPicker({
    heading: TAKEOVER_HEADINGS[kind] ?? 'Felder übernehmen',
    hint: `Quelle: ${doi}`,
    entries: available.map((field) => ({
      key: field,
      label: `${FIELD_LABELS[field] ?? field} (${describeField(source[field])})`,
    })),
    preselected,
    note: `${doi} geladen. Felder auswählen und übernehmen.`,
    onApply: (fields) => applyTakeover(doi, source, fields),
  });
}

function renderTakeover() {
  const box = byId('takeover');
  box.replaceChildren();
  if (!state.takeover) {
    if (box.open) box.close();
    return;
  }

  const { heading, hint, entries, selection, controls } = state.takeover;
  box.append(h('h3', { id: 'takeover-head', text: heading }), h('p', { class: 'entry-hint', text: hint }));
  if (controls) box.append(controls());

  // Entries may name a group (free keywords, thesaurus); each group gets its own Alle/Keine.
  const groups = new Map();
  for (const entry of entries) {
    const name = entry.group ?? '';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(entry);
  }

  let index = 0;
  for (const [name, group] of groups) {
    if (name) {
      box.append(h('div', { class: 'takeover-group' }, [
        h('strong', { text: `${name} (${group.length})` }),
        h('button', { type: 'button', class: 'plain', text: 'Alle', onClick: () => {
          group.forEach((e) => selection.add(e.key));
          renderTakeover();
        } }),
        h('button', { type: 'button', class: 'plain', text: 'Keine', onClick: () => {
          group.forEach((e) => selection.delete(e.key));
          renderTakeover();
        } }),
      ]));
    }
    const list = h('div', { class: 'takeover-fields' });
    for (const entry of group) {
      const id = `take-${index}`;
      index += 1;
      const input = h('input', { type: 'checkbox', id, checked: selection.has(entry.key) });
      input.addEventListener('change', () => {
        if (input.checked) selection.add(entry.key);
        else selection.delete(entry.key);
      });
      list.append(h('label', { class: 'takeover-field', for: id }, [input, h('span', { text: entry.label })]));
    }
    box.append(list);
  }

  const alle = h('button', { type: 'button', class: 'plain', text: 'Alle', onClick: () => {
    entries.forEach((e) => selection.add(e.key));
    renderTakeover();
  } });
  const keine = h('button', { type: 'button', class: 'plain', text: 'Keine', onClick: () => {
    selection.clear();
    renderTakeover();
  } });

  box.append(h('div', { class: 'actions' }, [
    h('button', { type: 'button', text: 'Übernehmen', onClick: applyPicker }),
    h('button', { type: 'button', text: 'Abbrechen', onClick: cancelTakeover }),
    h('span', { class: 'sep', text: '·' }),
    h('span', { class: 'entry-hint', text: 'Auswahl:' }),
    alle,
    keine,
  ]));

  if (!box.open) {
    box.showModal();
    box.addEventListener('cancel', cancelTakeover, { once: true }); // Escape
  }
  box.querySelector('input')?.focus();
}

function cancelTakeover(event) {
  event?.preventDefault?.();
  state.takeover = null;
  state.note = 'Übernahme abgebrochen.';
  render();
}

function applyPicker() {
  const { selection, onApply } = state.takeover;
  const keys = [...selection];
  state.takeover = null;
  onApply(keys);
}

function applyTakeover(doi, source, fields) {
  const { model, changes } = mergeFields(state.model, source, fields);
  state.model = model;
  state.taken = markTaken(state.taken, changes.map((c) => c.field), doi, state.model);
  state.comparison = null;
  state.note = changes.length
    ? `Aus ${doi} übernommen: ${changes.map((c) => `${FIELD_LABELS[c.field] ?? c.field} (${c.before} → ${c.after})`).join(', ')}.`
    : `Aus ${doi} übernommen: keine Änderungen nötig.`;
  render();
}

/** Loads the linked data package and offers its subjects for the record. */
async function subjectsFromDataPackage(wantedVersion = null) {
  const linked = dataPackageDoi(state.model);
  if (!linked) {
    state.note = 'Dieser Datensatz ist mit keinem Datenpaket verknüpft.';
    return refresh();
  }
  state.note = `Datenpaket ${linked} wird gesucht …`;
  refresh();
  try {
    // Data packages are registered after the report, so the linked version often does not exist
    // yet. The registered ones are offered instead, newest first.
    const versions = await fetchVersions(linked).catch(() => []);
    const linkedVersion = versionOf(linked);
    const chosen = wantedVersion ?? bestAvailableVersion(versions.map((v) => v.version), linkedVersion);
    const doi = versions.find((v) => v.version === chosen)?.doi ?? linked;

    const record = await fetchDoi(doi);
    if (!record) {
      state.note = `Das Datenpaket ${doi} ist bei DataCite nicht registriert.`;
      return refresh();
    }
    const subjects = parse(record.xml).model.subjects;
    if (!subjects.length) {
      state.note = `Das Datenpaket ${record.doi} hat keine Schlagwörter.`;
      return refresh();
    }
    const known = subjects.map((s) => hasSubject(state.model, s));
    if (known.every(Boolean)) {
      state.note = `Alle ${subjects.length} Schlagwörter des Datenpakets ${record.doi} sind bereits vorhanden.`;
      return refresh();
    }

    // Data packages carry their subjects in both languages; preselected are the ones that match
    // this record. Everything else stays available through the list.
    const lang = state.model.language;
    const fits = (s) => !lang || !s.lang || s.lang === lang;
    const other = chosen && linkedVersion && chosen !== linkedVersion
      ? ` Version ${linkedVersion} ist nicht registriert, gezeigt wird ${chosen}.`
      : '';

    openPicker({
      heading: 'Schlagwörter aus dem Datenpaket übernehmen',
      hint: `Quelle: ${record.doi} · ${subjects.length} Schlagwörter, vorausgewählt sind die noch fehlenden${lang ? ` mit Sprache „${lang}“` : ''}.${other}`,
      controls: () => versionControl(versions, chosen, linkedVersion),
      entries: subjects.map((s, i) => ({
        key: String(i),
        group: subjectGroup(s),
        label: entryLabel(s) + (known[i] ? ' – bereits vorhanden' : ''),
      })),
      preselected: subjects.map((_, i) => String(i)).filter((_, i) => !known[i] && fits(subjects[i])),
      note: `${record.doi} geladen. Schlagwörter auswählen und übernehmen.`,
      onApply: (keys) => applySubjects(record.doi, keys.map((k) => subjects[Number(k)])),
    });
  } catch (e) {
    state.note = `Datenpaket nicht verfügbar: ${e.message}`;
    refresh();
  }
}

/** Lets the version be changed inside the dialog; changing it loads that version's subjects. */
function versionControl(versions, chosen, linkedVersion) {
  if (versions.length < 2) return h('p', { class: 'entry-hint', text: 'Weitere registrierte Versionen gibt es nicht.' });
  const select = h('select', { id: 'subjects-version' });
  for (const v of [...versions].sort((a, b) => compareVersions(b.version, a.version))) {
    select.append(h('option', {
      value: v.version,
      selected: v.version === chosen,
      text: v.version === linkedVersion ? `${v.version} (verknüpft)` : v.version,
    }));
  }
  select.addEventListener('change', () => {
    state.takeover = null;
    subjectsFromDataPackage(select.value);
  });
  return h('div', { class: 'row' }, [h('label', { for: 'subjects-version', text: 'Datenpaketversion' }), select]);
}

const ELSST = 'ELSST';

/** Free keywords on one side, thesaurus terms on the other. */
const subjectGroup = (s) => {
  const scheme = String(s.subjectScheme ?? '').trim();
  if (!scheme) return 'Freie Schlagwörter';
  return scheme.includes(ELSST) ? `${ELSST} (CESSDA-Thesaurus)` : scheme;
};

/** Inside the dialog the scheme is the group, so the entry only needs term and language. */
const entryLabel = (s) => (s.lang ? `${s.value} (${s.lang})` : s.value);

const subjectLabel = (s) => [s.value, s.subjectScheme && `· ${s.subjectScheme}`, s.lang && `(${s.lang})`]
  .filter(Boolean)
  .join(' ');

function applySubjects(doi, subjects) {
  const { model, added } = addSubjects(state.model, subjects);
  state.model = model;
  if (added.length) state.taken = markTakenEntries(state.taken, 'subjects', doi, state.model.subjects, added);
  const names = added.slice(0, 5).map(subjectLabel).join(', ');
  state.note = added.length
    ? `Aus ${doi} übernommen: ${added.length} Schlagwörter (${names}${added.length > 5 ? ', …' : ''}).`
    : `Aus ${doi} übernommen: keine neuen Schlagwörter.`;
  render();
}

/**
 * Loads a registered DOI from DataCite. With mode 'full' the form is filled from the stored XML,
 * with mode 'fields' the record only serves as a source for the field selection.
 */
async function loadFromDoi(mode = 'full') {
  const input = byId('doi-input');
  const doi = input.value.trim();
  if (!doi) {
    state.note = 'Bitte zuerst eine DOI eingeben.';
    return refresh();
  }
  state.note = `DOI ${doi} wird geladen …`;
  refresh();
  try {
    const record = await fetchDoi(doi);
    if (!record) {
      state.note = `DOI ${doi} ist bei DataCite nicht registriert.`;
      return refresh();
    }
    if (mode === 'fields') {
      return openTakeover({ doi: record.doi, source: parse(record.xml).model, kind: 'doi' });
    }
    const { model, warnings } = parse(record.xml);
    const selected = { profileId: state.profileId, seriesId: state.seriesId };
    const detected = detectProfile(model);
    Object.assign(state, detected, { model, warnings, unlocked: new Set(), taken: {} });
    state.reconciled = null;
    state.alerts = [];
    state.followup = { doi: record.doi };
    state.landing = record.url || null; // what is registered right now, not what the pattern says
    state.landingFrom = record.url ? record.doi : null;
    state.loadMode = versionParts(state.values.version).length ? { doi: record.doi, version: state.values.version } : null;
    const switched = noteProfileSwitch(record.doi, selected);
    const mismatched = noteTypeMismatch('record', record.doi, model);
    state.note = `${record.doi} geladen (Status ${record.state}, zuletzt geändert ${record.updated.slice(0, 10)}), Profil: ${state.profiles[state.profileId].label}.`
      + (switched ? ` Das Profil wurde von „${state.profiles[selected.profileId].label}“ umgestellt.` : '')
      + (mismatched ? ' Achtung: Der Typ passt nicht zum Profil.' : '');
    render();
  } catch (e) {
    state.note = `Laden fehlgeschlagen: ${e.message}`;
    refresh();
  }
}

function wireActions() {
  byId('btn-new').addEventListener('click', () => {
    if (hasContent() && !confirm('Der aktuelle Datensatz geht dabei verloren. Neu anlegen?')) return;
    resetRecord();
    state.note = `Leerer Datensatz aus dem Profil „${currentProfile().label}“ angelegt.`;
    render();
  });

  byId('btn-xml').addEventListener('click', () => {
    download(serialize(state.model), fileNameFor(state.model.identifier.value, 'xml'), 'application/xml');
  });

  byId('btn-save').addEventListener('click', () => {
    const data = toSaveState({
      profileId: state.profileId,
      seriesId: state.seriesId,
      values: state.values,
      model: state.model,
      taken: state.taken,
      landing: state.landing,
    });
    download(JSON.stringify(data, null, 2), fileNameFor(state.model.identifier.value, 'json'), 'application/json');
  });

  byId('btn-load').addEventListener('click', async () => {
    const file = await openFile('.json,application/json');
    if (!file) return;
    try {
      const restored = fromSaveState(JSON.parse(file.text));
      Object.assign(state, restored, { unlocked: new Set(), warnings: [] }); // restored holds `taken`
      state.note = `Speicherstand „${file.name}“ geladen.`;
      render();
    } catch (e) {
      state.note = `Laden fehlgeschlagen: ${e.message}`;
      refresh();
    }
  });

  byId('btn-load-doi').addEventListener('click', () => loadFromDoi('full'));
  byId('btn-take-from-doi').addEventListener('click', () => loadFromDoi('fields'));
  byId('doi-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadFromDoi('full');
  });

  byId('btn-new-version').addEventListener('click', () => createNewVersion(byId('version-part').value));

  byId('btn-validate').addEventListener('click', async () => {
    const button = byId('btn-validate');
    button.disabled = true;
    state.note = 'XML wird gegen das DataCite-Schema geprüft …';
    state.schemaResult = null;
    refresh();
    try {
      const xml = serialize(state.model);
      const result = await validateAgainstSchema(xml);
      state.schemaResult = { ...result, xml };
      state.note = result.valid
        ? 'Schemaprüfung bestanden (DataCite 4.7).'
        : `Schemaprüfung: ${result.errors.length} Fehler.`;
    } catch (e) {
      state.note = `Schemaprüfung nicht möglich: ${e.message}`;
    } finally {
      button.disabled = false;
      refresh();
    }
  });

  byId('btn-counterpart').addEventListener('click', createOtherLanguage);
  byId('btn-take-over').addEventListener('click', () => fromCounterpart('merge'));
  byId('btn-from-previous').addEventListener('click', fromPreviousVersion);
  byId('btn-compare').addEventListener('click', () => fromCounterpart('compare'));

  byId('btn-open-xml').addEventListener('click', async () => {
    const file = await openFile('.xml,application/xml,text/xml');
    if (!file) return;
    try {
      const { model, warnings } = parse(file.text);
      const selected = { profileId: state.profileId, seriesId: state.seriesId };
      const detected = detectProfile(model);
      Object.assign(state, detected, { model, warnings, unlocked: new Set(), taken: {} });
      state.alerts = [];
      noteProfileSwitch(`XML „${file.name}“`, selected);
      noteTypeMismatch('record', `XML „${file.name}“`, model);
      state.note = `XML „${file.name}“ geladen, Profil erkannt: ${state.profiles[state.profileId].label}.`;
      render();
    } catch (e) {
      state.note = `XML konnte nicht gelesen werden: ${e.message}`;
      refresh();
    }
  });
}

export async function start() {
  // Relative to the page, so the app also works under a sub-path (e.g. GitHub Pages).
  const readJson = async (p) => (await fetch(p)).json();
  const { profiles, series } = await loadProfiles(readJson);
  state.profiles = profiles;
  state.series = series;
  // The local people list is a convenience; without it the form still works.
  state.people = await loadPeople(readJson).catch(() => []);
  setFieldEnhancer(enhanceField);
  newModel();
  wireActions();
  render();
}
