// Required-field checks for the model, following the DataCite 4.x schema
// (mandatory properties plus attributes marked use="required").
// Controlled vocabularies are not checked here; that is left to the XSD.
//
// Returns a list of { path, message } — never throws — so the form stays usable.

import { isBlank } from './model.js';

const empty = (s) => typeof s !== 'string' || s.trim() === '';

export function validate(m) {
  const errors = [];
  const req = (cond, path, message) => cond || errors.push({ path, message });

  req(!empty(m.identifier.value), 'identifier', 'DOI fehlt.');
  req(!empty(m.identifier.identifierType), 'identifier.identifierType', 'Identifier-Typ fehlt.');

  const creators = m.creators.filter((c) => !isBlank(c));
  req(creators.length > 0, 'creators', 'Mindestens ein Creator ist erforderlich.');
  m.creators.forEach((c, i) => {
    if (isBlank(c)) return;
    checkPerson(c, `creators[${i}]`, req);
  });

  req(m.titles.some((t) => !empty(t.value)), 'titles', 'Mindestens ein Titel ist erforderlich.');
  req(!empty(m.publisher.name), 'publisher', 'Publisher fehlt.');
  req(/^\d{4}$/.test(m.publicationYear.trim()), 'publicationYear', 'Erscheinungsjahr muss vierstellig sein.');
  req(!empty(m.resourceType.resourceTypeGeneral), 'resourceType.resourceTypeGeneral', 'resourceTypeGeneral fehlt.');

  m.contributors.forEach((c, i) => {
    if (isBlank(c)) return;
    req(!empty(c.contributorType), `contributors[${i}].contributorType`, 'Contributor-Typ fehlt.');
    checkPerson(c, `contributors[${i}]`, req);
  });

  const rows = (list, path, checks) =>
    list.forEach((item, i) => {
      if (isBlank(item)) return;
      for (const [key, message] of checks) req(!empty(item[key]), `${path}[${i}].${key}`, message);
    });

  rows(m.subjects, 'subjects', [['value', 'Schlagwort ist leer.']]);
  rows(m.dates, 'dates', [
    ['value', 'Datum fehlt.'],
    ['dateType', 'Datumstyp fehlt.'],
  ]);
  rows(m.alternateIdentifiers, 'alternateIdentifiers', [
    ['value', 'Alternativer Identifier fehlt.'],
    ['alternateIdentifierType', 'Typ des alternativen Identifiers fehlt.'],
  ]);
  rows(m.relatedIdentifiers, 'relatedIdentifiers', [
    ['value', 'Verknüpfter Identifier fehlt.'],
    ['relatedIdentifierType', 'Identifier-Typ fehlt.'],
    ['relationType', 'Beziehungstyp fehlt.'],
  ]);
  rows(m.descriptions, 'descriptions', [
    ['value', 'Beschreibungstext ist leer.'],
    ['descriptionType', 'Beschreibungstyp fehlt.'],
  ]);
  m.geoLocations.forEach((g, i) => {
    if (isBlank(g)) return;
    if (g.point && !isBlank(g.point)) checkPoint(g.point, `geoLocations[${i}].point`, req);
    if (g.box && !isBlank(g.box)) {
      for (const [k, label] of [
        ['westBoundLongitude', 'Westliche Länge'],
        ['eastBoundLongitude', 'Östliche Länge'],
        ['southBoundLatitude', 'Südliche Breite'],
        ['northBoundLatitude', 'Nördliche Breite'],
      ]) {
        req(!empty(g.box[k]), `geoLocations[${i}].box.${k}`, `${label} fehlt.`);
      }
    }
    g.polygons.forEach((p, j) => {
      if (isBlank(p)) return;
      const path = `geoLocations[${i}].polygons[${j}]`;
      req(p.polygonPoints.length >= 4, `${path}.polygonPoints`, 'Ein Polygon braucht mindestens 4 Punkte.');
      p.polygonPoints.forEach((pt, k) => checkPoint(pt, `${path}.polygonPoints[${k}]`, req));
      if (p.inPolygonPoint && !isBlank(p.inPolygonPoint)) checkPoint(p.inPolygonPoint, `${path}.inPolygonPoint`, req);
    });
  });

  rows(m.fundingReferences, 'fundingReferences', [['funderName', 'Name des Förderers fehlt.']]);
  m.fundingReferences.forEach((f, i) => {
    if (f.funderIdentifier && !isBlank(f.funderIdentifier)) {
      req(!empty(f.funderIdentifier.value), `fundingReferences[${i}].funderIdentifier.value`, 'Förderer-ID fehlt.');
      req(!empty(f.funderIdentifier.funderIdentifierType), `fundingReferences[${i}].funderIdentifier.funderIdentifierType`, 'Typ der Förderer-ID fehlt.');
    }
  });

  return errors;
}

function checkPoint(point, path, req) {
  req(!empty(point.pointLongitude), `${path}.pointLongitude`, 'Längengrad fehlt.');
  req(!empty(point.pointLatitude), `${path}.pointLatitude`, 'Breitengrad fehlt.');
}

function checkPerson(p, path, req) {
  req(!empty(p.name), `${path}.name`, 'Name fehlt.');
  p.nameIdentifiers.forEach((n, j) => {
    if (isBlank(n)) return;
    req(!empty(n.value), `${path}.nameIdentifiers[${j}].value`, 'Personen-ID fehlt.');
    req(!empty(n.nameIdentifierScheme), `${path}.nameIdentifiers[${j}].nameIdentifierScheme`, 'Schema der Personen-ID fehlt.');
  });
  p.affiliations.forEach((a, j) => {
    if (isBlank(a)) return;
    req(!empty(a.name), `${path}.affiliations[${j}].name`, 'Name der Affiliation fehlt.');
  });
}
