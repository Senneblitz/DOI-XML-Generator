# Changelog

Alle nennenswerten Änderungen am DataCite Maker. Das Format folgt
[Keep a Changelog](https://keepachangelog.com/de/1.1.0/), die Nummerierung
[Semantic Versioning](https://semver.org/lang/de/): Die Version des Werkzeugs steht in
`src/version.js` und in `package.json` und wird im Kopf der Anwendung angezeigt.

Nicht zu verwechseln mit zwei anderen Nummern: `SAVE_VERSION` zählt das Format der Speicherstände,
und die Version im Formular gehört zum beschriebenen Datensatz.

## [Unveröffentlicht]

## [1.0.0] – 2026-10-04

Erste vollständige Fassung. Das Werkzeug erzeugt DataCite-konformes Metadaten-XML (Schema 4.7) für die
DOI-Registrierungen des FDZ-DZHW; hochgeladen wird es weiterhin von Hand in DataCite Fabrica.

### Formular

- Alle Felder des Kernels 4.7 mit wiederholbaren Gruppen, verschiebbaren Einträgen und
  `xml:lang` bei Titeln, Beschreibungen und Schlagwörtern. Die Reihenfolge der Creators bleibt erhalten.
- Live-Vorschau des XML neben einer Prüfliste aus Pflichtfeldern, Profilabweichungen und Importmeldungen.
- Auswahllisten (`resourceTypeGeneral`, `relationType`, `dateType` …) werden aus der XSD erzeugt, nicht
  von Hand gepflegt.
- Vor dem Entfernen eines Eintrags wird gefragt, mit Nennung seines Inhalts; leere Einträge gehen ohne
  Rückfrage.

### Profile

- Profile für Daten- und Methodenberichte (deutsch und englisch), Fragebögen, Datensatzberichte,
  Working Paper mit Reihen und ein generisches Profil, jeweils mit DOI-Muster, Vorbelegungen,
  gesperrten Feldern und Vorlagen für Verknüpfungen.
- Gesperrte Profilfelder lassen sich bewusst entsperren; die Abweichung erscheint in der Prüfliste.
- Veraltete Verknüpfungen aus älteren Datensätzen werden beim Laden bereinigt.

### Bestehende Datensätze

- Registrierte DOI von DataCite laden (das hinterlegte XML, nicht die neu erzeugte Fassung) und lokale
  XML-Dateien öffnen; das Profil wird an der DOI erkannt.
- Nach dem Laden fragt das Werkzeug, ob daraus eine neue Version entstehen soll — mit Wahl zwischen
  Major, Minor und Patch und der konkreten Zielversion.
- Eine neue Version zählt Version und DOI hoch, trägt die Vorversion ein und stellt die Verknüpfungen um.
- Deutliche Warnung, wenn der geladene Datensatz einen anderen Typ hat als das Profil erzeugt, und ein
  Hinweis, wenn das Laden das ausgewählte Profil wechselt.

### Übernehmen und Abnehmen

- Felder aus einer beliebigen DOI, aus der Vorversion oder aus der anderen Sprachfassung übernehmen,
  jeweils über eine Auswahl mit Haken.
- Jedes übernommene Feld wird rot umrandet und muss freigegeben werden; danach ist es grün. Creators
  werden einzeln abgenommen, und wer ein Feld bearbeitet, hat es damit geprüft.
- Der Prüfstand wandert in den Speicherstand.

### Sprachfassungen

- Gegenstück erzeugen, Felder übernehmen und beide Fassungen vergleichen; sprachneutrale Unterschiede
  erscheinen als Hinweise, noch nicht übersetzte Texte werden als solche geführt.

### Schlagwörter aus dem Datenpaket

- Schlagwörter des verknüpften Datenpakets übernehmen, mit Auswahl der Datenpaketversion (die verknüpfte
  ist oft noch nicht registriert) und getrennt nach freien Schlagwörtern und ELSST-Thesaurusbegriffen.

### Nachschlagen

- ROR für Affiliationen, ORCID für Personen, dazu eine optionale lokale Personenliste. Ausfälle der APIs
  blockieren das Formular nicht.

### Prüfen und Sichern

- Schemaprüfung gegen die DataCite-XSD direkt im Browser (xmllint-wasm, lokal ausgeliefert).
- Download als XML, Speicherstand als JSON mit Profil, Platzhaltern, Modell, Prüfstand und Landingpage.
- Landingpage zum Kopieren: für Berichte nach dem registrierten Muster gebildet, beim Laden die
  tatsächlich registrierte Adresse. Sie gehört nicht ins XML, sondern in das URL-Feld in Fabrica.

### Betrieb

- Start über `start.bat` oder `python tools/serve.py`; dieselben Dateien laufen unverändert auf
  GitHub Pages.
- 154 Tests mit `node --test`, dazu Roundtrip- und Schemaprüfung gegen Referenz-XMLs.

### Hinweise

- Die Referenz-XMLs im Repository sind anonymisierte Kopien registrierter Datensätze; echte Namen und
  ORCID iDs bleiben lokal (siehe README, „Personendaten“).
- Veröffentlicht wird nur der Zweig `public` ohne Vorgeschichte; ein `pre-push`-Hook erzwingt das und
  lässt Tags nur durch, wenn sie auf einen Commit dieses Zweigs zeigen.
- Lizenz: MIT.
