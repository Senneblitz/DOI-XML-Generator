# data/

Hier liegt die lokale Personenliste `Creators.json`, die das Namensfeld mit Vorschlägen füllt.

**Sie ist bewusst nicht Teil dieses Repositories.** Erzeugt wird sie aus den Original-Referenzdaten, und die
enthalten Namen und ORCID iDs realer Personen; das Repository ist öffentlich. Siehe README, Abschnitt
„Personendaten“.

Wer die Vorschläge nutzen möchte, legt lokal `fixtures-private/` mit den Originalen an und erzeugt die Liste:

```
node tools/people.js
node tools/people.js --verify   # fragt bei DataCite nach, ob jede iD öffentlich auffindbar ist
```

Ohne die Datei funktioniert das Formular unverändert; es gibt dann nur die Suche über die ORCID Public API.
Der 404 in der Browser-Konsole beim Start ist in diesem Fall erwartet.
