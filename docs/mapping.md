# Mapping: Feldinventar der Referenz-Fixtures

Stand: 2026-09-21 · Schema: DataCite 4.7 (siehe `schema/README.md`)

## 1. Quellen

| Kürzel | DOI | Datei | Typ |
|---|---|---|---|
| dmr-de | `10.21249/DZHW:nac2018-dmr-de:3.0.0` | `fixtures/nac2018-dmr-de_3.0.0.xml` | Daten- und Methodenbericht, deutsch |
| dmr-en | `10.21249/DZHW:nac2018-dmr-en:3.0.0` | `fixtures/nac2018-dmr-en_3.0.0.xml` | Daten- und Methodenbericht, englisch |
| datapackage (DP) | `10.21249/DZHW:nac2018:3.0.0` | `fixtures/nac2018_3.0.0.xml` | Datenpaket |
| instrument | `10.21249/DZHW:sid2021-ins1-att1:1.0.0` | `fixtures/sid2021-ins1-att1_1.0.0.xml` | Fragebogen (Instrument) |
| wps-paper | `10.21249/es:wps:012026:1.0.0` | `fixtures/es-wps-012026_1.0.0.xml` | EUROSTUDENT Working Paper |
| wps-series | `10.21249/es:wps` | `fixtures/es-wps.xml` | EUROSTUDENT Working Paper Series (Reihe) |

Die ersten drei Fixtures wurden per Content Negotiation abgerufen:

```bash
curl -LH "Accept: application/vnd.datacite.datacite+xml" "https://doi.org/<DOI>"
```

Die letzten drei (ergänzt am 2026-09-21) stammen aus `data.attributes.xml` der DataCite-REST-API, also dem hochgeladenen
Stand (vgl. Abschnitt 2). Alle Fixtures validieren gegen `schema/kernel-4.7/metadata.xsd`.

Unter dem Präfix `10.21249` sind 165 DOIs registriert (Stand 2026-09-21). Davon:
- überwiegend Datenpakete
- 11 DMR in wechselnden Varianten (`-dmr`, `-dmr-de/-en`; `Text` bzw. `Report`)
- 2 Instrumente
- die EUROSTUDENT-Reihe
- noch kein DsReport

## 2. Quellenvergleich (Nebencheck dmr-de)

Die Content-Negotiation-Antwort wurde mit dem in DataCite hinterlegten XML verglichen:
`https://api.datacite.org/dois/<DOI>`, Feld `data.attributes.xml`, base64-dekodiert, abgelegt unter
`fixtures/_crosscheck/nac2018-dmr-de_3.0.0.api.xml`. Die API meldet `schemaVersion = kernel-4`,
`state = findable` und `updated = 2026-01-07`.

**Befund:** Die beiden Fassungen unterscheiden sich in genau einer Zeile, der `rights`-Angabe:

| Quelle | `<rights>` |
|---|---|
| hinterlegtes XML (API) | nur `rightsURI` |
| Content Negotiation | zusätzlich `rightsIdentifier="cc-by-nc-sa-4.0"`, `rightsIdentifierScheme="SPDX"`, `schemeURI="https://spdx.org/licenses/"` |

Content Negotiation liefert also nicht das hochgeladene XML, sondern eine aus dem DataCite-JSON neu
serialisierte Fassung. Dabei ergänzt DataCite bekannte Lizenzen um SPDX-Angaben. Beide Fassungen sind
schemavalide. Konsequenz für Phase 7 („bestehende DOI laden“): Für den Import ist
`data.attributes.xml` die genauere Quelle, weil sie dem hochgeladenen Stand entspricht.
Umgebaut wurde hier nichts, das ist nur der Befund.

## 3. Feldinventar (generiert)

Erzeugt mit `node tools/inventory.js --write`. Die Pfade sind relativ zu `<resource>`, `@` markiert ein Attribut.

Legende der Zellen:
- `Wert ×n`: n Vorkommen desselben Werts
- „n×, k versch. Werte“: n Vorkommen mit k unterschiedlichen Werten
- „(leer)“: leeres Element
- „—“: Element fehlt

Die Befund-Spalte vergleicht die **Mengen** unterschiedlicher Werte, Anzahlen spielen dafür keine Rolle.

