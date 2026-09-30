// DataCite XML string -> model. Uses only the standard DOM API (DOMParser, XMLSerializer):
// native in the browser, injected in Node tests (@xmldom/xmldom).
//
// Nothing is dropped silently: unknown attributes and nested elements produce a warning,
// unknown top-level elements (e.g. relatedItems) are kept verbatim in `model.extra`.

import {
  KERNEL_NS,
  createResource,
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

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const CDATA_SECTION_NODE = 4;

const IGNORED_ATTR = /^(xmlns(:.*)?|xsi:.*)$/;

export class XmlParseError extends Error {}

/**
 * Parses a DataCite XML document.
 * @param {string} xml
 * @param {{DOMParser?: typeof DOMParser, XMLSerializer?: typeof XMLSerializer}} [dom]
 * @returns {{model: object, warnings: string[]}}
 */
export function parse(xml, dom = globalThis) {
  const warnings = [];
  const warn = (msg) => warnings.push(msg);

  const doc = parseDocument(xml, dom.DOMParser);
  const root = doc.documentElement;
  if (!root || root.localName !== 'resource') {
    throw new XmlParseError(`Wurzelelement ist <${root?.localName ?? '?'}>, erwartet <resource>.`);
  }
  if (root.namespaceURI !== KERNEL_NS) {
    warn(`Namespace ist „${root.namespaceURI ?? ''}“, erwartet „${KERNEL_NS}“.`);
  }

  const children = (node) => [...node.childNodes].filter((n) => n.nodeType === ELEMENT_NODE);
  const text = (node) => node.textContent ?? '';

  // Reads the listed attributes (model key -> attribute name) and warns about any other.
  // Elements whose attributes are never read are checked in a final pass (see below).
  const checked = new WeakSet();
  const attrs = (node, map, path) => {
    checked.add(node);
    const out = {};
    for (const [key, attr] of Object.entries(map)) out[key] = node.getAttribute(attr) ?? '';
    const known = new Set(Object.values(map));
    for (const a of [...node.attributes]) {
      if (!known.has(a.name) && !IGNORED_ATTR.test(a.name)) warn(`Unbekanntes Attribut ${a.name} an ${path} ignoriert.`);
    }
    return out;
  };

  // Iterates element children, dispatching by local name; unknown children produce a warning.
  const each = (node, path, handlers) => {
    for (const c of children(node)) {
      const h = handlers[c.localName];
      if (h) h(c, `${path}/${c.localName}`);
      else warn(`Unbekanntes Element <${c.localName}> in ${path} ignoriert.`);
    }
  };

  // Wrapper element containing repeatable children of one name.
  const list = (node, path, childName, read) => {
    const items = [];
    attrs(node, {}, path);
    each(node, path, { [childName]: (c, p) => items.push(read(c, p)) });
    return items;
  };

  const nameIdentifier = (n, p) => ({
    ...createNameIdentifier(),
    ...attrs(n, { nameIdentifierScheme: 'nameIdentifierScheme', schemeURI: 'schemeURI' }, p),
    value: text(n),
  });

  const affiliation = (n, p) => ({
    ...createAffiliation(),
    ...attrs(n, { affiliationIdentifier: 'affiliationIdentifier', affiliationIdentifierScheme: 'affiliationIdentifierScheme', schemeURI: 'schemeURI' }, p),
    name: text(n),
  });

  const person = (node, path, base, nameElement) => {
    const p = base;
    each(node, path, {
      [nameElement]: (c, cp) => Object.assign(p, attrs(c, { nameType: 'nameType', lang: 'xml:lang' }, cp), { name: text(c) }),
      givenName: (c) => (p.givenName = text(c)),
      familyName: (c) => (p.familyName = text(c)),
      nameIdentifier: (c, cp) => p.nameIdentifiers.push(nameIdentifier(c, cp)),
      affiliation: (c, cp) => p.affiliations.push(affiliation(c, cp)),
    });
    return p;
  };

  const point = (node, path) => {
    const p = createPoint();
    each(node, path, {
      pointLongitude: (c) => (p.pointLongitude = text(c)),
      pointLatitude: (c) => (p.pointLatitude = text(c)),
    });
    return p;
  };

  const geoLocation = (node, path) => {
    const g = createGeoLocation();
    each(node, path, {
      geoLocationPlace: (c) => (g.place = text(c)),
      geoLocationPoint: (c, p) => (g.point = point(c, p)),
      geoLocationBox: (c, p) => {
        g.box = createBox();
        each(c, p, Object.fromEntries(Object.keys(g.box).map((k) => [k, (b) => (g.box[k] = text(b))])));
      },
      geoLocationPolygon: (c, p) => {
        const poly = createPolygon();
        each(c, p, {
          polygonPoint: (pp, ppp) => poly.polygonPoints.push(point(pp, ppp)),
          inPolygonPoint: (pp, ppp) => (poly.inPolygonPoint = point(pp, ppp)),
        });
        g.polygons.push(poly);
      },
    });
    return g;
  };

  const fundingReference = (node, path) => {
    const f = createFundingReference();
    each(node, path, {
      funderName: (c) => (f.funderName = text(c)),
      funderIdentifier: (c, p) =>
        (f.funderIdentifier = { ...createFunderIdentifier(), ...attrs(c, { funderIdentifierType: 'funderIdentifierType', schemeURI: 'schemeURI' }, p), value: text(c) }),
      awardNumber: (c, p) => (f.awardNumber = { ...createAwardNumber(), ...attrs(c, { awardURI: 'awardURI' }, p), value: text(c) }),
      awardTitle: (c) => (f.awardTitle = text(c)),
    });
    return f;
  };

  // Mixed content: text plus <br/> elements, which become '\n'.
  const descriptionText = (node, path) => {
    let s = '';
    for (const c of [...node.childNodes]) {
      if (c.nodeType === TEXT_NODE || c.nodeType === CDATA_SECTION_NODE) s += c.data;
      else if (c.nodeType === ELEMENT_NODE && c.localName === 'br') s += '\n';
      else if (c.nodeType === ELEMENT_NODE) warn(`Unbekanntes Element <${c.localName}> in ${path} ignoriert.`);
    }
    return s;
  };

  const m = createResource();
  const top = {
    identifier: (n, p) => (m.identifier = { ...attrs(n, { identifierType: 'identifierType' }, p), value: text(n) }),
    creators: (n, p) => (m.creators = list(n, p, 'creator', (c, cp) => person(c, cp, createCreator(), 'creatorName'))),
    titles: (n, p) =>
      (m.titles = list(n, p, 'title', (c, cp) => ({ ...createTitle(), ...attrs(c, { titleType: 'titleType', lang: 'xml:lang' }, cp), value: text(c) }))),
    publisher: (n, p) =>
      (m.publisher = {
        ...attrs(n, { publisherIdentifier: 'publisherIdentifier', publisherIdentifierScheme: 'publisherIdentifierScheme', schemeURI: 'schemeURI', lang: 'xml:lang' }, p),
        name: text(n),
      }),
    publicationYear: (n) => (m.publicationYear = text(n)),
    resourceType: (n, p) => (m.resourceType = { ...attrs(n, { resourceTypeGeneral: 'resourceTypeGeneral' }, p), value: text(n) }),
    subjects: (n, p) =>
      (m.subjects = list(n, p, 'subject', (c, cp) => ({
        ...createSubject(),
        ...attrs(c, { subjectScheme: 'subjectScheme', schemeURI: 'schemeURI', valueURI: 'valueURI', classificationCode: 'classificationCode', lang: 'xml:lang' }, cp),
        value: text(c),
      }))),
    contributors: (n, p) =>
      (m.contributors = list(n, p, 'contributor', (c, cp) => {
        const base = { ...createContributor(), ...attrs(c, { contributorType: 'contributorType' }, cp) };
        return person(c, cp, base, 'contributorName');
      })),
    dates: (n, p) =>
      (m.dates = list(n, p, 'date', (c, cp) => ({ ...createDate(), ...attrs(c, { dateType: 'dateType', dateInformation: 'dateInformation' }, cp), value: text(c) }))),
    language: (n) => (m.language = text(n)),
    alternateIdentifiers: (n, p) =>
      (m.alternateIdentifiers = list(n, p, 'alternateIdentifier', (c, cp) => ({
        ...createAlternateIdentifier(),
        ...attrs(c, { alternateIdentifierType: 'alternateIdentifierType' }, cp),
        value: text(c),
      }))),
    relatedIdentifiers: (n, p) =>
      (m.relatedIdentifiers = list(n, p, 'relatedIdentifier', (c, cp) => ({
        ...createRelatedIdentifier(),
        ...attrs(
          c,
          Object.fromEntries(Object.keys(createRelatedIdentifier()).filter((k) => k !== 'value').map((k) => [k, k])),
          cp,
        ),
        value: text(c),
      }))),
    sizes: (n, p) => (m.sizes = list(n, p, 'size', (c) => text(c))),
    formats: (n, p) => (m.formats = list(n, p, 'format', (c) => text(c))),
    version: (n) => (m.version = text(n)),
    rightsList: (n, p) =>
      (m.rightsList = list(n, p, 'rights', (c, cp) => ({
        ...createRights(),
        ...attrs(c, { rightsURI: 'rightsURI', rightsIdentifier: 'rightsIdentifier', rightsIdentifierScheme: 'rightsIdentifierScheme', schemeURI: 'schemeURI', lang: 'xml:lang' }, cp),
        value: text(c),
      }))),
    descriptions: (n, p) =>
      (m.descriptions = list(n, p, 'description', (c, cp) => ({
        ...createDescription(),
        ...attrs(c, { descriptionType: 'descriptionType', lang: 'xml:lang' }, cp),
        value: descriptionText(c, cp),
      }))),
    geoLocations: (n, p) => (m.geoLocations = list(n, p, 'geoLocation', geoLocation)),
    fundingReferences: (n, p) => (m.fundingReferences = list(n, p, 'fundingReference', fundingReference)),
  };

  attrs(root, {}, 'resource');
  const verbatim = new WeakSet();
  for (const c of children(root)) {
    const h = top[c.localName];
    if (h) {
      h(c, `resource/${c.localName}`);
    } else {
      verbatim.add(c);
      const Serializer = dom.XMLSerializer;
      if (!Serializer) throw new XmlParseError('XMLSerializer nicht verfügbar.');
      m.extra.push(new Serializer().serializeToString(c));
      warn(`Element <${c.localName}> wird vom Formular nicht unterstützt und unverändert übernommen.`);
    }
  }

  // Any attribute on an element that no handler inspected would otherwise be lost silently.
  const sweep = (node, path) => {
    if (verbatim.has(node)) return;
    if (!checked.has(node)) attrs(node, {}, path);
    for (const c of children(node)) sweep(c, `${path}/${c.localName}`);
  };
  sweep(root, 'resource');

  return { model: m, warnings };
}

function parseDocument(xml, DOMParserImpl) {
  if (!DOMParserImpl) throw new XmlParseError('DOMParser nicht verfügbar.');
  const fail = (msg) => {
    throw new XmlParseError(`XML ist nicht wohlgeformt: ${String(msg).split('\n')[0]}`);
  };
  let doc;
  try {
    // The options object is used by @xmldom/xmldom and ignored by browsers.
    doc = new DOMParserImpl({ onError: (level, msg) => level !== 'warning' && fail(msg) }).parseFromString(xml, 'application/xml');
  } catch (e) {
    if (e instanceof XmlParseError) throw e;
    fail(e.message);
  }
  // Browsers report errors as a <parsererror> element instead of throwing.
  const err = doc.getElementsByTagName('parsererror')[0];
  if (err) {
    fail(err.textContent.replace(/^This page contains the following errors:/, '').replace(/Below is a rendering.*$/s, '').trim());
  }
  return doc;
}
