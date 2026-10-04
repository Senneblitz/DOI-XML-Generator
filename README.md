# DataCite Maker

Lokales Werkzeug zur Erzeugung von DataCite-konformem Metadaten-XML für DOI-Registrierungen
des FDZ-DZHW (Daten- und Methodenberichte und weitere Dokumente; Datenpakete werden nur gelesen). Das erzeugte XML wird manuell in
[DataCite Fabrica](https://doi.datacite.org/) hochgeladen. Das Tool speichert keine Credentials
und registriert nichts per API.

> **Keine Gewähr für die erzeugten Metadaten.** Das Werkzeug unterstützt beim Erstellen, es ersetzt die
> fachliche Prüfung nicht. Vor der Registrierung gehören Prüfliste und Schemaprüfung angesehen und das XML
> gelesen — eine einmal registrierte DOI lässt sich nicht zurücknehmen.

## Voraussetzungen

- Ein aktueller Browser
- Python 3 (nur als lokaler statischer Webserver)
- Node.js ≥ 20 (für Tests)
- `xmllint` (libxml2) für die Schema-Validierung in der Entwicklung
  - Windows: `choco install xsltproc` (Administrator-Shell)
  - Debian/Ubuntu: `apt install libxml2-utils`
  - macOS: im System enthalten

## Start

**Windows:** Doppelklick auf **`start.bat`**. Das Skript sucht Python, nimmt den ersten freien Port
ab 8123, startet den Server und öffnet die Anwendung im Standardbrowser. Zum Beenden das Fenster
schließen oder Strg+C drücken. Eine Verknüpfung auf `start.bat` lässt sich auf den Desktop legen.

Ohne Skript, oder unter Linux und macOS:

```bash
python tools/serve.py
```

Das Tool nutzt ES-Module und muss über HTTP ausgeliefert werden, nicht über `file://`. Wer lieber
den nackten Server nimmt: `python -m http.server 8123` und dann <http://localhost:8123/> öffnen.
`tools/serve.py` setzt zusätzlich die MIME-Typen für `.js`, `.mjs` und `.wasm` fest, weil Windows sie
aus der Registry ableitet und dort gelegentlich falsche Werte stehen.

## Tests

Einmalig die Dev-Dependency installieren (nur für Tests, die App selbst braucht nichts):

```bash
npm install
```

Danach:

```bash
node --test "tests/**/*.test.js"
```

oder `npm test`.

## Schema-Validierung

Die DataCite-XSD (Version 4.7) liegt versioniert unter `schema/kernel-4.7/`, Quelle und Begründung stehen in `schema/README.md`.
Die Schema-Validierung der Fixtures läuft auch in `npm test` mit, sofern `xmllint` im PATH liegt, sonst wird sie übersprungen.

Das Feldinventar in `docs/mapping.md` wird aus den Fixtures erzeugt: `node tools/inventory.js --write`.

```bash
xmllint --nonet --noout --schema schema/kernel-4.7/metadata.xsd fixtures/*.xml
```

## Schemaprüfung im Browser

Der Knopf **„Gegen Schema prüfen“** validiert das erzeugte XML gegen die DataCite-XSD 4.7, direkt im Browser.
Fehler erscheinen mit Zeilennummer in der Prüfliste.

- Dafür liegt `xmllint-wasm` (MIT, rund 795 KB, davon 760 KB WebAssembly) unter `vendor/xmllint-wasm/`.
  Es wird **lokal ausgeliefert**, nicht von einem CDN, und erst beim ersten Klick geladen.
- Aktualisiert wird die Kopie mit `node tools/vendor.js`; ein Test schlägt fehl, wenn sie nicht zur installierten
  Version passt.
- Eine Prüfung dauert etwa 0,1 Sekunden. Ändert sich das XML danach, weist die Prüfliste darauf hin.
- **Die Prüfliste bleibt strenger als das Schema.** Ein leerer Titel mit Sprachattribut ist laut XSD gültig,
  die Pflichtfeldprüfung meldet ihn trotzdem.

## Datenmodell

Das interne Modell ist reines JSON (`src/model/model.js`), damit sich Speicherstände als Datei sichern lassen.
- Wiederholbare Elemente sind Arrays, ihre Reihenfolge bleibt erhalten.
- Attributnamen folgen dem DataCite-Schema, `xml:lang` heißt `lang`.
- `parse.js` (XML → Modell) meldet unbekannte Elemente und Attribute als Warnung.
- Unbekannte Top-Level-Elemente wie `relatedItems` bleiben unverändert in `extra` erhalten.
- `serialize.js` (Modell → XML) lässt leere Zeilen und leere optionale Wrapper weg. Zeilenumbrüche in Beschreibungen werden zu `<br/>`.
- `validate.js` prüft die Pflichtfelder.

## Bedienung

Der Kopfbereich ist in drei Zonen geteilt:

1. **Datensatz beginnen** – die drei gleichwertigen Einstiege nebeneinander, immer sichtbar:
   *Neu aus Profil* (Profil wählen, dann „Neu anlegen“), *Bestehende DOI laden* und *Datei öffnen*
   (XML oder Speicherstand). Beim Öffnen und Laden wird das Profil anhand der DOI erkannt.
   Direkt nach dem Laden einer DOI erscheint eine Anschlusszeile mit den üblichen nächsten Schritten,
   etwa „Nachfolger 6.0.0 anlegen“.
2. **Kopfdaten** – Platzhalter des Profils (z. B. Studienkürzel, Version, Vorversion) und die daraus
   gebildete DOI. Sie bleiben auch nach dem Laden sichtbar und änderbar.
3. **Dieser Datensatz** – alles, was einen vorhandenen Datensatz braucht: XML herunterladen,
   Speicherstand sichern, gegen das Schema prüfen, Nachfolger anlegen, Sprachfassungen.

Darunter folgt das Formular mit allen Feldern. Gesperrte Profilvorgaben sind grau; sie lassen sich über
„Entsperren“ bewusst ändern, die Abweichung erscheint dann als Hinweis in der Prüfliste.
Rechts stehen die Prüfliste (Pflichtfelder, Profilabweichungen, Schema- und Importmeldungen) und die XML-Vorschau.

Wiederholbare Gruppen haben Knöpfe zum Hinzufügen, Entfernen und Verschieben. Die Reihenfolge der Creators
ist zitationsrelevant und bleibt erhalten. Die Knöpfe stehen in der Titelzeile des Eintrags, sind 32 × 32 px
groß und überdecken kein Feld. **Vor dem Entfernen wird gefragt**, sobald der Eintrag etwas enthält, und die
Frage nennt ihn beim Inhalt: „Creator 1 „Brandt, Gesche“ wirklich entfernen?“. Gezeigt wird das erste
gefüllte Feld des Eintrags, lange Texte gekürzt. Eine leere Zeile verschwindet ohne Rückfrage. Das gilt auch für Größen, Formate und die optionalen Teilobjekte
wie Punkt oder Rechteck.

## Veröffentlichen: der Zweig `public`

Die Historie dieses Repositories enthält in vier alten Commits die Original-Referenzdaten mit echten Namen
und ORCID iDs. Deshalb wird **nicht `main` veröffentlicht**, sondern ein Zweig ohne jede Vorgeschichte:

- **`main`** ist der Arbeitszweig mit der vollständigen Historie und bleibt lokal beziehungsweise privat.
- **`public`** trägt denselben Dateibestand, aber keine gemeinsame Geschichte mit `main`. Der erste Commit ist
  ein Wurzel-Commit, jeder weitere hat nur seinen Vorgänger auf `public` als Elternteil.

```
node tools/public-branch.js install   # einmal pro Arbeitskopie: pre-push-Hook einrichten
node tools/public-branch.js sync      # public auf den aktuellen Stand von main bringen
node tools/public-branch.js status    # zeigt Zweig, Historie und ob der Schutz steht
git push origin public:main           # veröffentlicht; auf GitHub heißt der Zweig main
```

**Der Schutz ist ein `pre-push`-Hook** (`tools/hooks/pre-push`), der jeden Push prüft und in drei Fällen
abbricht:

1. Es soll ein anderer Zweig als `public` gepusht werden — auch bei `git push --all` oder `--mirror`, weil
   jede Ref einzeln geprüft wird.
2. Die Historie des Zweigs berührt `fixtures-private/`, `data/Creators.json` oder `data/people.json`.
3. Ein Commit enthält eine ORCID iD außerhalb des erfundenen Blocks `0000-0000-` (die fiktive
   Demonstrationsperson von ORCID ausgenommen). Geprüft wird je iD, nicht je Zeile.

Alle drei Fälle sind ausprobiert: `main` wird abgewiesen, `public` geht durch, ein untergeschobener alter
Commit mit echten Daten wird abgewiesen, und ein gemeinsamer Push von `public` und `main` ebenfalls.

### Zugang: Deploy Key statt Kontoschlüssel

Gepusht wird mit einem **Deploy Key**, einem SSH-Schlüsselpaar, das nur für dieses eine Repository gilt.
Das passt zum Schutz oben: Selbst wenn der Schlüssel abhandenkäme, reicht er nur an dieses Repository heran,
nicht an das GitHub-Konto.

- Der private Schlüssel liegt unter `~/.ssh/datacite_maker_deploy` und gehört **nie** ins Repository.
- Der öffentliche Teil wird auf GitHub unter *Settings → Deploy keys → Add deploy key* eingetragen,
  mit **Allow write access**.
- In `~/.ssh/config` steht dafür ein eigener `Host`-Alias mit `IdentitiesOnly yes`. Ohne ihn böte SSH den
  Vorgabeschlüssel für github.com an, der zu einem anderen Repository gehört und abgewiesen würde.
- Die Remote-Adresse nutzt den Alias statt `github.com`:

```
git remote add origin git@github-datacite-maker:<konto>/<repo>.git
```

Ein neues Schlüsselpaar erzeugt `ssh-keygen -t ed25519 -f ~/.ssh/<name> -C "deploy key <repo>"`. GitHub lässt
denselben Schlüssel nur für **ein** Repository zu; für ein weiteres braucht es ein neues Paar.

**Zwei Dinge, die man wissen muss:**

- **Hooks sind nicht Teil eines Klons.** In jeder neuen Arbeitskopie muss `node tools/public-branch.js install`
  einmal laufen, sonst fehlt der Schutz. `status` sagt, ob er steht.
- Nach dem Anlegen von `origin` `install` noch einmal ausführen: Dann setzt es zusätzlich
  `remote.origin.push`, sodass auch ein blankes `git push` nur `public` veröffentlicht.

Wenn auf `public` vor dem ersten Push etwas Falsches gelandet ist, hilft `git branch -D public` und ein
erneutes `sync` — solange nichts gepusht wurde, ist das folgenlos.

## Betrieb über GitHub Pages

Die Anwendung ist statisch (HTML, CSS, ES-Module, kein Build-Schritt) und läuft deshalb unverändert auf
GitHub Pages. Einrichtung: im Repo unter *Settings → Pages* als Quelle **Deploy from a branch** wählen,
Branch `main`, Ordner `/ (root)`. Eine Workflow-Datei ist dafür nicht nötig; jeder Push auf `main`
veröffentlicht den neuen Stand.

- Die leere Datei `.nojekyll` im Wurzelverzeichnis gehört dazu: sonst überspringt Jekyll Pfade mit
  Unterstrich (`fixtures/_crosscheck/`).
- Alle Dateien werden **relativ zur Seite** geladen, damit die Anwendung auch unter
  `https://<konto>.github.io/<repo>/` funktioniert. Geprüft ist das mit einem Server, der das
  übergeordnete Verzeichnis ausliefert: Profile, Personenliste, Schemaprüfung und die Landingpage
  arbeiten dort genauso.
- `vendor/xmllint-wasm` läuft in einem Worker, braucht aber **kein** `SharedArrayBuffer` und damit keine
  COOP/COEP-Header, die Pages nicht setzen könnte.
- ROR, ORCID und DataCite sind über HTTPS erreichbar und erlauben Zugriffe von fremden Herkünften
  (`docs/spike.md`); von einer HTTPS-Seite gibt es kein Mixed-Content-Problem.
- **Personenbezogene Daten sind nicht dabei.** Die Referenz-XMLs im Repository sind anonymisierte Kopien
  (siehe unten), und die lokale Personenliste ist ausgeschlossen. Credentials enthält das Werkzeug per
  Konstruktion keine, und registrieren kann damit niemand etwas — der Upload nach Fabrica bleibt beim Login.
- `start.bat` und `tools/serve.py` bleiben für den lokalen Betrieb; sie werden auf Pages nicht gebraucht.

## Personendaten: anonymisierte Fixtures und lokale Personenliste

Das Repository ist öffentlich, die Referenz-XMLs sind aber Kopien registrierter DataCite-Datensätze und
enthielten damit Namen und ORCID iDs realer Personen. Deshalb gilt:

- **`fixtures-private/`** enthält die unveränderten Originale und ist per `.gitignore` ausgeschlossen. Sie
  bleiben die Quelle für jede Frage nach Konventionen.
- **`fixtures/`** enthält anonymisierte Kopien, erzeugt mit `node tools/anonymize.js`. Ersetzt werden
  ausschließlich Namensbestandteile und ORCID iDs; alles andere bleibt Zeichen für Zeichen gleich.
  Die Tests laufen gegen diese Kopien.
- **Die Unterschiede bleiben erhalten.** Ersetzt wird pro Namensteil, nicht pro ganzem Namen: ein
  vertauschter Vor-/Nachname bleibt vertauscht, eine abweichende Schreibweise bleibt eine Abweichung, und
  derselbe Namensteil wird in allen Dateien zum selben erfundenen Teil. Genau davon leben die Tests zum
  Sprachvergleich.
- **Die erfundenen ORCID iDs** beginnen alle mit `0000-0000-` und haben eine gültige Prüfziffer. Diesen Block
  hat ORCID nie vergeben (die Vergabe beginnt erst im Block `0000-0001`), eine Kollision mit einer echten iD
  ist also ausgeschlossen. Ein Test prüft, dass in `fixtures/` keine anderen iDs auftauchen.
- **`data/Creators.json`** (die lokale Personenliste für die Vorschläge) ist ebenfalls ausgeschlossen. Wer sie
  nutzen will, legt sich lokal `fixtures-private/` an und erzeugt die Liste mit `node tools/people.js`;
  `node tools/people.js --verify` fragt zusätzlich bei DataCite nach, ob jede iD in einem auffindbaren
  Datensatz steht. Ohne die Datei funktioniert das Formular unverändert — dann gibt es nur die ORCID-Suche.
- Auch in Tests, Dokumentation und Spike stehen keine echten Namen mehr. Wo ein Beispiel nötig ist, dient
  „Josiah Carberry“, die fiktive Demonstrationsperson von ORCID.

## Landingpage

Die Landingpage gehört **nicht ins XML**: DataCite führt sie neben den Metadaten, in Fabrica ist es das Feld
„URL“. Deshalb steht sie in den Kopfdaten unter der DOI als eigenes Feld mit einem Knopf **„Kopieren“**.

- Für die Daten- und Methodenberichte schlägt das Profil die Adresse nach dem registrierten Muster vor:
  `https://metadata.fdz.dzhw.eu/public/files/data-packages/stu-{studie}$-{version}/attachments/{studie}_MethodReport_{de|en}.pdf`.
  Sie folgt den Platzhaltern, also auch der neuen Version.
- **Beim Laden einer DOI** steht dort die tatsächlich bei DataCite registrierte Adresse; weicht sie vom Muster
  ab (ältere Berichte tragen die Version im Dateinamen), nennt der Hinweis darunter beide.
- Das Feld ist frei überschreibbar und wandert in den Speicherstand.
- Für Fragebögen, Datensatzberichte und Working Paper ist noch kein Muster festgelegt (`docs/todo.md`); dort
  bleibt das Feld leer.

## Bestehende DOI laden und neue Version anlegen

- **DOI laden:** DOI eingeben und „Laden“ drücken (oder Enter). Geholt wird das bei DataCite **hinterlegte**
  XML (`data.attributes.xml` der REST-API), nicht die per Content Negotiation neu erzeugte Fassung
  (Begründung: `docs/mapping.md`, Abschnitt 2). Das Profil wird an der DOI erkannt. „Laden“ ersetzt den
  offenen Datensatz; **„Felder übernehmen“** öffnet stattdessen die Feldauswahl (siehe unten).
- **Gleich nach dem Laden fragt das Tool**, wie weitergearbeitet wird: **„Als Vorlage für eine neue Version“**
  (mit Auswahl Major, Minor oder Patch und der konkreten Zielversion) oder **„Unverändert laden“**. Escape
  bedeutet „unverändert“. Passt der Typ nicht zum Profil, wiederholt der Dialog die Warnung. Hat der Datensatz
  keine Versionsnummer im Format x.y.z, erscheint die Frage nicht.
- **Hinweis beim Profilwechsel:** Das Profil wird an der DOI erkannt. Gehört die geladene DOI zu einem
  anderen Dokumenttyp als dem ausgewählten, erscheint ein blauer Hinweis mit beiden Profilnamen — etwa wenn
  „Fragebogen / Instrument“ eingestellt war und ein Daten- und Methodenbericht geladen wird. Ein eigener
  Profilwechsel blendet den Hinweis wieder aus.
- **Warnung bei falschem Typ:** Passt der `resourceTypeGeneral` des geladenen Datensatzes nicht zu dem
  Dokumenttyp, den das erkannte Profil erzeugt, erscheint über dem Formular ein roter Warnkasten mit beiden
  Typen — etwa wenn eine Datenpaket-DOI geladen wird, das Profil aber einen Bericht baut. Die Warnung
  verschwindet von selbst, sobald der Typ passt, und lässt sich ausblenden. Dieselbe Warnung erscheint, wenn
  die **Quelle einer Feldübernahme** einen anderen Typ hat. In der Prüfliste steht die Abweichung zusätzlich
  als Zeile.
- **Neue Version anlegen:** im Dialog nach dem Laden, über die Zeile „Geladen: …“ oder jederzeit unter
  „Dieser Datensatz“: Versionsteil wählen (Major, Minor, Patch) und den Knopf drücken. Das Tool
  - zählt die Version hoch und passt die DOI an,
  - trägt die bisherige Version als `IsNewVersionOf` ein,
  - aktualisiert die Datenpaket-Relation (`IsPartOf`) und die Übersetzung auf die neue Version,
  - übernimmt gesperrte Profilfelder in der aktuellen Konvention,
  - behält alle Inhalte samt Reihenfolge der Creators und selbst ergänzte Verknüpfungen,
  - markiert jedes gefüllte Feld zur Abnahme (siehe „Freigabe übernommener Felder“): Was aus der Vorversion in
    die neue Registrierung wandert, wird einmal bestätigt.
- **Altlasten werden bereinigt:** Eine aus dem alten Datensatz übernommene `IsSupplementTo`-Verknüpfung auf
  dasselbe Datenpaket wird entfernt, weil das Profil es als `IsPartOf` verknüpft. In den übrigen übernommenen
  Verknüpfungen wird die alte Versionsnummer durch die neue ersetzt, etwa in der Anhang-URL
  `…/stu-nac2018$-3.0.0/…` → `…-4.0.0/…`. Beides steht als Hinweis in der Prüfliste.

## Sprachfassungen (DE/EN)

Drei Knöpfe, sobald ein Profil mit zweiter Sprachfassung aktiv ist (`dmr-de`, `dmr-en`, `dsreport`):

- **Andere Sprachfassung erzeugen:** baut aus dem offenen Datensatz das Gegenstück. DOI, `language`,
  Titelsprache und die Relationen wechseln, `IsTranslationOf` zeigt zurück auf die Vorlage. Sprachneutrale
  Inhalte bleiben erhalten, Titel und Beschreibungen werden als Übersetzungsvorlage übernommen und in der
  Prüfliste als „noch nicht übersetzt“ geführt, bis der Text geändert wird. Jahr und Version bleiben gekoppelt.
- **Felder aus Gegenstück übernehmen:** lädt die DOI der anderen Sprachfassung und öffnet die Feldauswahl
  (siehe unten). Vorausgewählt sind dort nur die sprachneutralen Felder; Titel, Beschreibungen und
  sprachgebundene Schlagwörter lassen sich bei Bedarf zuwählen.
- **Sprachfassungen vergleichen:** meldet Unterschiede in sprachneutralen Feldern als Hinweise. Genau diese
  Fehlerklasse steckt im Bestand: vertauschter Name, fehlende Affiliation, abweichende Schreibweise, fehlende ORCID.

**Sprachneutral** sind Creators, Contributors, Publisher, Erscheinungsjahr, Zeitangaben, Ressourcentyp, Version,
Rechte, Orte, Förderung, Größen, Formate und alternative Identifier. **Sprachgebunden** sind Titel, Beschreibungen,
`language`, DOI, die Relationen zum Gegenstück sowie Schlagwörter mit `xml:lang` der Ausgangssprache.

## Felder aus einem anderen Datensatz übernehmen

Drei Knöpfe holen Inhalte aus einem anderen Datensatz:

- **Felder übernehmen** (bei „Bestehende DOI laden“): lädt die eingegebene DOI, ohne den offenen Datensatz zu
  ersetzen. Damit lässt sich jede registrierte DOI als Quelle nutzen, auch ohne Vorversion oder Gegenstück.
- **Felder aus Vorversion übernehmen** (unter „Dieser Datensatz“): lädt die Vorgängerfassung. Die DOI wird aus
  der eingetragenen Vorversion gebildet, sonst aus der naheliegenden (6.0.0 → 5.0.0).
- **Felder aus Gegenstück übernehmen** (unter „Dieser Datensatz“): lädt die andere Sprachfassung.

Danach erscheint eine **Feldauswahl mit Haken**. Sie listet nur Felder, die im geladenen Datensatz etwas
enthalten, jeweils mit Umfang, etwa „Creators (15 Einträge)“. Vorausgewählt sind

- bei **DOI und Vorversion** alle Inhalte,
- beim **Gegenstück** nur die sprachneutralen.

Nicht übernommen werden DOI, Version, Sprache und die Profilrelationen: Sie identifizieren den Datensatz
oder kommen aus dem Profil. Nach dem Übernehmen nennt die Statuszeile jede Änderung mit Vorher und Nachher.

### Freigabe übernommener Felder

Die Freigabe greift an zwei Stellen: bei den Feldübernahmen oben und beim **Anlegen einer neuen Version**, wo
alle Inhalte der Vorversion mitkommen.

Jedes Feld, das dabei tatsächlich einen Wert bekommen hat, wird **rot umrandet** und bekommt über seinen
Eingaben eine **Freigabezeile**: „Übernahme freigeben“ mit einem Haken, dazu die Quell-DOI. Nach der Bestätigung
wird der Rahmen **grün** und die Zeile zeigt einen **grünen Haken ✓**. So ist auf einen Blick zu sehen, was aus
einem fremden Datensatz stammt und noch niemand geprüft hat.

- **Creators werden einzeln abgenommen.** Die Reihenfolge ist zitationsrelevant und jeder Name muss stimmen,
  deshalb hat dort jeder Eintrag einen eigenen Haken und einen eigenen Rahmen. Die Zeile über der Liste zählt mit
  („3 von 10 Einträgen noch nicht abgenommen“) und bietet „Alle Einträge abnehmen“ an.
- **Die Abnahme hängt am Inhalt, nicht an der Position.** Werden Einträge verschoben, wandert der Haken mit.
- **Wer ein Feld bearbeitet, hat es damit geprüft.** Ein geändertes Feld wird grün und die Zeile lautet „hier
  bearbeitet, die Übernahme aus … ist damit erledigt“. Ein geänderter oder neu angelegter Eintrag ist eigener
  Inhalt und verliert Rahmen und Haken. Das gilt auch beim Tippen, ohne dass das Formular neu aufgebaut wird.
- Solange eine Freigabe fehlt, steht sie als Hinweis in der Prüfliste. Sie blockiert den XML-Download nicht;
  die Entscheidung bleibt bei der bearbeitenden Person.
- Unveränderte Felder bekommen keine Freigabezeile: Wo die Übernahme nichts geändert hat, gibt es nichts zu prüfen.
  Bei den Schlagwörtern aus dem Datenpaket sind es nur die tatsächlich ergänzten Einträge.
- Wird dasselbe Feld erneut übernommen, ist die Freigabe wieder offen.
- **Der Speicherstand hält den Prüfstand fest.** „Speicherstand sichern“ schreibt ihn als Feld `taken` mit in die
  JSON-Datei, „Speicherstand laden“ holt ihn zurück: freigegebene Felder bleiben freigegeben, offene bleiben offen.
  Die Formatversion bleibt 1, ältere Dateien ohne das Feld lassen sich weiter laden und haben dann nichts freigegeben.
- Einen anderen Datensatz zu beginnen setzt den Prüfstand zurück: neu anlegen, eine DOI laden oder ein XML öffnen.

## Schlagwörter aus dem Datenpaket

Ist ein Datenpaket verknüpft, steht im Abschnitt Schlagwörter der Knopf **„Schlagwörter aus Datenpaket
übernehmen“**; daneben steht die DOI des Datenpakets. Er lädt das Datenpaket von DataCite und öffnet dieselbe
Auswahl mit Haken, ein Eintrag je Schlagwort mit Sprache.

- **Die Version lässt sich wählen.** Datenpakete werden später registriert als die Berichte, die zu ihnen
  gehören — die verknüpfte Version ist oft noch gar nicht veröffentlicht. Das Werkzeug fragt deshalb erst alle
  registrierten Versionen ab und nimmt die verknüpfte, falls es sie gibt, sonst **die neueste darunter**; der
  Hinweis nennt beide („Version 7.0.0 ist nicht registriert, gezeigt wird 6.0.0“). Im Dialog steht eine Auswahl
  „Datenpaketversion“, ein Wechsel lädt die Schlagwörter dieser Version.
- **Freie Schlagwörter und Thesaurusbegriffe stehen getrennt.** Die Liste ist nach Schema gruppiert, etwa
  „Freie Schlagwörter (37)“ und „ELSST (CESSDA-Thesaurus) (26)“, jede Gruppe mit eigenem „Alle“ und „Keine“.
  So lassen sich mit zwei Klicks nur die Thesaurusbegriffe oder nur die freien Schlagwörter übernehmen.
  ELSST-Begriffe kommen mit `subjectScheme`, `schemeURI` und `valueURI` mit.
- Vorausgewählt sind die noch fehlenden Schlagwörter **in der Sprache des Datensatzes**, quer über beide
  Gruppen. Datenpakete führen ihre Schlagwörter in beiden Sprachen; die andere Sprache lässt sich zuwählen.
- Bereits vorhandene Einträge sind als „bereits vorhanden“ markiert und bleiben unangehakt.
- Übernommene Schlagwörter werden **ergänzt, nicht ersetzt**. Gleich sind zwei Schlagwörter bei gleichem Begriff,
  Thesaurus, `valueURI` und `xml:lang` (Groß-/Kleinschreibung egal); Doppelte werden übersprungen.

Als Datenpaket gilt die Verknüpfung `IsPartOf` (aus Altbeständen auch `IsSupplementTo`) auf eine DOI mit
`resourceTypeGeneral="Dataset"`, siehe `docs/mapping.md`, Abschnitt 6. Auch hier ist die Übernahme
freizugeben (siehe oben).

## Nachschlagen: ROR, ORCID, Personenliste

- **Namensfeld von Creators und Contributors:** Vorschläge ab 3 Zeichen. Zuerst wird die lokale Liste
  `data/Creators.json` durchsucht (Kennzeichnung „lokal“), danach die ORCID Public API. Ein Treffer füllt Name,
  Vor- und Nachname, ORCID und, bei lokalen Einträgen, die Affiliation mit ROR-ID.
- **Affiliationsfeld:** Suche in der ROR API v2. Übernommen werden der ROR-Anzeigename und die ROR-ID.
- **ID-Feld:** Eine eingegebene ORCID iD wird sofort lokal über die Prüfziffer geprüft (ISO 7064 MOD 11-2).
  Der Knopf „iD prüfen“ fragt zusätzlich ORCID ab und zeigt den hinterlegten Namen.
- Gesucht wird mit 300 ms Verzögerung, Ergebnisse werden im Speicher zwischengehalten, veraltete Anfragen
  werden abgebrochen. **Fällt eine API aus, erscheint nur ein Hinweis am Feld; das Formular bleibt nutzbar.**
- Die Personenliste wird aus den Fixtures erzeugt: `node tools/people.js`. Sie enthält nur Personen mit ORCID
  und vereinheitlicht die Schreibweisen (siehe `docs/mapping.md`, Abschnitt 6).

## Profile

Profile (`profiles/*.json`) legen fest, wie ein neuer Datensatz eines Dokumenttyps vorbelegt wird:

| Profil | Dokumenttyp | DOI-Muster (nach `10.21249/`) |
|---|---|---|
| `dmr-de`, `dmr-en` | Daten- und Methodenbericht | `DZHW:{studie}-dmr-de:{version}` bzw. `-dmr-en` |
| `instrument` | Fragebogen | `DZHW:{studie}-ins{ins}-att{att}:{version}` |
| `dsreport` | Codebook-/Variablenreport | `DZHW:{studie}-ds{ds}_DsReport_{lang}:{version}` |
| `paper` | Working/Data Paper | frei; mit Reihe (`series.json`) z. B. `es:wps:{nr}{jahr}:{version}` |
| `generic` | Generisches Dokument | `DZHW:{suffix}` |

Jedes Profil enthält Vorbelegungen, gesperrte und empfohlene Felder, die erlaubten `resourceTypeGeneral`-Werte und Vorlagen für Verknüpfungen (`IsPartOf` → Datenpaket, `IsNewVersionOf`, `IsTranslationOf`).
Gemeinsame Werte (Publisher mit ROR, Platzhalter-Definitionen) stehen in `base.json`.
Die Logik (anwenden, DOI erzeugen und zerlegen, Abweichungen prüfen) liegt in `src/model/profile.js`.
Die inhaltlichen Entscheidungen dahinter stehen in `docs/mapping.md`, Abschnitt 6.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `index.html` | Einstiegsseite |
| `src/model/` | Internes Datenmodell, Defaults, Pflichtfeldprüfung |
| `src/xml/` | `serialize.js` (Modell → XML), `parse.js` (XML → Modell) |
| `src/ui/` | Formular, wiederholbare Gruppen, Vorschau |
| `src/api/` | ROR, ORCID, DataCite (nur lesend) |
| `profiles/` | Profile mit Vorbelegungen |
| `data/Creators.json` | Lokale Personenliste, nicht im Repository (siehe „Personendaten“) |
| `schema/` | DataCite-XSD inkl. includes |
| `fixtures/` | Referenz-XMLs |
| `tests/` | Tests (`node --test`) |
| `tools/` | Entwicklungs-Skripte |
| `vendor/` | Lokale Kopie von xmllint-wasm (MIT), erzeugt mit `node tools/vendor.js` |
| `docs/` | `mapping.md`, `spike.md` |
| `spike/` | CORS-Testseite für ROR/ORCID (Phase 2), aufrufbar unter <http://localhost:8123/spike/> |

Speicherstände werden als JSON-Dateien exportiert und importiert. Nutzdaten landen nicht im `localStorage`.

## Lizenz

[MIT](LICENSE), Copyright © 2026 Andreas Daniel.
Die Lizenz enthält den üblichen Gewährleistungs- und Haftungsausschluss („AS IS, WITHOUT WARRANTY OF ANY
KIND“).

**Drittsoftware:** `vendor/xmllint-wasm` steht ebenfalls unter MIT (Copyright der libxml- und
libxml.js-Autor:innen); der Lizenztext liegt unter `vendor/xmllint-wasm/COPYING` und bleibt dort. Die
Referenz-XMLs unter `fixtures/` sind anonymisierte Kopien registrierter DataCite-Datensätze (siehe
„Personendaten“); die Metadaten selbst stehen unter den Bedingungen der jeweiligen Registrierung.