<!-- BEGIN GENERATED: tools/inventory.js -->
| Pfad | dmr-de | dmr-en | datapackage | instrument | wps-paper | wps-series | Befund (automatisch) |
|---|---|---|---|---|---|---|---|
| `resource` | (Container) ×1 | (Container) ×1 | (Container) ×1 | (Container) ×1 | (Container) ×1 | (Container) ×1 | Container |
| `identifier` | `10.21249/DZHW:NAC2018-DMR-DE:3.0.0` | `10.21249/DZHW:NAC2018-DMR-EN:3.0.0` | `10.21249/DZHW:NAC2018:3.0.0` | `10.21249/DZHW:SID2021-INS1-ATT1:1.0.0` | `10.21249/ES:WPS:012026:1.0.0` | `10.21249/ES:WPS` | variiert |
| `identifier@identifierType` | `DOI` | `DOI` | `DOI` | `DOI` | `DOI` | `DOI` | gleich (alle) |
| `creators` | (Container) ×1 | (Container) ×1 | (Container) ×1 | (Container) ×1 | (Container) ×1 | (Container) ×1 | Container |
| `creators/creator` | (Container) ×15 | (Container) ×15 | (Container) ×31 | (Container) ×1 | (Container) ×2 | (Container) ×1 | Container |
| `creators/creator/creatorName` | 15× , 15 versch. Werte | 15× , 15 versch. Werte | 31× , 31 versch. Werte | `German Centre for Higher Education Research and Science Studies (DZHW)` | `Robinie, Maja` ×1<br>`Fichte, Ida` ×1 | `EUROSTUDENT project` | variiert |
| `creators/creator/creatorName@nameType` | `Personal` ×15 | `Personal` ×15 | `Personal` ×30<br>`Organizational` ×1 | `Organizational` | `Personal` ×2 | `Organizational` | variiert |
| `creators/creator/givenName` | 15× , 15 versch. Werte | 15× , 15 versch. Werte | 30× , 28 versch. Werte | — | `Maja` ×1<br>`Ida` ×1 | — | nur dmr-de, dmr-en, datapackage, wps-paper (variiert) |
| `creators/creator/familyName` | 15× , 15 versch. Werte | 15× , 15 versch. Werte | 30× , 30 versch. Werte | — | `Robinie` ×1<br>`Fichte` ×1 | — | nur dmr-de, dmr-en, datapackage, wps-paper (variiert) |
| `creators/creator/affiliation` | `German Center for Integration and Migration Research` ×1<br>`German Centre for Higher Education Research and Science Studies` ×9 | `German Center for Integration and Migration Research` ×1<br>`German Centre for Higher Education Research and Science Studies` ×8 | `German Centre for Higher Education Research and Science Studies (DZHW)` ×30 | — | `Leuphana University of Lüneburg` ×1<br>`German Centre for Higher Education Research and Science Studies` ×1 | `German Centre for Higher Education Research and Science Studies` | nur dmr-de, dmr-en, datapackage, wps-paper, wps-series (variiert) |
| `creators/creator/affiliation@affiliationIdentifier` | `https://ror.org/03ym65z81` ×1<br>`https://ror.org/01n8j6z65` ×9 | `https://ror.org/03ym65z81` ×1<br>`https://ror.org/01n8j6z65` ×8 | — | — | `https://ror.org/02w2y2t16` ×1<br>`https://ror.org/01n8j6z65` ×1 | `https://ror.org/01n8j6z65` | nur dmr-de, dmr-en, wps-paper, wps-series (variiert) |
| `creators/creator/affiliation@affiliationIdentifierScheme` | `ROR` ×10 | `ROR` ×9 | — | — | `ROR` ×2 | `ROR` | nur dmr-de, dmr-en, wps-paper, wps-series (gleich) |
| `creators/creator/affiliation@schemeURI` | `https://ror.org` ×10 | `https://ror.org` ×9 | — | — | `https://ror.org` ×2 | `https://ror.org` | nur dmr-de, dmr-en, wps-paper, wps-series (gleich) |
| `creators/creator/nameIdentifier` | 9× , 9 versch. Werte | 10× , 10 versch. Werte | 12× , 12 versch. Werte | — | `https://orcid.org/0000-0000-0015-8386` ×1<br>`https://orcid.org/0000-0000-0142-5423` ×1 | — | nur dmr-de, dmr-en, datapackage, wps-paper (variiert) |
| `creators/creator/nameIdentifier@nameIdentifierScheme` | `ORCID` ×9 | `ORCID` ×10 | `ORCID` ×12 | — | `ORCID` ×2 | — | nur dmr-de, dmr-en, datapackage, wps-paper (gleich) |
| `creators/creator/nameIdentifier@schemeURI` | `https://orcid.org` ×9 | `https://orcid.org` ×10 | `https://orcid.org` ×12 | — | `https://orcid.org` ×2 | — | nur dmr-de, dmr-en, datapackage, wps-paper (gleich) |
| `titles` | (Container) ×1 | (Container) ×1 | (Container) ×1 | (Container) ×1 | (Container) ×1 | (Container) ×1 | Container |
| `titles/title` | `Daten- und Methodenbericht zur Datenpaketversion 3.0.0 der National A…` | `Nacaps 2018. Data and methods report for data package version 3.0.0 o…` | `National Academics Panel Study (Nacaps) 2018` ×2 | `Fragebogen der Studierendenbefragung in Deutschland 2021` | `Poor students, rich students - What actually determines the income co…` | `EUROSTUDENT Working Paper Series` | variiert |
| `titles/title@xml:lang` | `de` | — | `de` ×1<br>`en` ×1 | `de` | `en` | `en` | nur dmr-de, datapackage, instrument, wps-paper, wps-series (variiert) |
| `publisher` | `German Centre for Higher Education Research and Science Studies` | `German Centre for Higher Education Research and Science Studies` | `German Centre for Higher Education Research and Science Studies (DZHW)` | `German Centre for Higher Education Research and Science Studies (DZHW)` | `EUROSTUDENT-DZHW` | `EUROSTUDENT-DZHW` | variiert |
| `publisher@publisherIdentifier` | `https://ror.org/01n8j6z65` | `https://ror.org/01n8j6z65` | `https://ror.org/01n8j6z65` | — | — | — | nur dmr-de, dmr-en, datapackage (gleich) |
| `publisher@publisherIdentifierScheme` | `ROR` | `ROR` | `ROR` | — | — | — | nur dmr-de, dmr-en, datapackage (gleich) |
| `publisher@schemeURI` | `https://ror.org` | `https://ror.org` | `https://ror.org/` | — | — | — | nur dmr-de, dmr-en, datapackage (variiert) |
| `publisher@xml:lang` | — | — | `en` | — | — | — | nur datapackage |
| `publicationYear` | `2025` | `2026` | `2025` | `2022` | `2026` | `2026` | variiert |
| `resourceType` | `Data and Method Report` | `Data and Method Report` | (leer) | `Instrument` | (leer) | (leer) | variiert |
| `resourceType@resourceTypeGeneral` | `Report` | `Report` | `Dataset` | `Other` | `Report` | `Collection` | variiert |
| `subjects` | — | — | (Container) ×1 | (Container) ×1 | (Container) ×1 | (Container) ×1 | Container |
| `subjects/subject` | — | — | 140× , 139 versch. Werte | `university` ×1<br>`student` ×1 | `FOS: Social sciences` ×1<br>`FOS: Economics and business` ×1 | `FOS: Social sciences` | nur datapackage, instrument, wps-paper, wps-series (variiert) |
| `subjects/subject@xml:lang` | — | — | `en` ×70<br>`de` ×70 | `en` ×2 | — | — | nur datapackage, instrument (variiert) |
| `subjects/subject@subjectScheme` | — | — | `CESSDA European Language Social Science Thesaurus (ELSST)` ×72 | `TheSozWiss` ×2 | `Fields of Science and Technology (FOS)` ×2 | `Fields of Science and Technology (FOS)` | nur datapackage, instrument, wps-paper, wps-series (variiert) |
| `subjects/subject@schemeURI` | — | — | `https://thesauri.cessda.eu/elsst-4/en/` ×72 | — | `https://web-archive.oecd.org/2012-06-15/138575-38235147.pdf` ×2 | `https://web-archive.oecd.org/2012-06-15/138575-38235147.pdf` | nur datapackage, wps-paper, wps-series (variiert) |
| `subjects/subject@valueURI` | — | — | 72× , 36 versch. Werte | — | — | — | nur datapackage |
| `subjects/subject@classificationCode` | — | — | — | — | `5` ×1<br>`5.2` ×1 | `5` | nur wps-paper, wps-series (variiert) |
| `contributors` | — | — | (Container) ×1 | — | — | (Container) ×1 | Container |
| `contributors/contributor` | — | — | (Container) ×7 | — | — | (Container) ×3 | Container |
| `contributors/contributor@contributorType` | — | — | `Distributor` ×1<br>`DataCurator` ×6 | — | — | `Editor` ×3 | nur datapackage, wps-series (variiert) |
| `contributors/contributor/contributorName` | — | — | 7× , 7 versch. Werte | — | — | `Flieder, Willi` ×1<br>`Farn, Ida` ×1<br>`Zeder, Katrin` ×1 | nur datapackage, wps-series (variiert) |
| `contributors/contributor/contributorName@nameType` | — | — | `Organizational` ×1<br>`Personal` ×6 | — | — | `Personal` ×3 | nur datapackage, wps-series (variiert) |
| `contributors/contributor/nameIdentifier` | — | — | 7× , 7 versch. Werte | — | — | `https://orcid.org/0000-0000-0039-5955` ×1<br>`https://orcid.org/0000-0000-0142-5423` ×1<br>`https://orcid.org/0000-0000-0095-0285` ×1 | nur datapackage, wps-series (variiert) |
| `contributors/contributor/nameIdentifier@nameIdentifierScheme` | — | — | `ROR` ×1<br>`ORCID` ×6 | — | — | `ORCID` ×3 | nur datapackage, wps-series (variiert) |
| `contributors/contributor/nameIdentifier@schemeURI` | — | — | `https://ror.org/` ×1<br>`https://orcid.org` ×6 | — | — | `https://orcid.org` ×3 | nur datapackage, wps-series (variiert) |
| `contributors/contributor/givenName` | — | — | 6× , 6 versch. Werte | — | — | `Willi` ×1<br>`Ida` ×1<br>`Katrin` ×1 | nur datapackage, wps-series (variiert) |
| `contributors/contributor/familyName` | — | — | 6× , 6 versch. Werte | — | — | `Flieder` ×1<br>`Farn` ×1<br>`Zeder` ×1 | nur datapackage, wps-series (variiert) |
| `contributors/contributor/affiliation` | — | — | `German Centre for Higher Education Research and Science Studies (DZHW)` ×6 | — | — | `German Centre for Higher Education Research and Science Studies` ×1<br>`` ×2 | nur datapackage, wps-series (variiert) |
| `contributors/contributor/affiliation@affiliationIdentifier` | — | — | `https://ror.org/01n8j6z65` ×6 | — | — | `https://ror.org/01n8j6z65` | nur datapackage, wps-series (gleich) |
| `contributors/contributor/affiliation@affiliationIdentifierScheme` | — | — | `ROR` ×6 | — | — | `ROR` | nur datapackage, wps-series (gleich) |
| `contributors/contributor/affiliation@schemeURI` | — | — | `https://ror.org/` ×6 | — | — | `https://ror.org` | nur datapackage, wps-series (variiert) |
| `dates` | (Container) ×1 | — | (Container) ×1 | — | — | — | Container |
| `dates/date` | `2025` | — | 7× , 7 versch. Werte | — | — | — | nur dmr-de, datapackage (variiert) |
| `dates/date@dateType` | `Issued` | — | `Available` ×1<br>`Collected` ×6 | — | — | — | nur dmr-de, datapackage (variiert) |
| `dates/date@dateInformation` | — | — | 6× , 6 versch. Werte | — | — | — | nur datapackage |
| `language` | `de` | `en` | — | `deu` | `en` | `en` | nur dmr-de, dmr-en, instrument, wps-paper, wps-series (variiert) |
| `relatedIdentifiers` | (Container) ×1 | (Container) ×1 | (Container) ×1 | (Container) ×1 | (Container) ×1 | — | Container |
| `relatedIdentifiers/relatedIdentifier` | 4× , 4 versch. Werte | 4× , 4 versch. Werte | `10.21249/DZHW:nac2018:2.0.0` | `10.21249/DZHW:sid2021:1.0.0` | `10.21249/es:wps` | — | nur dmr-de, dmr-en, datapackage, instrument, wps-paper (variiert) |
| `relatedIdentifiers/relatedIdentifier@relatedIdentifierType` | `DOI` ×3<br>`URL` ×1 | `DOI` ×3<br>`URL` ×1 | `DOI` | `DOI` | `DOI` | — | nur dmr-de, dmr-en, datapackage, instrument, wps-paper (variiert) |
| `relatedIdentifiers/relatedIdentifier@relationType` | 4× , 4 versch. Werte | 4× , 4 versch. Werte | `IsNewVersionOf` | `IsPartOf` | `IsPartOf` | — | nur dmr-de, dmr-en, datapackage, instrument, wps-paper (variiert) |
| `relatedIdentifiers/relatedIdentifier@resourceTypeGeneral` | `Dataset` ×1<br>`Report` ×2<br>`Instrument` ×1 | `Dataset` ×1<br>`Report` ×2<br>`Instrument` ×1 | — | — | `Journal` | — | nur dmr-de, dmr-en, wps-paper (variiert) |
| `sizes` | (leer) | (leer) | (leer) | — | (leer) | (leer) | nur dmr-de, dmr-en, datapackage, wps-paper, wps-series (gleich) |
| `formats` | (leer) | (leer) | (leer) | — | (leer) | (Container) ×1 | nur dmr-de, dmr-en, datapackage, wps-paper, wps-series (variiert) |
| `formats/format` | — | — | — | — | — | `application/pdf` | nur wps-series |
| `version` | `3.0.0` | `3.0.0` | `3.0.0` | `1.0.0` | `1.0.0` | `1.0.0` | variiert |
| `rightsList` | (Container) ×1 | (Container) ×1 | (Container) ×1 | — | (Container) ×1 | — | Container |
| `rightsList/rights` | `Creative Commons Attribution Non Commercial Share Alike 4.0 Internati…` | `Creative Commons Attribution Non Commercial Share Alike 4.0 Internati…` | `Beantragung notwendig unter https://metadata.fdz.dzhw.eu/de/data-pack…` ×1<br>`Application necessary under https://metadata.fdz.dzhw.eu/en/data-pack…` ×1 | — | `Creative Commons Attribution 4.0 International` | — | nur dmr-de, dmr-en, datapackage, wps-paper (variiert) |
| `rightsList/rights@rightsURI` | `https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode` | `https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode` | — | — | `https://creativecommons.org/licenses/by/4.0/legalcode` | — | nur dmr-de, dmr-en, wps-paper (variiert) |
| `rightsList/rights@rightsIdentifier` | `cc-by-nc-sa-4.0` | `cc-by-nc-sa-4.0` | — | — | — | — | nur dmr-de, dmr-en (gleich) |
| `rightsList/rights@rightsIdentifierScheme` | `SPDX` | `SPDX` | — | — | — | — | nur dmr-de, dmr-en (gleich) |
| `rightsList/rights@schemeURI` | `https://spdx.org/licenses/` | `https://spdx.org/licenses/` | — | — | — | — | nur dmr-de, dmr-en (gleich) |
| `rightsList/rights@xml:lang` | — | — | `de` ×1<br>`en` ×1 | — | — | — | nur datapackage |
| `descriptions` | — | — | (Container) ×1 | — | (Container) ×1 | (Container) ×1 | Container |
| `descriptions/description` | — | — | 14× , 4 versch. Werte | — | `The framework conditions of studying such as the time available for s…` | `The EUROSTUDENT Working Paper Series offers a platform for researcher…` | nur datapackage, wps-paper, wps-series (variiert) |
| `descriptions/description@xml:lang` | — | — | `en` ×7<br>`de` ×7 | — | `en` | `en` | nur datapackage, wps-paper, wps-series (variiert) |
| `descriptions/description@descriptionType` | — | — | `Abstract` ×2<br>`Methods` ×12 | — | `Abstract` | `SeriesInformation` | nur datapackage, wps-paper, wps-series (variiert) |
| `geoLocations` | (Container) ×1 | (Container) ×1 | (Container) ×1 | — | — | — | Container |
| `geoLocations/geoLocation` | (Container) ×1 | (Container) ×1 | (Container) ×6 | — | — | — | Container |
| `geoLocations/geoLocation/geoLocationPlace` | `Hannover` | `Hannover` | `Germany` ×6 | — | — | — | nur dmr-de, dmr-en, datapackage (variiert) |
| `fundingReferences` | — | — | (Container) ×1 | (Container) ×1 | (Container) ×1 | (Container) ×1 | Container |
| `fundingReferences/fundingReference` | — | — | (Container) ×2 | (Container) ×1 | (Container) ×1 | (Container) ×2 | Container |
| `fundingReferences/fundingReference/funderName` | — | — | `Bundesministerium für Bildung und Forschung (BMBF)` ×1<br>`Federal Ministry of Education and Research` ×1 | `Bundesministerium für Bildung und Forschung` | `Bundesministerium für Forschung, Technologie und Raumfahrt` | `Bundesministerium für Forschung, Technologie und Raumfahrt` ×1<br>`European Commission` ×1 | nur datapackage, instrument, wps-paper, wps-series (variiert) |
| `fundingReferences/fundingReference/funderIdentifier` | — | — | — | — | `https://doi.org/10.13039/501100002347` | `https://doi.org/10.13039/501100002347` ×1<br>`https://doi.org/10.13039/501100000780` ×1 | nur wps-paper, wps-series (variiert) |
| `fundingReferences/fundingReference/funderIdentifier@funderIdentifierType` | — | — | — | — | `Crossref Funder ID` | `Crossref Funder ID` ×2 | nur wps-paper, wps-series (gleich) |
<!-- END GENERATED -->

