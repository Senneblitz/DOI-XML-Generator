# Offene Punkte

Liste der Dinge, die noch zu klären oder einzustellen sind. Erledigtes wandert als Entscheidung in
`docs/mapping.md`, Abschnitt 6, und wird hier gestrichen.

## Landingpage-Muster für die übrigen Profile festlegen

**Stand:** offen, aufgenommen am 2026-09-30.

Für die Daten- und Methodenberichte ist das Muster festgelegt (`docs/mapping.md`, Abschnitt 6) und in
`profiles/dmr-de.json` und `profiles/dmr-en.json` hinterlegt. Für die anderen Profile fehlt es, weil der
Bestand keine belastbare Regel hergibt:

- **Fragebogen / Instrument:** zwei Registrierungen, zwei Formen — `qmf2021-ins1-att1` zeigt auf eine PDF-Datei
  (`public/files/instruments/ins-qmf2021-ins1$-1.0.0/attachments/qmf2021_Fragebogen_v1.0.pdf`, Version im
  Dateinamen zweistellig), `sid2021-ins1-att1` auf eine Übersichtsseite (`de/instruments/ins-sid2021-ins1`).
  Gehört zum Standardschema für Fragebögen (siehe unten).
- **Datensatzbericht (dsreport):** keine registrierte DOI, also kein Muster ableitbar.
- **Working Paper (EUROSTUDENT):** nur ein Beispiel, und das sieht fehlerhaft aus
  (`https://www.eurostudent.eu/publications/wps_1_2026:1.0.0` – der DOI-Suffix steht in der URL).

Bis das geklärt ist, zeigt das Feld „Landingpage“ für diese Profile einen Hinweis und bleibt leer zum
Selbsteintragen.

## Standardschema für Fragebögen festlegen

**Stand:** offen, aufgenommen am 2026-09-24.

Das Profil `profiles/instrument.json` („Fragebogen / Instrument“) ist bisher nur aus dem einen Fixture
`fixtures/sid2021-ins1-att1_1.0.0.xml` abgeleitet und deckt die Vorbelegung noch nicht vollständig ab. Es
steht fest:

- DOI-Muster `DZHW:{studie}-ins{ins}-att{att}:{version}`,
- `resourceTypeGeneral="Instrument"` mit Freitext „Questionnaire“,
- Publisher wie beim DMR (ROR-Name, `publisherIdentifier`, `schemeURI`), gesperrt,
- Relationen `IsPartOf` auf das Datenpaket und `IsNewVersionOf` auf die Vorversion,
- `language` ist empfohlen, aber nicht vorbelegt.

Offen ist, was ein Fragebogen standardmäßig mitbringen soll. Zu entscheiden sind mindestens:

- **Rechte:** Gilt CC BY-NC-SA 4.0 wie beim DMR, eine andere Lizenz oder gar keine Vorbelegung?
- **Titel:** feste Form (z. B. „Fragebogen der …“) in einer oder beiden Sprachen, und welches `xml:lang`?
- **Sprache:** Vorbelegung `de`, oder bleibt sie pro Instrument offen?
- **Beschreibungen:** ein Standardtext (`Abstract`, `Methods`, `TechnicalInfo`) oder leer?
- **Creators und Contributors:** dieselben wie beim zugehörigen DMR, die Studienleitung oder leer?
- **Zeitangaben:** `Issued` mit dem laufenden Jahr wie beim DMR?
- **Weitere Relationen:** Verweis auf den DMR der Studie, und mit welchem `relationType`?
- **Mehrere Anhänge:** Sind `ins`/`att` immer zweistellig verwendet, und gibt es eine Konvention für
  Instrumente ohne Anhang?

**Nächster Schritt:** Die registrierten Fragebogen-DOIs unter dem Präfix 10.21249 durchsehen (wie in
`docs/mapping.md`, Abschnitt 2, für die anderen Typen geschehen), daraus die Regelmäßigkeiten ableiten,
die offenen Punkte vorlegen und das Ergebnis als Entscheidung in Abschnitt 6 festhalten. Erst danach das
Profil anpassen.
