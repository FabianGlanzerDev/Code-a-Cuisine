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

## Stand der erneuten Mentorpruefung

150 Angular-Tests, 61 Backendtests einschliesslich Originalfaellen #114/#136, Workflow-Konsistenz und Stilpruefung bestanden. Produktionsbuild erfolgreich mit sieben CSS-Budgetwarnungen. 135 Seiten-/Viewportfaelle ohne horizontalen Dokumentueberlauf. Zusaetzlich geprueft: Tablet-Home bei 744/768 px samt angrenzenden Groessen, Querformat und F5; bisherige Widescreen-Ansichten; Hover und Fokus jeder der sechs Kategorien, Ruecklauf, Touch und reduzierte Bewegung; mobile Originalbanner, lange Schritttexte und unabhaengige Toggles. Hash-Routen/F5/Kategorie/Pagination/Zurueck auf statischem Server ohne SPA-Fallback bestanden. Lokale Fonts im Browser nachgewiesen.

Button: Zutaten, Einstellungen, laufende Anfrage, ausstehende Speicherung, laufende/fehlgeschlagene Quotenabfrage und IP-/Systemlimit haben konkrete Sperrgruende. Nur gueltige Eingaben mit mindestens drei freien IP- UND Systemplaetzen zeigen Ready. Leere HTTP-200-Quotenantworten und fehlerhafte Quoten-Metadaten in technischen Fehlerantworten werden nun korrekt behandelt. Browserpruefung umfasst Timeout, Wiederherstellung, verspaetete Antworten und genau einen simulierten Generierungsversuch ohne automatische Wiederholung. Der Platz fuer die lesende Quoten-Neuabfrage bleibt reserviert.

Live-Pruefung am 14. September 2026: main-ZOYSY7DF.js nutzt die richtigen Produktions-Webhooks. Die echte lesende Quotenabfrage meldete fuer die Testverbindung 0 freie IP- und 3 freie Systemplaetze; der sichtbare IP-Sperrgrund war korrekt. Derselbe ausgelieferte Build aktiviert Generate mit simuliert freien Slots. Die konkrete Ursache des Mentor-Falls mit angeblich freien IP-Slots ist damit weiterhin nicht reproduziert. Die gefundenen Fehler sind keine behauptete Erklaerung dieses Videozustands. Neue lokale Aenderungen sind nicht veroeffentlicht. Keine echte Modellgenerierung oder Produktionsschreibzugriffe.

Salami und Blattsalate sind im gemeinsamen Katalog. Deutsche/englische Aliase erscheinen einmal unter englischem Namen; Paprika (Gemuese) wird Bell pepper, Paprikapulver wird Paprika powder. Backend und Frontend verwenden dieselbe Identitaet, mit unveraenderten Ernaehrungsregeln. Dafuer den aktuellen Generator-Export zusammen mit dem Frontend uebernehmen. Quota Status und Error Logger bleiben eigenstaendige Funktionen; genau drei Importdateien liegen unter n8n/exports. Die allgemeinen doppelten Vorlagen wurden entfernt und werden nicht erneut erzeugt.

Offen: Kontrolle nach Betreiber-Upload und ein bestaetigter Live-Durchlauf bis zur Speicherung. Die fachliche Portionsregel bleibt deaktiviert. Die Schrittueberschriften sind zur Lesbarkeit fett gesetzt; die Screenshots belegen 18px/500 fuer den Fliesstext, nicht exakt das Gewicht der Ueberschrift. Keine vollstaendige Figma-Pixelgleichheit behauptet. Error-Logger-Mail bleibt wie geliefert deaktiviert. Build und temporaere Pruefartefakte werden nicht versioniert; Tests, Lizenzen und notwendige Dokumentation bleiben erhalten.