## 4. Einordnung für die Profile (Vorschlag, in Phase 4 zu bestätigen)

Pro Typ gibt es nur **eine** Fixture. „Konstant“ heißt daher: gleich zwischen dmr-de und dmr-en bzw.
naheliegend institutionell fix. Das ist eine Hypothese und bestätigt keine Regel. Offene Punkte
stehen in Abschnitt 6.

Legende:
- **P**: Profilwert (vorbelegt)
- **M**: nach Muster abgeleitet (aus Studie, Version, Sprache)
- **V**: variiert je Eintrag
- **—**: nicht verwendet

| Feld | DMR (de/en) | DP | Anmerkung |
|---|---|---|---|
| `identifier` (DOI) | M: `10.21249/DZHW:<STUDIE>-DMR-<LANG>:<version>` | M: `10.21249/DZHW:<STUDIE>:<version>` | Im Identifier großgeschrieben, in relatedIdentifiers teils klein (siehe 5) |
| `identifier@identifierType` | P: `DOI` | P: `DOI` | |
| `creators/creator` | V | V | Reihenfolge zitationsrelevant. DP hat zusätzlich einen organisationalen Creator (DZHW) am Ende. |
| `creatorName@nameType` | P: `Personal` | V: `Personal` / `Organizational` | |
| `givenName`, `familyName` | V | V | `creatorName` = „Familienname, Vorname“ |
| `nameIdentifier` (ORCID) | V, Format `https://orcid.org/<iD>` | V, Format `<iD>` ohne URL | Formate uneinheitlich (siehe 5) |
| `nameIdentifier@nameIdentifierScheme` / `@schemeURI` | P: `ORCID` / `https://orcid.org` | P: `ORCID` / `https://orcid.org` | |
| `creator/affiliation` | V, mit ROR | V, **ohne** ROR, Name mit „(DZHW)“ | Uneinheitlich (siehe 5) |
| `affiliation@affiliationIdentifierScheme` / `@schemeURI` | P: `ROR` / `https://ror.org` | — | |
| `titles/title` | V, genau 1 Titel | V, Titel de + en | |
| `title@xml:lang` | de: `de`, en: **fehlt** | `de`, `en` | |
| `publisher` | P: „German Centre for Higher Education Research and Science Studies“ | P: dasselbe + „ (DZHW)“ | Uneinheitlich (siehe 5) |
| `publisher@publisherIdentifier` / `@…Scheme` | P: `https://ror.org/01n8j6z65` / `ROR` | P: dasselbe | |
| `publisher@schemeURI` | P: `https://ror.org` | P: `https://ror.org/` | Schrägstrich am Ende uneinheitlich |
| `publisher@xml:lang` | — | P: `en` | |
| `publicationYear` | V | V | |
| `resourceType` | P: `Data and Method Report` | P: leer | |
| `resourceType@resourceTypeGeneral` | P: `Report` | P: `Dataset` | |
| `subjects/subject` | — | V: Freitext de/en + ELSST | |
| `subject@subjectScheme` / `@schemeURI` | — | P (für ELSST): `CESSDA European Language Social Science Thesaurus (ELSST)` / `https://thesauri.cessda.eu/elsst-4/en/` | ELSST-Begriffe je Konzept in en und de, gleiche `valueURI` |
| `subject@valueURI` | — | V | |
| `contributors/contributor` | — | V | |
| `contributor@contributorType` | — | P: `Distributor` (1×) + V: `DataCurator` | |
| Distributor | — | P: „FDZ-DZHW“, `Organizational`, nameIdentifier ROR `https://ror.org/01n8j6z65` | |
| DataCurator | — | V: Personen mit ORCID + Affiliation mit ROR | |
| `dates/date` | de: `Issued` = Jahr; en: **keine dates** | `Available` (Datum) + `Collected` je Welle (Zeitraum + `dateInformation`) | |
| `language` | M: `de` / `en` | — | |
| `relatedIdentifiers` | siehe unten | siehe unten | |
| `sizes`, `formats` | leer | leer | Leere Wrapper, vermutlich Artefakt der Serialisierung |
| `version` | V (= Datenpaketversion) | V | |
| `rightsList/rights` | P: CC BY-NC-SA 4.0 mit `rightsURI` | M: Freitext de/en mit Link auf die Datenpaketseite | |
| `descriptions` | — | V: `Abstract` de/en, `Methods` de/en | |
| `geoLocations/geoLocationPlace` | P?: `Hannover` | V: `Germany` (6×) | Bedeutung von „Hannover“ im DMR unklar (siehe 6) |
| `fundingReferences/funderName` | — | V: Förderer de + en als zwei Einträge, ohne `funderIdentifier` | |

