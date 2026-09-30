# Spike: ROR und ORCID direkt aus dem Browser (Phase 2)

Stand: 2026-09-21. Testseite: `spike/index.html` + `spike/spike.js`, ausgeliefert über
`python -m http.server 8000`, geöffnet als `http://localhost:8000/spike/`, Button „Alle Tests ausführen“.
Jede Anfrage läuft 3×. (Der Standardport des Projekts ist inzwischen 8080; die Messung lief auf 8000.) Die Zeiten sind Browser-`fetch`-Zeiten inkl. JSON-Parsing, gemessen von einem
Heimnetz aus. Ergänzend wurden die Header per curl mit `Origin: http://localhost:8000` geprüft.

## Ergebnis in Kürze

| | ROR API v2 | ORCID Public API v3.0 |
|---|---|---|
| CORS aus `http://localhost:8000` | **ja**, `Access-Control-Allow-Origin: *` | **ja**, `access-control-allow-origin: *` |
| CORS auch bei Fehlern (4xx/5xx) | ja (400, 404 lesbar) | ja (404, 500 lesbar) |
| Preflight | nicht nötig (einfacher GET); erlaubt `Client-Id` als Header | nicht nötig (`Accept` ist safelisted) |
| Authentifizierung | keine; Client-ID optional (siehe unten) | keine (anonyme Public API) |
| Antwortzeit (warm) | ≈ 50–60 ms | ≈ 150–220 ms |
| Antwortzeit (erster Aufruf) | ≈ 75–300 ms | ≈ 150–500 ms |
| Rate-Limit-Header im Browser lesbar | nein | nein |

**Machbarkeit:** Beide APIs lassen sich ohne Proxy direkt aus dem Browser nutzen. Die Latenz reicht für
Type-ahead mit ~300 ms Debounce.

## ROR API v2

**Endpunkt:** `GET https://api.ror.org/v2/organizations?query=<q>`

### Antwortformat

```json
{ "number_of_results": 1, "time_taken": 3, "items": [ {
    "id": "https://ror.org/01n8j6z65",
    "names": [
      { "value": "DZHW", "types": ["acronym"], "lang": null },
      { "value": "Deutsches Zentrum für Hochschul- und Wissenschaftsforschung", "types": ["label"], "lang": "de" },
      { "value": "German Centre for Higher Education Research and Science Studies", "types": ["ror_display", "label"], "lang": "en" } ],
    "types": ["government"], "status": "active",
    "locations": [ { "geonames_details": { "name": "Hanover", "country_code": "DE", … } } ],
    "admin": …, "domains": …, "established": …, "external_ids": …, "links": …, "relationships": … } ],
  "meta": … }
```

- Der Anzeigename steht in `names[]` mit `types` ∋ `ror_display`. Das ist genau der Wert, den die Fixtures als
  `affiliation`/`publisher` verwenden („German Centre for Higher Education Research and Science Studies“).
- Die Seitengröße ist fest **20**, blättern geht mit `page=`.

### Suchverhalten (wichtig für Type-ahead)

| Anfrage | Treffer | Erster Treffer |
|---|---|---|
| `query=DZHW` | 1 | German Centre for Higher Education Research… |
| `query=Hochschulforschung` | 3 | Gesellschaft für Hochschulforschung |
| `query=German Center for Integration` | 14 671 | German Center for Integration and Migration Research |
| `query=Leibniz Hannover` | 111 | Leibniz University Hannover |
| `query=Hochschulf` (Wortanfang) | **0** | – |
| `query=Deutsches Zentrum für Hochsch` | 2026 | Deutsches Zentrum für Musiktherapieforschung |
| `query.advanced=Deutsches AND Zentrum AND Hochsch*` | 1 | German Centre for Higher Education Research… |
| `query.advanced=names.value:DZH*` | 4 | German Centre for Higher Education Research… |
| `affiliation=DZHW Hannover` | 7 | FHDW Hannover (DZHW nicht unter den ersten 3) |

- `query` matcht nur **ganze Wörter** (ODER-verknüpft, nach Relevanz sortiert). Ein halb getipptes letztes Wort
  findet nichts oder Falsches.
- `query.advanced` (Elasticsearch-Query-String) unterstützt `AND` und Präfix-`*`. Damit funktioniert Type-ahead,
  aber die Eingabe muss **escaped** werden (Lucene-Sonderzeichen wie `( ) : " / - +`).
- `affiliation=` ist für die Zuordnung von Freitext-Affiliationen gedacht (Score, `chosen`), nicht für Type-ahead.
  Im Test war es unzuverlässig.
- Mit `filter=status:active` lassen sich inaktive oder zurückgezogene Organisationen ausschließen.

### Rate Limits und Client-ID

