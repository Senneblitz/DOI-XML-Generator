# CLAUDE.md – Konventionen für dieses Projekt

Lokales Tool zur Erzeugung von DataCite-konformem Metadaten-XML für DOI-Registrierungen des
FDZ-DZHW. Hauptanwendung: Daten- und Methodenberichte (de/en) und weitere Dokumente. Datenpakete
werden anderweitig doifiziert und hier nur gelesen, z. B. für Relationen. Das XML wird manuell in
DataCite Fabrica hochgeladen. Keine Credentials, keine Registrierung per API.

Verbindliche inhaltliche Entscheidungen: `docs/mapping.md`, Abschnitt 6.

## Arbeitsweise (verbindlich)

- Strikt phasenweise arbeiten. Vor jeder Phase kurz darstellen, was geplant ist, und auf Freigabe warten.
- Nach jeder Phase: Tests laufen lassen, committen (aussagekräftige Commit-Message auf Englisch),
  Ergebnis kurz zusammenfassen, **stoppen**.
- Keine Features über die aktuelle Phase hinaus. Offene Fragen stellen statt Annahmen treffen.
- Inhaltliche Konventionen (resourceTypeGeneral, relationType, rights, publisher usw.) **nicht erfinden**,
  sondern aus den Fixtures (`fixtures/`, `docs/mapping.md`) ableiten und bei Unklarheit nachfragen.

## Sprache

- Dokumentation (README, CLAUDE.md, `docs/`) und UI-Texte: Deutsch.
- Code, Bezeichner, Code-Kommentare und Commit-Messages: Englisch.

## Technik

- Vanilla JavaScript (ES-Module), HTML, CSS. Kein Framework, kein Bundler, kein Build-Schritt.
- Keine Laufzeit-Abhängigkeiten aus CDNs, außer nach ausdrücklicher Zustimmung.
- Einzige Laufzeit-Abhängigkeit: `vendor/xmllint-wasm` (MIT) für die Schemaprüfung im Browser, lokal
  ausgeliefert und erst bei Bedarf geladen. Kopie aktualisieren mit `node tools/vendor.js`.
- Auslieferung über lokalen statischen Server (`python -m http.server 8123`), nicht über `file://`.
  Dieselben Dateien laufen unverändert auf GitHub Pages (siehe README); alle Pfade bleiben deshalb
  relativ zur Seite, nie absolut ab Serverwurzel.
- Tests mit `node --test` für Modell, Parser und Serializer, ohne DOM. Dev-Dependencies nur nach
  Vorschlag mit Begründung und Zustimmung.
- Einzige Dev-Dependency: `@xmldom/xmldom` stellt `DOMParser`/`XMLSerializer` in Node-Tests bereit.
  `src/xml/parse.js` nutzt nur die Standard-DOM-API (im Browser nativ) und bekommt sie in Tests injiziert.
  Der Browser-Code lädt nie etwas aus `node_modules`.
- Schema-Validierung in der Entwicklung mit `xmllint --noout --schema`.
- Speicherstände als JSON-Dateien (Export/Import), kein `localStorage` für Nutzdaten.
- Externe APIs (ROR, ORCID, DataCite) nur lesend. API-Fehler dürfen die Formularnutzung nie blockieren.
- **Veröffentlicht wird nur der Zweig `public`** (ohne Vorgeschichte, `node tools/public-branch.js sync`).
  `main` bleibt privat, seine Historie enthält die Originaldaten. Ein `pre-push`-Hook erzwingt das.
- **Keine personenbezogenen Daten im Repository.** Das Repository ist öffentlich. Echte Namen und ORCID iDs
  gehören nach `fixtures-private/` (ignoriert); `fixtures/` enthält anonymisierte Kopien aus
  `node tools/anonymize.js`. In Tests, Doku und Beispielen keine realen Personen nennen; als Beispielperson
  dient „Josiah Carberry“ (fiktive ORCID-Demonstrationsperson). Ein Test bewacht das für die Fixtures.

## Repo-Struktur

```
/index.html
/src/model/        internes Datenmodell, Defaults, Validierung Pflichtfelder
/src/xml/          serialize.js (Modell → XML), parse.js (XML → Modell)
/src/ui/           Formular, wiederholbare Gruppen, Vorschau
/src/api/          ror.js, orcid.js, datacite.js (nur lesend)
/profiles/         base.json, dmr-de.json, dmr-en.json, instrument.json, dsreport.json, paper.json,
                   generic.json, series.json (Reihen); kein Datenpaket-Profil
/data/Creators.json lokale Personenliste, nicht im Repository (.gitignore)
/schema/           DataCite-XSD inkl. aller include-Dateien, Version dokumentiert
/fixtures/         anonymisierte Referenz-XMLs (+ _crosscheck/), erzeugt aus fixtures-private/
/fixtures-private/ Originale mit echten Personenangaben, nicht im Repository (.gitignore)
/tools/            Entwicklungs-Skripte (z. B. Feldinventar)
/tests/
/docs/             spike.md, mapping.md
```

## Phasen

0. Setup
1. Fixtures und Schema (+ `docs/mapping.md`)
2. CORS-Spike ROR/ORCID (`docs/spike.md`), danach Entscheidung durch Nutzer
3. Modell, Parser, Serializer inkl. Roundtrip-Tests
4. Profile
5. Formular
6. ROR- und ORCID-Anbindung
7. Bestehende DOI laden, neue Version anlegen
8. (optional) XSD-Validierung im Browser via xmllint-wasm

## Stand (2026-09-22)

Alle Phasen abgeschlossen und committet, einschließlich der Schemaprüfung im Browser (xmllint-wasm, lokal
unter `vendor/`) und der Sprachfassungen (Gegenstück erzeugen, Felder übernehmen, vergleichen).
Weitere Änderungen kommen aus dem Praxistest. Offene Punkte: `docs/todo.md`.

Umgesetzt in Phase 5 (zur Erinnerung):

Festlegungen für Phase 5:
1. Die Auswahllisten (resourceTypeGeneral, relationType, dateType usw.) werden per Skript aus der XSD erzeugt, nicht von Hand gepflegt.
2. Profil- und ggf. Reihenauswahl, Eingabe der Platzhalter, DOI-Vorschau live.
3. Formular mit allen Feldern aus `docs/mapping.md`, Titel und Beschreibungen mit `xml:lang`.
4. Wiederholbare Gruppen: hinzufügen, entfernen, verschieben. Die Creator-Reihenfolge ist zitationsrelevant.
5. Gesperrte Profilfelder sind **entsperrbar mit Hinweis**: standardmäßig deaktiviert, per Schalter bewusst entsperrbar,
   die Abweichung erscheint dann als Hinweis in der Prüfliste.
6. Prüfliste: Pflichtfelder (`validate`), Profilabweichungen (`checkProfile`), Parser-Warnungen. Daneben die Live-XML-Vorschau.
7. Download als `.xml` (Dateiname aus der DOI). Speichern/Laden als JSON mit Profil, Reihe, Platzhalterwerten und Modell
   (`completeResource` beim Laden).
8. **Lokale XML-Datei öffnen:** parse → Formular. Das Profil wird über `parseDoi` erkannt, sonst `generic`.
   Das Laden per DOI bleibt Phase 7.
9. Tests: Node-Tests für die DOM-freien Teile (Speicherformat, Dateiname, Vokabulare), das Formular selbst im Browser prüfen.