### relatedIdentifiers im Detail

| # | DMR (de/en) | DP |
|---|---|---|
| 1 | `IsSupplementTo` → DP-DOI, `DOI`, rTG `Dataset` | `IsNewVersionOf` → DP-Vorversion, `DOI`, ohne rTG |
| 2 | `IsNewVersionOf` → DMR-Vorversion gleicher Sprache, `DOI`, rTG `Report` | |
| 3 | `IsSupplementedBy` → QuestionOrigin.xlsx, `URL`, rTG `Instrument` | |
| 4 | `IsTranslationOf` → DMR der anderen Sprache, `DOI`, rTG `Report` | |

(rTG = `resourceTypeGeneral`)

Das DP verweist **nicht** zurück auf die DMR (kein `IsSupplementedBy`). Das ist relevant für die in
Phase 7 geplante „Datenpaket-Relation aktualisieren“.

## 5. Auffälligkeiten in den Fixtures (nur dokumentiert, nicht korrigiert)

Die Fixtures sind anonymisierte Kopien (siehe Abschnitt 1); die genannten Namen sind erfunden, die
Auffälligkeiten selbst stammen aus den echten Datensätzen.

1. **dmr-en, vierter Creator:** Vor- und Nachname vertauscht (`Wicke, Olive` statt `Olive, Wicke`,
   givenName und familyName ebenso getauscht). In dmr-de steht es korrekt.
