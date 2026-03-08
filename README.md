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
  - Kilometerpauschale Dienstreise (0,30 €/km)
  - Kürzung der Verpflegungspauschale bei gestellten Mahlzeiten
- Sonstige Kosten mit frei definierbaren Positionen
- PDF‑Erzeugung direkt im Browser mit [jsPDF](https://github.com/parallax/jsPDF)
- Unterstützung einer Unterschrift als Bild (Upload und Einbindung in die PDF)
- Mobile‑optimiertes Layout für Nutzung auf dem Smartphone

## Tech-Stack

- HTML5, CSS3 (responsive, mobile-first)
- Vanilla JavaScript (kein Framework)
- [jsPDF](https://github.com/parallax/jsPDF) für clientseitige PDF-Erzeugung (MIT-Lizenz) [web:25][web:28]
- Läuft lokal ohne Backend/Server (reine Client-Seite)

## Nutzung

1. Repository klonen oder herunterladen:
   ```bash
   git clone https://github.com/<DEIN_GITHUB_USERNAME>/<DEIN_REPO_NAME>.git
   cd <DEIN_REPO_NAME>
