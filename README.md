# Reisekostenabrechnung 2026 (Web-App)

Eine responsive Webanwendung zur **rechtssicheren Reisekostenabrechnung** nach den aktuellen deutschen Pauschalen (Stand 2026).  
Die App läuft vollständig im Browser, berechnet automatisch alle relevanten Reisekosten und erzeugt ein PDF-Dokument zur Ablage oder Weitergabe.

## Features

- Geführtes, mehrstufiges Formular (Wizard) für:
  - Persönliche Daten
  - Reisedaten
  - Kosten (Verpflegung, Übernachtung, Fahrtkosten, sonstige Kosten)
  - Zusammenfassung
- Automatische Berechnung
  - Verpflegungsmehraufwand nach deutschen Pauschalen 2026
  - Kilometerpauschale Dienstreise (0,30 €/km) bei PKW
  - Tatsächliche Fahrtkosten bei Bahn, Flugzeug, Mietwagen und Sonstige (mehrere Positionen mit Beschreibung und Betrag)
  - Kürzung der Verpflegungspauschale bei gestellten Mahlzeiten
- Sonstige Kosten mit frei definierbaren Positionen
- Optionale lokale Belege (PDF, JPEG, PNG) zu den Fahrtkosten
- ZIP‑Abrechnungspaket mit Abrechnungs‑PDF und Originalbelegen
- PDF‑Erzeugung direkt im Browser mit [jsPDF](https://github.com/parallax/jsPDF)
- Unterstützung einer Unterschrift als Bild (Upload und Einbindung in die PDF)
- Mobile‑optimiertes Layout für Nutzung auf dem Smartphone

## Tech-Stack

- HTML5, CSS3 (responsive, mobile-first)
- Vanilla JavaScript (kein Framework)
- [jsPDF](https://github.com/parallax/jsPDF) für clientseitige PDF-Erzeugung (MIT-Lizenz) [web:25][web:28]
- Läuft lokal ohne Backend/Server (reine Client-Seite)
- `reisekosten-logic.js`: Berechnung (in Cent), Validierung, Dateinamen und ein kleiner ZIP‑Writer (ohne zusätzliche Bibliothek; keine neuen Abhängigkeiten)

## Nutzung

1. Repository klonen oder herunterladen:
   ```bash
   git clone https://github.com/<DEIN_GITHUB_USERNAME>/<DEIN_REPO_NAME>.git
   cd <DEIN_REPO_NAME>

## Fahrtkosten und Belege

- **PKW:** Kilometer × 0,30 €. Eingegebene Fahrtkostenpositionen werden dabei nicht berücksichtigt.
- **Bahn, Flugzeug, Mietwagen, Sonstige:** In Schritt 3 beliebig viele Positionen mit Beschreibung und Betrag in € (z. B. `49,90` oder `49.90`) erfassen. Kilometer werden hier nicht berücksichtigt. Mindestens eine Position ist erforderlich; leere, ungültige oder negative Beträge werden abgelehnt. Ein Betrag von 0 € ist erlaubt, es erscheint ein Hinweis.
- Bei einem Wechsel des Verkehrsmittels zählt immer nur das aktuell gewählte Verkehrsmittel; es gibt keine Doppelzählung. Beträge werden intern in Cent summiert.
- **Belege (optional):** In Schritt 3 können mehrere PDF-, JPEG- oder PNG-Dateien ausgewählt und einzeln entfernt werden. Limits: max. 5 MB je Datei, max. 10 Dateien, insgesamt max. 20 MB. Dateityp (Endung, MIME-Typ und Dateikopf) und Größe werden geprüft.
- **Datenschutz:** Belege bleiben lokal im Browser. Es gibt keine Übertragung und keine Serverkomponente.
- **Export:** In Schritt 4 erzeugt „PDF erstellen“ weiterhin das Abrechnungs-PDF (jetzt mit Aufschlüsselung der Fahrtkosten und Belegverzeichnis). „ZIP-Abrechnungspaket“ erzeugt ein ZIP mit dem Abrechnungs-PDF und den Originalbelegen im Ordner `Belege/`. Belegdateien werden als `Beleg_01_<bereinigter-name>.<ext>` abgelegt (Pfade und Sonderzeichen entfernt, Nummerierung verhindert Kollisionen). Die Dateiinhalte sind unverändert, das ZIP ist nicht komprimiert („stored“).

## Tests

Automatisierte Tests der Logik (Node.js ≥ 18, keine Abhängigkeiten):

```bash
node --test "tests/*.test.js"
```

Manuelle Browser-Tests (empfohlen vor einem Release):

1. Verkehrsmittel PKW, 100 km → Fahrtkosten 30,00 €.
2. Zurück zu Schritt 2, Bahn wählen → Fahrtkosten nur aus den Positionen (Kilometer zählen nicht).
3. Positionen 59,90 und 49,90 → 109,80 €; negativer/leerer/ungültiger Betrag → Fehlermeldung, kein Wechsel zu Schritt 4.
4. Belege auswählen (PDF/PNG/JPEG), unzulässige Datei wird abgelehnt, Entfernen funktioniert.
5. Schritt 4: Übersicht, PDF und ZIP prüfen (PDF + `Belege/…`), auch auf dem Smartphone.