2. **Sechster Creator:** in dmr-de mit abweichender Vornamensschreibweise und ohne ORCID, in dmr-en und im
   Datenpaket mit ORCID. (Im Original war es eine Buchstabe-für-Buchstabe-Variante desselben Vornamens; die
   Anonymisierung macht daraus zwei verschiedene erfundene Vornamen, der Unterschied bleibt.)
3. **dmr-en:** Beim neunten Creator fehlt die Affiliation, die in dmr-de vorhanden ist. Außerdem fehlen
   `dates`, der Titel hat kein `xml:lang` und endet mit einem Leerzeichen, und `publicationYear` ist 2026 statt 2025.
4. **ORCID-Format:** In den DMR steht die volle URL (`https://orcid.org/…`), im DP die nackte iD.
5. **Organisationsname und ROR:**
   - DMR: „German Centre for Higher Education Research and Science Studies“, `schemeURI="https://ror.org"`.
   - DP: dasselbe mit „ (DZHW)“, `schemeURI="https://ror.org/"`.
   - DP-Creator-Affiliationen haben keine ROR-ID, DP-Contributor-Affiliationen dagegen schon.
6. **Groß-/Kleinschreibung der DOIs:** `identifier` ist großgeschrieben (`DZHW:NAC2018-DMR-DE`). Die relatedIdentifiers
   schreiben `dzhw:nac2018…` in den DMR und `DZHW:nac2018…` im DP. DOIs sind case-insensitiv, formal ist das also korrekt.
