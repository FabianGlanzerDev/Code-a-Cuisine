# Code à Cuisine

Angular-Anwendung für drei Rezeptvorschläge aus vorhandenen Zutaten, mit n8n-Generierung und Firebase-Cookbook.

## Lokal starten

Node.js passend zu Angular 20 verwenden (20.19+, 22.12+ oder 24+) und Abhängigkeiten installieren:

```sh
npm ci
npm start
```

Unter Windows bei gesperrtem PowerShell-Skript `npm.cmd` verwenden. Lokal: `http://localhost:4200/#/`.
Die Umgebungsdateien verweisen auf entfernte Backends. Eine echte Generierung kann Kosten verursachen; automatisierte Tests verwenden simulierte Antworten oder lokale Original-Fixtures.

## Build und Tests

```sh
npm run build
npm test -- --watch=false --browsers=ChromeHeadless
npm run test:backend
npm run n8n:check
npm run check:style
```

Angular-Tests benötigen Chrome. Firebase-Emulatortests sind in [firebase/README.md](firebase/README.md) beschrieben.

## Verhalten

- Zutaten und Präferenzen werden lokal gespeichert und nach Neuladen wiederhergestellt. Defaults: Quick, German, No preferences; zwei Portionen, ein Koch.
- Generierung benötigt gültige Zutaten und jeweils drei bestätigte freie Plätze für IP und System. Unbekannte oder fehlgeschlagene Quotenabfragen sperren den Button mit Erklärung und erneuter Abfragemöglichkeit.
- Grenzen: 1–12 Portionen, 1–3 Köche, drei Rezepte pro IP und zwölf systemweit pro UTC-Tag. Reservierungen bleiben auch bei Modellfehlern verbraucht; keine automatische Modellwiederholung.
- Das Eingabe-Popup erklärt belegte Eingabefehler. Eine fachliche Mindestmenge je Portion ist nicht definiert und wird nicht erfunden. Technische Fehler und Quotenlimits öffnen es nicht.
- Drei Rezepte sind Alternativen. Makro-Prozentwerte werden aus validierten Grammwerten berechnet; das bestätigt keine sachliche Genauigkeit der Modellschätzung.

## Veröffentlichung

Frontend: **Inhalt von `dist/code-a-cuisine/browser/` nach `/code-a-cuisine/`** hochladen, nicht den umgebenden Ordner. Vorher Serverstand sichern. Neue Bundles und benötigte Assets zuerst, `index.html` zuletzt übertragen. Die aktuelle `index.html` bestimmt die Bundle-Namen. Vorhandene fremde Serverregeln nicht löschen.

Angular verwendet Hash-Routing mit erhaltenem Basispfad. Kein SPA-Fallback erforderlich. Alte Links ohne `#` werden dadurch nicht repariert.

- Start: https://fabian-glanzer.developerakademie.net/code-a-cuisine/#/
- Eingabe: https://fabian-glanzer.developerakademie.net/code-a-cuisine/#/generate-recipe
- Kategorie: https://fabian-glanzer.developerakademie.net/code-a-cuisine/#/recipes-list?cuisine=german&page=3

Nach Upload `node scripts/check-deployment.cjs` für Einstiegdokument und Assets ausführen. Zusätzlich Hash-Unterseiten im Browser direkt öffnen und mit F5 neu laden, Details sowie Kategorie/Pagination/Zurück/Vorwärts prüfen. HTTP überträgt das Fragment nicht und kann diese Routerprüfung nicht ersetzen.

Die drei konfigurierten n8n-Importdateien und Übernahmeschritte stehen in [n8n/README.md](n8n/README.md). Ein FTP-Upload veröffentlicht keine Workflows; ein Workflowimport veröffentlicht kein Frontend.

## Stand der lokalen Mentorprüfung

144 Angular-Tests, 59 Backendtests einschließlich Originalfällen #114/#136, Workflow-Konsistenz und Stilprüfung bestanden. Produktionsbuild erfolgreich mit sechs CSS-Budgetwarnungen. Browserprüfung: 135 Seiten-/Viewportfälle ohne Dokumentüberlauf; zusätzliche Button-, Navigations- und Home-Prüfungen bei 320/375/390/768/1440 px, 1024×600, 2560×1440, 3440×1440 und 3840×2160. Direkte Hash-Routen und F5 auf statischem Server ohne SPA-Fallback geprüft. Backendantworten wurden simuliert, vorhandene Originalrezepte als Fixtures verwendet; keine kostenpflichtige Generierung oder Produktionsschreibzugriffe.

Logo-Position erhalten; mobile Listen abwechselnd hinterlegt, Cookbook-Button zentriert und Zurückpfeile ausgerichtet. Zusätzliche Teller nur ab 2560 px und mindestens 2:1.

Offen bleiben der veröffentlichte Stand nach Betreiber-Upload, ein bestätigter aktueller Live-Durchlauf einschließlich Speicherung, nicht belegte Figma-Schriftwerte und die fachliche Portionsregel. Lokale Tests sind keine pauschale Abgabefreigabe. Build, temporäre Prüfberichte und Screenshots sind nicht versioniert; Lizenzen und Regressionstests bleiben erhalten.
