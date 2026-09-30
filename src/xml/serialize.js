// Model -> DataCite XML string. Pure string building, no DOM: runs unchanged in browser and Node.
//
// Rules:
// - Attributes with '' / null values are omitted.
// - Optional wrapper elements (subjects, dates, sizes, ...) are omitted when empty.
// - Repeatable entries that are completely blank (e.g. an empty form row) are skipped.
// - Required elements are always written, even when empty, so validation can flag them.
// - Line breaks in descriptions ('\n' in the model) are written as <br/>.

import { SCHEMA_LOCATION, KERNEL_NS, XSI_NS, isBlank } from '../model/model.js';

const INDENT = '  ';

const escText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) =>
  escText(s).replace(/"/g, '&quot;').replace(/\t/g, '&#9;').replace(/\n/g, '&#10;').replace(/\r/g, '&#13;');

// Node: { name, attrs: [[key, value], ...], text?, children?, raw?, lineBreaks? }
const el = (name, attrs = [], content = '') =>
  Array.isArray(content) ? { name, attrs, children: content.filter(Boolean) } : { name, attrs, text: content ?? '' };

const optEl = (name, value, attrs = []) => (value ? el(name, attrs, value) : null);

const wrapper = (name, items, build) => {
  const children = items.filter((i) => !isBlank(i)).map(build);
  return children.length ? el(name, [], children) : null;
};

function render(node, depth) {
  const pad = INDENT.repeat(depth);
  if (node.raw !== undefined) return pad + node.raw.trim();
  const attrs = node.attrs
    .filter(([, v]) => v !== '' && v !== null && v !== undefined)
    .map(([k, v]) => ` ${k}="${escAttr(v)}"`)
    .join('');
  if (node.children?.length) {
    const inner = node.children.map((c) => render(c, depth + 1)).join('\n');
    return `${pad}<${node.name}${attrs}>\n${inner}\n${pad}</${node.name}>`;
  }
  const text = node.text ?? '';
  if (text === '') return `${pad}<${node.name}${attrs}/>`;
  const body = node.lineBreaks ? escText(text).replace(/\r?\n/g, '<br/>') : escText(text);
  return `${pad}<${node.name}${attrs}>${body}</${node.name}>`;
}

const nameIdentifier = (n) =>
  el('nameIdentifier', [['nameIdentifierScheme', n.nameIdentifierScheme], ['schemeURI', n.schemeURI]], n.value);

const affiliation = (a) =>
  el(
    'affiliation',
    [
      ['affiliationIdentifier', a.affiliationIdentifier],
      ['affiliationIdentifierScheme', a.affiliationIdentifierScheme],
      ['schemeURI', a.schemeURI],
    ],
    a.name,
  );

const personChildren = (p, nameElement) => [
  el(nameElement, [['nameType', p.nameType], ['xml:lang', p.lang]], p.name),
  optEl('givenName', p.givenName),
  optEl('familyName', p.familyName),
  ...p.nameIdentifiers.filter((n) => !isBlank(n)).map(nameIdentifier),
  ...p.affiliations.filter((a) => !isBlank(a)).map(affiliation),
];

const point = (name, p) => el(name, [], [el('pointLongitude', [], p.pointLongitude), el('pointLatitude', [], p.pointLatitude)]);

const geoLocation = (g) =>
  el('geoLocation', [], [
    optEl('geoLocationPlace', g.place),
    g.point && !isBlank(g.point) ? point('geoLocationPoint', g.point) : null,
    g.box && !isBlank(g.box)
      ? el('geoLocationBox', [], ['westBoundLongitude', 'eastBoundLongitude', 'southBoundLatitude', 'northBoundLatitude'].map((k) => el(k, [], g.box[k])))
      : null,
    ...g.polygons
      .filter((p) => !isBlank(p))
      .map((p) =>
        el('geoLocationPolygon', [], [
          ...p.polygonPoints.map((pt) => point('polygonPoint', pt)),
          p.inPolygonPoint && !isBlank(p.inPolygonPoint) ? point('inPolygonPoint', p.inPolygonPoint) : null,
        ]),
      ),
  ]);

const fundingReference = (f) =>
  el('fundingReference', [], [
    el('funderName', [], f.funderName),
    f.funderIdentifier && !isBlank(f.funderIdentifier)
      ? el('funderIdentifier', [['funderIdentifierType', f.funderIdentifier.funderIdentifierType], ['schemeURI', f.funderIdentifier.schemeURI]], f.funderIdentifier.value)
      : null,
    f.awardNumber && !isBlank(f.awardNumber) ? el('awardNumber', [['awardURI', f.awardNumber.awardURI]], f.awardNumber.value) : null,
    optEl('awardTitle', f.awardTitle),
  ]);

/** Builds the element tree for a model. */
function toTree(m) {
  return el('resource', [['xmlns:xsi', XSI_NS], ['xmlns', KERNEL_NS], ['xsi:schemaLocation', SCHEMA_LOCATION]], [
    el('identifier', [['identifierType', m.identifier.identifierType]], m.identifier.value),
    el('creators', [], m.creators.filter((c) => !isBlank(c)).map((c) => el('creator', [], personChildren(c, 'creatorName')))),
    el('titles', [], m.titles.filter((t) => !isBlank(t)).map((t) => el('title', [['titleType', t.titleType], ['xml:lang', t.lang]], t.value))),
    el(
      'publisher',
      [
        ['publisherIdentifier', m.publisher.publisherIdentifier],
        ['publisherIdentifierScheme', m.publisher.publisherIdentifierScheme],
        ['schemeURI', m.publisher.schemeURI],
        ['xml:lang', m.publisher.lang],
      ],
      m.publisher.name,
    ),
    el('publicationYear', [], m.publicationYear),
    el('resourceType', [['resourceTypeGeneral', m.resourceType.resourceTypeGeneral]], m.resourceType.value),
    wrapper('subjects', m.subjects, (s) =>
      el(
        'subject',
        [
          ['subjectScheme', s.subjectScheme],
          ['schemeURI', s.schemeURI],
          ['valueURI', s.valueURI],
          ['classificationCode', s.classificationCode],
          ['xml:lang', s.lang],
        ],
        s.value,
      ),
    ),
    wrapper('contributors', m.contributors, (c) =>
      el('contributor', [['contributorType', c.contributorType]], personChildren(c, 'contributorName')),
    ),
    wrapper('dates', m.dates, (d) => el('date', [['dateType', d.dateType], ['dateInformation', d.dateInformation]], d.value)),
    optEl('language', m.language),
    wrapper('alternateIdentifiers', m.alternateIdentifiers, (a) =>
      el('alternateIdentifier', [['alternateIdentifierType', a.alternateIdentifierType]], a.value),
    ),
    wrapper('relatedIdentifiers', m.relatedIdentifiers, (r) =>
      el(
        'relatedIdentifier',
        [
          ['relatedIdentifierType', r.relatedIdentifierType],
          ['relationType', r.relationType],
          ['resourceTypeGeneral', r.resourceTypeGeneral],
          ['relatedMetadataScheme', r.relatedMetadataScheme],
          ['schemeURI', r.schemeURI],
          ['schemeType', r.schemeType],
          ['relationTypeInformation', r.relationTypeInformation],
        ],
        r.value,
      ),
    ),
    wrapper('sizes', m.sizes, (s) => el('size', [], s)),
    wrapper('formats', m.formats, (f) => el('format', [], f)),
    optEl('version', m.version),
    wrapper('rightsList', m.rightsList, (r) =>
      el(
        'rights',
        [
          ['rightsURI', r.rightsURI],
          ['rightsIdentifier', r.rightsIdentifier],
          ['rightsIdentifierScheme', r.rightsIdentifierScheme],
          ['schemeURI', r.schemeURI],
          ['xml:lang', r.lang],
        ],
        r.value,
      ),
    ),
    wrapper('descriptions', m.descriptions, (d) =>
      ({ ...el('description', [['xml:lang', d.lang], ['descriptionType', d.descriptionType]], d.value), lineBreaks: true }),
    ),
    wrapper('geoLocations', m.geoLocations, geoLocation),
    wrapper('fundingReferences', m.fundingReferences, fundingReference),
    ...m.extra.map((raw) => ({ raw })),
  ]);
}

/** Serializes a model to a DataCite XML document string. */
export function serialize(model) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${render(toTree(model), 0)}\n`;
}