7. **DP, Wiederholungen:** Die `Methods`-Beschreibung (de+en) steht 6× identisch, `geoLocationPlace` „Germany“ ebenfalls 6×.
   Vermutlich wird beides je Erhebungswelle erzeugt.
8. **URLs mit `$`:** Beispiele sind `stu-nac2018$-3.0.0` und `stu-nac2018$?version=3.0.0`. Das ist offenbar die ID-Konvention
   des FDZ-Metadatenkatalogs und kein Fehler.
9. **Funding:** Derselbe Förderer steht als zwei `fundingReference` (de/en), ohne `funderIdentifier`. Das BMBF heißt seit
   2025 BMFTR (entschieden, siehe Abschnitt 6).
10. **instrument:**
    - `resourceTypeGeneral="Other"` mit Freitext „Instrument“
    - `language` ist `deu` (ISO 639-3)
    - publisher mit „(DZHW)“ und ohne ROR
    - der relatedIdentifier-Wert endet mit einem Leerzeichen (`10.21249/DZHW:sid2021:1.0.0 `)
    - keine Rechteangabe
11. **wps-paper / wps-series:**
    - publisher ist „EUROSTUDENT-DZHW“, ohne ROR
    - `resourceType` ist leer
    - ROR-`schemeURI` ohne Schrägstrich
    - leere `<affiliation/>` bei Editors
    - Förderer mit Crossref Funder ID
    - Das Paper verweist per `IsPartOf` (`resourceTypeGeneral="Journal"`) auf die Reihen-DOI, die selbst den Typ `Collection` hat.

## 6. Entscheidungen (2026-09-21)

Diese Entscheidungen gehen der vorläufigen Einordnung in Abschnitt 4 vor.

### Umfang

- **Hauptanwendung:** Daten- und Methodenberichte (DMR, de/en) sowie weitere Dokumente:
  - generisches Dokument
  - Fragebogen/Instrument
  - Variablen-/Codebook-Report
  - Working/Data Paper
- **Datenpakete** werden auf einem anderen Weg doifiziert. **Es gibt kein Datenpaket-Profil.** Datenpaket-XML wird nur
  gelesen (Phase 7), um Studie, Version, Relationen und Förderangaben für Dokumente abzuleiten.
  Die DP-Entscheidungen weiter unten dienen deshalb nur als Referenz für das Lesen.
- **Profile für die neuen Dokumenttypen:** siehe „Dokumentprofile“ weiter unten.

### Vereinheitlichung (gilt für alle erzeugten Datensätze)

