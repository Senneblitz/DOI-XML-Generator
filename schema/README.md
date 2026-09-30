# DataCite-Schema

| | |
|---|---|
| Version | **DataCite Metadata Schema 4.7** (Revision 2026-03-03) |
| Namespace | `http://datacite.org/schema/kernel-4` |
| Quelle | <https://schema.datacite.org/meta/kernel-4.7/> (`metadata.xsd` + `include/*.xsd`) |
| Abgerufen | 2026-09-21 |

## Warum 4.7

- Alle Fixtures deklarieren `xsi:schemaLocation="http://datacite.org/schema/kernel-4 http://schema.datacite.org/meta/kernel-4/metadata.xsd"`,
  also das **unversionierte** `kernel-4`. Diese URL liefert zum Abrufzeitpunkt byteidentisch dieselbe
  `metadata.xsd` wie `kernel-4.7`.
- Die Fixtures brauchen **mindestens 4.6**: `relationType="IsTranslationOf"` (DMR) wurde mit 4.6 eingeführt,
  `resourceTypeGeneral="Instrument"` und `publisherIdentifier` mit 4.5.
- Abgelegt ist die versionierte Kopie, damit die Validierung reproduzierbar bleibt, wenn DataCite
  `kernel-4` weiterentwickelt.

## Inhalt

```
kernel-4.7/
  metadata.xsd
  include/xml.xsd
  include/datacite-*-v4.xsd   (10 Dateien mit kontrollierten Vokabularen)
```

`include/xml.xsd` enthält Verweise auf `http://www.w3.org/...`, die nur in Dokumentationsbeispielen stehen.
Die Validierung läuft deshalb offline (`--nonet`).

## Validierung

```bash
xmllint --nonet --noout --schema schema/kernel-4.7/metadata.xsd fixtures/*.xml
```
