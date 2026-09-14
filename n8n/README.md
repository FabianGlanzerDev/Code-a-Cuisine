# n8n für Code à Cuisine

## Konfigurierte Importdateien

| Bestehender Workflow | Export | Workflow-ID |
| --- | --- | --- |
| Generate Recipe | `exports/generate-recipe-input-popup.json` | `nVrQ3KLEq6mJNb44` |
| Quota Status | `exports/quota-status-reviewed.json` | `yBnnpHc4mZgvn8tn` |
| Error Logger | `exports/error-logger-reviewed.json` | `kCD1jJO2WgxZWRgN` |

Diese Dateien basieren auf den bereitgestellten Eigentümer-Exporten. Workflow-/Node-IDs, Credential-Verweise, Webhook-Konfiguration und benötigte Funktionen bleiben erhalten. Sprechende Node-Namen und Referenzen sind in `node-name-mapping.json` zugeordnet. Alte Zwischenexporte und die drei allgemeinen Importvorlagen wurden entfernt. Der aktuelle Stand verwendet die Node-IDs der zuletzt gelieferten Exporte.

Zur Übernahme bestehende Workflows sichern und jeweils den passenden Export in den bestehenden Workflow importieren. IDs, vorhandene Credential-Zuordnungen, Firebase-Ziel, Webhook-Pfade und Fehlerworkflow prüfen; danach selbst veröffentlichen. Quota Status verweist auf den obigen Error Logger. Keine Zugangsdaten ins Repository eintragen. Import und Veröffentlichung wurden hier nicht ausgeführt.

Der Error Logger gibt eine feste bereinigte Meldung mit Ausführungs-/Workflowkennung weiter, keine rohe Exception. Die E-Mail-Node bleibt wie geliefert deaktiviert und ohne Credential-Zuordnung; Mailzustellung ist nicht bestätigt. n8n-Ausführungsdaten selbst können Nutzereingaben enthalten und müssen geschützt bleiben.

## Validierung und Quoten

- Salami und konkrete Blattsalate sind enthalten. Der gemeinsame Alias-Katalog vereinheitlicht deutsche/englische Namen und erkennt doppelte Zutaten. Paprika als Eingabe bezeichnet Bell pepper, Paprikapulver die Gewuerzzutat Paprika powder. Bestehende Modellantworten mit paprika in den Extra-Zutaten werden als Gewuerz normalisiert.
- Eingaben werden vor Quotenreservierung und Modellaufruf geprüft: bekannte Zutaten aus `src/app/data/ingredients.json`, gültige Einheiten, positive Mengen und zulässige Präferenzen.
- `INVALID_RECIPE_INPUT` (HTTP 400) öffnet das Eingabe-Popup. `INSUFFICIENT_INGREDIENT_QUANTITIES` bleibt für eine fachlich bestätigte Mengenregel reserviert. Die Policy ist deaktiviert (`not_assessed`); es gibt keine erfundenen Portionsgrenzen oder Stück-/Gramm-Umrechnungen.
- Eine Generierung reserviert atomar drei Plätze: drei pro IP und zwölf systemweit pro UTC-Tag. Unbestätigte Reservierungen starten keinen Modellaufruf. Reservierte Plätze werden bei Modellfehlern nicht freigegeben. Produktionszähler nicht zurücksetzen.
- Genau drei Alternativen mit unabhängiger Mengenprüfung. Vegetable oil wird gezielt zu oil normalisiert; Vegetable broth ist keine erlaubte Wasser-Alternative. Zutatenlimit und Ernährungsprüfungen bleiben erhalten.
- Abhängigkeiten müssen vor Beginn des Folgeschritts beendet sein. Kochzuordnung, Parallelität und Gesamtdauer werden geprüft; fehlerhafte Abhängigkeiten werden nicht entfernt.
- Makro-Prozentwerte werden deterministisch nach 4/9/4 aus validierten Grammwerten berechnet. Anzeige-Rundung ist getrennt, Keto nutzt den ungerundeten Kohlenhydratanteil. Einheiten, endliche nichtnegative Werte, Kalorienkonsistenz und Portionsskalierung bleiben geprüft. Rechnerische Konsistenz belegt keine sachliche Genauigkeit der Schätzung.
- Modellvalidierung behält konkrete interne Fehlercodes, Rezeptindex und Feld. Modell-, Nährwert-, Zeitplan-, Netzwerk- und Quotenfehler werden nicht als unzureichende Nutzermengen behandelt.
- Atomare Firebase-Speicherung mit stabilen IDs und bis zu drei reinen Speicher-Versuchen. Keine automatische Modellwiederholung. Frontend-Speicherbestätigung arbeitet lesend.

## Quellen und Tests

```sh
npm run test:backend
npm run n8n:check
```

61 lokale Backendtests prüfen unter anderem die Originalantworten #114 und #136. #136 wird mit seiner eigenen Anfrage ohne Chickpeas akzeptiert. #114 bleibt wegen nicht erlaubter Brühe abgelehnt; weitere Zeitplanfehler werden mit isolierten Kopien geprüft. Rekonstruierte Tests sind separat benannt. Keine neue Modellanfrage für diese Tests.

`lib/`, `prompts/recipes.txt` und der gemeinsame Zutatenkatalog samt Aliaszuordnung sind die Quellen. `npm run n8n:build` aktualisiert den generierten Code direkt in den beiden konfigurierten Generator-/Status-Exporten. IDs, Credentials, Einstellungen, Verbindungen und andere Node-Parameter bleiben erhalten. Es entstehen keine weiteren Importvorlagen. `n8n:check` erkennt lokale Code-Abweichungen; es kontrolliert nicht den Server. Der Error Logger bleibt der separat gepflegte dritte Export.

Regeln und Emulator: [../firebase/README.md](../firebase/README.md). Lokale Tests bestätigen weder aktuelle Serverregeln noch einen erfolgreichen Live-Durchlauf mit Modell und Speicherung. Frontend-Upload und Hash-Routing: [../README.md](../README.md).

Fuer diese Korrekturen ist der aktualisierte Generator-Export zu uebernehmen. Quota Status und Error Logger benoetigen gegenueber den zuletzt gelieferten Versionen keine funktionale Umstellung; sie bleiben als eindeutige aktuelle Importdateien dokumentiert. Der Status-Export enthaelt den aktualisierten gemeinsamen Validierungsquelltext, ohne die Quotenentscheidung zu aendern.