| Punkt | Entscheidung |
|---|---|
| ORCID-Format | volle URL `https://orcid.org/<iD>` |
| Name des DZHW (publisher, affiliation) | ohne „(DZHW)“: „German Centre for Higher Education Research and Science Studies“ (= ROR-Anzeigename) |
| ROR bei Affiliationen | immer mit ROR-ID, wo bekannt (`affiliationIdentifier`, Scheme `ROR`) |
| `schemeURI` für ROR | `https://ror.org/` (mit Schrägstrich) |
| Leere Wrapper `<sizes/>`, `<formats/>` | weglassen (entspricht dem Verhalten aus Phase 3) |
| Zeilenumbrüche in Beschreibungen | als `<br/>` schreiben (umgesetzt in Phase 4) |
| Sprachcode (`language`, `xml:lang`) | `de` / `en` (ISO 639-1), nicht `deu` |
| Förderer | „Bundesministerium für Forschung, Technologie und Raumfahrt“ mit `funderIdentifier funderIdentifierType="Crossref Funder ID"` = `https://doi.org/10.13039/501100002347`. Nur ein Eintrag, kein de/en-Doppel. Angaben aus Datenpaketen (z. B. „BMBF“) werden beim Übernehmen darauf normalisiert. |
| Relation zum Datenpaket | **`IsPartOf`** für alle studienbezogenen Dokumente (DMR, Fragebogen, Codebook-Report). Das Dokument ist Teil des vollständigen Datenpakets (OAIS-AIP). `IsSupplementTo` erst, wenn es DOIs für einzelne Datensätze gibt, dann zur Datensatz-DOI. |
| Vorgeschlagene Relationen | `IsNewVersionOf` → Vorversion; `IsTranslationOf` → Fassung in der anderen Sprache (wechselseitig); `IsPartOf` → Datenpaket |

### DMR

| Punkt | Entscheidung |
|---|---|
| DOI-Muster | `10.21249/DZHW:<studie>-dmr-<lang>:<version>` |
| Typ | `resourceTypeGeneral="Report"`, Freitext **„Data and Methods Report“**. Bisher „Data and Method Report“; geändert, weil idiomatischer und passend zu „Methodenbericht“. |
| Relation zum Datenpaket | `IsPartOf` (bisher `IsSupplementTo`, siehe Vereinheitlichung) |
| dmr-en-Abweichungen (5.1–5.3) | Fehler. dmr-de ist das Vorbild: EN mit `dates/Issued` und `title@xml:lang="en"` |
| `geoLocationPlace` „Hannover“ | variiert je Bericht, kein fester Profilwert |
| Rechte | CC BY-NC-SA 4.0 vorbelegt und änderbar, **mit SPDX-Attributen** (`rightsIdentifier="cc-by-nc-sa-4.0"`, `rightsIdentifierScheme="SPDX"`, `schemeURI="https://spdx.org/licenses/"`) |
| QuestionOrigin.xlsx (`IsSupplementedBy`) | Einzelfall, nicht vorbelegen |
| Altbestand beim Laden (entschieden 2026-09-24) | Eine übernommene `IsSupplementTo`-Verknüpfung auf dasselbe Datenpaket wird entfernt, weil das Profil es als `IsPartOf` verknüpft. In übrigen übernommenen Verknüpfungen wird die alte Versionsnummer durch die neue ersetzt (z. B. Anhang-URLs). Beides erscheint als Hinweis in der Prüfliste. |
| Förderangaben | beim Anlegen aus dem zugehörigen Datenpaket vorschlagen |
| Landingpage (entschieden 2026-09-30) | Die Landingpage ist **kein XML-Feld**: DataCite führt sie neben den Metadaten (`data.attributes.url` der REST-API, in Fabrica das Feld „URL“). Das Werkzeug zeigt sie deshalb nur zum Kopieren an. Muster für den DMR, abgeleitet aus den registrierten Adressen: `https://metadata.fdz.dzhw.eu/public/files/data-packages/stu-{studie}$-{version}/attachments/{studie}_MethodReport_{de\|en}.pdf`. So registriert sind phd2014 (5.0.0, 6.0.0) und scs2023 (1.0.1, 2.0.0). Abweichungen im Bestand: nac2018 und nac2020 tragen die Version zusätzlich im Dateinamen (`nac2018_MethodReport_3-0-0_de.pdf`), scs2023-dmr-en 1.0.1 und base4nfdi lassen `-{version}` im Pfad weg, base4nfdi schreibt außerdem `MethodsReport`. Beim Laden einer DOI zeigt das Werkzeug die **tatsächlich registrierte** Adresse und daneben den Vorschlag des Musters. |
| Schlagwörter aus dem Datenpaket (entschieden 2026-09-24) | Ist ein Datenpaket verknüpft (`IsPartOf`, altbestandshalber auch `IsSupplementTo`, jeweils auf eine DOI mit `resourceTypeGeneral="Dataset"`), lassen sich dessen Schlagwörter im Abschnitt Schlagwörter zur Auswahl holen. Sie werden **ergänzt, nicht ersetzt**; identische Einträge (Begriff, Thesaurus, `valueURI` und `xml:lang` gleich, Groß-/Kleinschreibung egal) werden übersprungen. Vorausgewählt sind die noch fehlenden Einträge in der Sprache des Datensatzes, die der anderen Sprache bleiben zuwählbar. |

### Datenpaket (nur als Referenz für das Lesen)

| Punkt | Entscheidung |
|---|---|
| Rechte | festes Muster „Beantragung notwendig unter …/&lt;lang&gt;/data-packages/stu-&lt;studie&gt;$?version=&lt;version&gt;“ (de + en) |
| Organisationaler Creator DZHW | immer am Ende der Creator-Liste |
| Distributor / DataCurators | beide vorbelegt (FDZ-DZHW mit ROR; aktuelles Curator-Team) |
| Wiederholungen (Methods, „Germany“) | bereinigen: identische Duplikate zusammenfassen, mit Hinweis |