Laut ROR-Doku (<https://ror.readme.io/docs/client-id>, abgerufen 2026-09-21):

- Ohne Client-ID: 50 Anfragen / 5 min. Mit Client-ID: 2000 Anfragen / 5 min (je IP).
- Die Client-ID ist kostenlos (nur E-Mail) und wird als Header `Client-Id` gesendet. Der CORS-Preflight
  erlaubt diesen Header.
- **Derzeit**: Die Registrierung ist „temporarily paused“, es werden **keine** Rate Limits erzwungen, und vor der
  Wiederaufnahme soll es ausreichend Vorlauf geben.
- Rate-Limit-Header (`X-RateLimit-*` o. ä.) waren weder per curl noch im Browser zu sehen.

Folgerung: 50 Anfragen / 5 min wären bei Type-ahead (Debounce 300 ms, Mindestlänge 3, Cache) für einzelne
Nutzer:innen knapp, aber selten erreicht. Eine Client-ID als optionale Einstellung vorzusehen, wäre günstig.
Sie ist kein Geheimnis im engeren Sinn (sie steckt ohnehin in jedem Request aus dem Browser), sollte aber
trotzdem nicht ins Repo.

## ORCID Public API v3.0

**Endpunkt:** `GET https://pub.orcid.org/v3.0/expanded-search/?q=<solr-query>&rows=<n>` mit `Accept: application/json`

Strukturierte Suche: `q=family-name:Carberry AND given-names:Josiah`. Werte mit Leerzeichen kommen in
Anführungszeichen (`family-name:"de Vries"`).

### Antwortformat

```json
{ "expanded-result": [ {
    "orcid-id": "0000-0002-1825-0097",
    "given-names": "Josiah", "family-names": "Carberry",
    "credit-name": null, "other-name": [], "email": [],
    "institution-name": [ "CSHL" ] } ],
  "num-found": 2 }
```

- `institution-name` eignet sich gut zur Unterscheidung bei häufigen Namen, ist aber oft leer.
- Die iD kommt **ohne** URL-Präfix.
- `rows` ist 0–1000 (5000 ergibt 400).

### Suchverhalten

Die ursprünglich gemessenen Beispiele waren Namen von Kolleg:innen. Sie wurden durch neutrale ersetzt
und am 2026-09-30 neu gemessen; Treffer-iDs stehen hier bewusst nicht. „Josiah Carberry“ ist die
fiktive Demonstrationsperson von ORCID.

| Anfrage | Treffer |
|---|---|
| `Carberry` / `Josiah` | 2 |
| `Müller` / `Anna` (Umlaut) | 44 |
| `"de Vries"` / `Anna` (Leerzeichen) | 6 |
| `Smith` / `John` (häufiger Name) | 281 |
| `Müller` (nur Familienname) | 5384 |
| `Carb*` / `Josiah` (Präfix) | 2 |
| `family-name:(` (Syntaxfehler) | **HTTP 500** |

- Umlaute funktionieren, Präfix-`*` auch.
- **Nicht escapte Solr-Sonderzeichen führen zu HTTP 500** (mit Solr-Stacktrace im Body). Die Eingabe muss
  escaped werden.
- Direkter iD-Abruf: `GET /v3.0/<iD>/person` liefert CORS-fähig `name.given-names.value` / `name.family-name.value`,
  eine unbekannte iD gibt 404. Damit lässt sich eine direkt eingegebene iD nach der lokalen
  Prüfziffernvalidierung gegenprüfen.

### Rate Limits und Nutzungsbedingungen

Laut ORCID-FAQ (<https://info.orcid.org/ufaqs/what-are-the-api-limits/>, abgerufen 2026-09-21):

- Anonym: 12 Anfragen/s, Burst 40, **25 000 Reads/Tag je IP**. Darüber gibt es 503 bzw. eine Sperre bis zum
  Ende des Zeitfensters.
- Mit registrierter Public-API-Client-ID (OAuth-Token): 100 000/Tag. Das bräuchte ein Token, also Credentials,
  und entfällt für dieses Tool.
- Die Public API ist frei für nicht-kommerzielle Nutzung. Die Nutzung in einem internen, nicht-kommerziellen
  Werkzeug eines Forschungsdatenzentrums sollte das abdecken. **Bitte bestätigen** (siehe offene Punkte).
- Rate-Limit-Header waren nicht sichtbar.

## Konsequenzen für Phase 6 (Vorschlag, Entscheidung liegt bei dir)

1. **Direktzugriff aus dem Browser** für ROR und ORCID. Kein Proxy, keine Credentials.
2. **ROR:** Type-ahead über `query.advanced`, mit escapter Eingabe. Jedes Wort wird per `AND` verknüpft,
   das letzte bekommt ein `*`, dazu `filter=status:active`. Angezeigt werden `ror_display` und
   `names[lang=de]` / Akronym plus Ort. Übernommen werden `id` und der `ror_display`-Name.
   Optional kommt eine konfigurierbare `Client-Id` dazu.
3. **ORCID:** strukturierte Suche Familienname + Vorname, Solr-escaped, optional Präfix-`*` am Vornamen, `rows=10`.
   Angezeigt werden Name + erste 1–2 Institutionen. Eine direkte iD-Eingabe wird lokal mit Prüfziffer
   (ISO 7064 Mod 11-2) validiert und danach optional per `/person` gegengeprüft.
4. **Fehler:** 4xx/5xx sind lesbar und werden als dezente Meldung angezeigt. Netzwerkfehler und Abbrüche
   (AbortController) blockieren das Formular nicht.
5. **Lokale Personenliste** zuerst durchsuchen. Das spart ORCID-Anfragen bei den wiederkehrenden Personen.

## Offene Punkte für deine Entscheidung

1. Soll Phase 6 wie oben beschrieben mit Direktzugriff aus dem Browser umgesetzt werden?
2. ROR: Soll eine optionale Client-ID-Einstellung vorgesehen werden? Falls ja, wo wird sie gespeichert?
   `localStorage` wäre hier eine Einstellung und keine Nutzdaten. Alternativ eine nicht versionierte
   lokale Konfigurationsdatei.
3. ORCID: Sind die Nutzungsbedingungen der Public API (nicht-kommerziell) für den FDZ-Einsatz aus deiner Sicht erfüllt?
4. Soll die Testseite `spike/` im Repo bleiben (Dokumentation) oder nach der Entscheidung entfernt werden?