#### Typisierung eines Datenpakets (OAIS-AIP)

Entschieden am 2026-09-22. Diese Regel betrifft den **anderen Registrierungsweg**: Das Tool erzeugt keine
Datenpaket-DOIs, es liest sie nur. Beide Varianten kann es lesen.

| Punkt | Entscheidung |
|---|---|
| `resourceTypeGeneral` | **`Dataset`**, nicht `Collection` |
| Freitext `resourceType` | präzisiert das Paket, z. B. „Data package (OAIS AIP)“ |
| Bestandteile | Paket → `HasPart` auf Bericht, Fragebogen, Codebook-Report; Dokumente → `IsPartOf` auf das Paket |
| Umfang | `sizes` und `formats` beschreiben das Paket als Objekt |
| Interne ID | `alternateIdentifier` trägt die AIP-/Repository-ID, falls vorhanden |
| Lebenszyklus | `dates`: `Submitted` (Eingang), `Available` (Veröffentlichung), `Updated` (Revision) |

Begründung:
- Zitiert und gesucht wird die Studie als Daten. DataCite Search, OpenAIRE, BASE und da|ra filtern auf `Dataset`;
  unter `Collection` fehlt das Paket in genau diesen Treffermengen.
- Der Ressourcentyp soll sagen, *was* man bekommt (Erhebungsdaten), nicht, in welcher Form archiviert wurde.
  Die archivische Kategorie gehört in den Freitext.
- Der Bestand ist überwiegend `Dataset` (Ausnahmen: `kroher2023` als `Collection`, ein Eintrag als `Other`).
- DataCite kennt keinen Typ „Package“; `Other` taucht in keiner Facette auf.

**Ausnahme:** `Collection` bleibt richtig, wenn ein Paket mehrere gleichrangige, thematisch getrennte Datensätze
mit je eigener DOI bündelt und kein Datensatz dominiert.

**Offene Lücke im Bestand:** Die Dokumente verweisen per `IsPartOf` auf das Paket, das Paket verweist **nicht**
zurück (kein `HasPart`). Das sollte im Registrierungsweg für Datenpakete ergänzt werden.


### Dokumentprofile (neue Typen)

| | Fragebogen / Instrument | Codebook-Report | Working / Data Paper | Generisches Dokument |
|---|---|---|---|---|
| `resourceTypeGeneral` | `Instrument` (neu; Bestand nutzt `Other`) | `Report` | wählbar: `Report` oder `DataPaper` | Auswahl: `Text`, `Report`, `Book`, `BookChapter`, `Preprint`, `Presentation`, `Poster`, `Other` |
| Freitext `resourceType` | „Questionnaire“ | „Variable Report“ | „Working Paper“ bzw. „Data Paper“ | frei |
| DOI-Muster | `10.21249/DZHW:<studie>-ins<n>-att<m>:<version>` (`ins<n>`: Instrument-ID aus dem MDM, `att<m>`: Anhang) | `10.21249/DZHW:<studie>-ds<n>_DsReport_<lang>:<version>` (`ds<n>`: Datensatz) | Reihen-Modell: Reihe wählbar (Reihen-DOI, Publisher, Suffixmuster). Erste Reihe: EUROSTUDENT `10.21249/es:wps:<nr><jahr>:<version>`. Ohne Reihe: Präfix `10.21249/`, Suffix frei | Präfix `10.21249/DZHW:`, Suffix frei |
| Relation zum Datenpaket | `IsPartOf` | `IsPartOf` | – | – |
| Weitere Relationen | `IsNewVersionOf` | `IsNewVersionOf`, `IsTranslationOf` (de/en) | `IsPartOf` → Reihen-DOI (`resourceTypeGeneral="Journal"`, wie Bestand), `IsNewVersionOf` | `IsNewVersionOf` |
| Rechte | keine Vorbelegung | keine Vorbelegung | Bestand EUROSTUDENT: CC BY 4.0 (Reihenwert) | keine Vorbelegung |
| Förderangaben | aus Datenpaket, normalisiert | aus Datenpaket, normalisiert | Reihenwert (EUROSTUDENT: BMFTR + European Commission, jeweils mit Crossref Funder ID) | keine Vorbelegung |

### Ergänzungen zu den Dokumentprofilen

| Punkt | Entscheidung |
|---|---|
| Sprache beim Fragebogen | Ein Anhang (`att<m>`) kann mehrsprachig sein. `language` ist die Hauptsprache. Keine automatische `IsTranslationOf`-Verknüpfung zwischen Anhängen. |
| Suffix der EUROSTUDENT-Reihe | `es:wps:<NN><JJJJ>:<version>`: zweistellige laufende Nummer + Jahr, z. B. `012026` |
| Publisher der EUROSTUDENT-Papers | Reihenwert „EUROSTUDENT-DZHW“, ohne `publisherIdentifier` (wie Bestand) |
| Publisher bei Fragebogen | vereinheitlicht wie DMR: ROR-Name + `publisherIdentifier` `https://ror.org/01n8j6z65`, Scheme `ROR`, `schemeURI` `https://ror.org/` |

## 7. Noch offen

Offene Punkte stehen in `docs/todo.md`. Zurzeit: das Standardschema für Fragebögen (Vorbelegung des
Profils `instrument`) ist noch nicht festgelegt.
