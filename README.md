# KING AI – KI-gestützte Lastenheft- und Angebotsanalyse

KING AI ist ein webbasierter Software-Prototyp zur Unterstützung des Investitionsgütereinkaufs.

Die Anwendung verarbeitet Lastenhefte und Angebotsdateien, strukturiert relevante Informationen und unterstützt den Vergleich mehrerer Anbieter. Auf Grundlage der extrahierten Daten werden Kriterienerfüllung, Gewichtungen, Rangfolgen und eine Entscheidungsempfehlung dargestellt.

> **KI unterstützt – der Mensch entscheidet.**

KING AI befindet sich im Prototypstatus. Ergebnisse müssen fachlich kontrolliert werden und dürfen nicht ungeprüft für reale Beschaffungs- oder Vergabeentscheidungen verwendet werden.

> **Stand dieser Dokumentation:** bereinigte Projektversion ohne alte HTML-Sicherungen und ohne nicht eingebundene Altdateien.

---

## Zentrale Funktionen

KING AI verbindet drei priorisierte Use Cases:

1. **Lastenheftanalyse**
2. **Angebotsanalyse**
3. **Entscheidungsempfehlung**

### Lastenheftanalyse

Die Anwendung unterstützt:

- das Hochladen von Lastenheften und technischen Spezifikationen,
- die Extraktion relevanter Anforderungen,
- die Klassifizierung in Muss-, Soll- und Kann-Kriterien,
- die Erkennung von Projekt, Investitionsgut, Budget und Lieferzeit,
- die strukturierte Darstellung der erkannten Anforderungen,
- den Export als HTML oder CSV.

### Angebotsanalyse

Die Angebotsanalyse ermöglicht:

- den getrennten Upload von Angebotsdateien,
- die Erkennung realer Lieferanten,
- die Extraktion von Preis, Lieferzeit, Garantie und Service,
- die Erfassung technischer Angebotsdaten,
- die Kennzeichnung fehlender oder unklarer Angaben,
- die strukturierte Darstellung mehrerer Anbieter,
- den Export als HTML oder CSV.

### Vergleich und Entscheidungsempfehlung

Die Anwendung vergleicht Angebote mit dem Lastenheft und stellt unter anderem dar:

- Muss-Erfüllung,
- Soll-Erfüllung,
- Preisbewertung,
- Lieferzeit,
- Serviceumfang,
- Datenvollständigkeit,
- technische Passung,
- gewichteten Gesamtscore,
- Rangfolge der Anbieter,
- kritische Abweichungen,
- begründete Entscheidungsempfehlung.

Nicht erfüllte oder nicht nachweisbare Muss-Kriterien werden nicht automatisch als erfüllt bewertet.

---

## Weitere Funktionen

- Dashboard mit Projektübersicht
- Anlegen, Umbenennen und Löschen mehrerer Projekte
- getrennte Bereiche für Lastenhefte und Angebote
- projektbezogene Gewichtung der Bewertungskriterien
- KI-Chat zu analysierten Dokumenten
- Chatverlauf pro Projekt
- Export strukturierter Gesamtdaten als JSON
- Export einer Entscheidungsvorlage als HTML
- Erstellung eines Druckberichts
- temporäre Verwaltung des Projektstands im Browser-Arbeitsspeicher; ohne Datenbank ist dieser Zustand nicht dauerhaft gespeichert
- serverseitige Speicherung von technischem Feedback
- anpassbare Seitenleistenfarbe
- Statusanzeige für die OpenAI-Verbindung

---

## Unterstützte Dateiformate

Der Prototyp enthält clientseitige Parser für:

- PDF
- TXT
- CSV
- Excel beziehungsweise XLSX
- DOCX
- einfache E-Mail- oder Textinhalte

Für die Verarbeitung werden unter anderem folgende Browser-Bibliotheken verwendet:

- PDF.js
- SheetJS
- Mammoth.js

### Derzeit eingeschränkt

Gescannte PDF-Dateien ohne auslesbaren Text benötigen zusätzlich OCR.

MSG-Dateien und komplexe E-Mail-Container benötigen einen speziellen Parser und können derzeit nicht zuverlässig direkt verarbeitet werden.

---

## Technischer Aufbau

```text
Browser
  ↓
KING-AI-Oberfläche
  ↓
Dateiparser im Browser
  ↓
Node.js-/Express-Backend
  ↓
Interne Analyse-Endpunkte
  ↓
OpenAI Responses API
  ↓
Strukturierte Ergebnisse
  ↓
Vergleich und Entscheidungsempfehlung
```

### Sicherheitsrelevanter Aufbau

Der OpenAI API-Key wird nicht im Browser eingegeben oder gespeichert.

```text
Browser
  ↓
/api/openai
  ↓
Node.js-Server
  ↓
OPENAI_API_KEY aus .env
  ↓
OpenAI API
```

Der Browser kommuniziert ausschließlich mit dem eigenen Backend. Das Backend führt die Anfrage an OpenAI weiter.

---

## Kein Login-System

Diese Version enthält bewusst:

- keinen Login,
- keine Registrierung,
- keine Benutzerkonten,
- keine Session-Verwaltung,
- keine Passwortverwaltung,
- keine Rollen- oder Rechteverwaltung.

Die Anwendung ist nach dem Start direkt erreichbar.

### Wichtiger Hinweis für öffentliches Hosting

Wird die Anwendung über Render oder einen anderen öffentlich erreichbaren Dienst bereitgestellt, kann grundsätzlich jede Person mit dem Link die Anwendung öffnen.

Daher dürfen ohne zusätzliche Zugriffskontrolle keine vertraulichen Unternehmensunterlagen, personenbezogenen Daten oder geheimen Angebote verarbeitet werden.

Für einen produktiven Einsatz wären später erforderlich:

- Authentifizierung,
- Benutzer- und Rollenverwaltung,
- Zugriffsbeschränkungen,
- Rate-Limits,
- sichere Datenbank,
- Protokollierung,
- Datenschutzkonzept,
- Löschkonzept.

---

## Voraussetzungen

Benötigt werden:

- Node.js 18.18 oder neuer
- npm
- moderner Webbrowser
- OpenAI API-Key
- Internetverbindung für OpenAI und externe Browser-Bibliotheken

Versionen prüfen:

```powershell
node --version
npm --version
```

---

## Lokale Installation

### 1. ZIP-Datei entpacken

Entpacke das Projekt beispielsweise in:

```text
C:\Users\DEIN_NAME\Documents\king-ai-einkauf-demo-main
```

### 2. PowerShell öffnen

```powershell
cd "C:\Users\DEIN_NAME\Documents\king-ai-einkauf-demo-main"
```

Passe den Pfad an deinen tatsächlichen Speicherort an.

### 3. Abhängigkeiten installieren

```powershell
npm install
```

### 4. `.env` erstellen

```powershell
Copy-Item ".env.example" ".env"
```

### 5. `.env` bearbeiten

```powershell
notepad .env
```

Trage dort deinen OpenAI API-Key ein.

### 6. Anwendung starten

```powershell
npm start
```

Danach im Browser öffnen:

```text
http://localhost:3000
```

Server beenden:

```text
Strg + C
```

---

## Umgebungsvariablen

Die Datei `.env.example` enthält die benötigten Einstellungen:

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-5.5
PORT=3000
HOST=0.0.0.0
```

### `OPENAI_API_KEY`

Der persönliche OpenAI API-Key:

```env
OPENAI_API_KEY=sk-...
```

Der Key darf niemals in GitHub hochgeladen werden.

### `OPENAI_MODEL`

Das vom Backend verwendete Modell:

```env
OPENAI_MODEL=gpt-5.5
```

Das Modell kann zentral über die Umgebungsvariable geändert werden.

### `PORT`

Lokaler Server-Port:

```env
PORT=3000
```

### `HOST`

Mit folgender Einstellung ist die Anwendung auch im lokalen Netzwerk erreichbar:

```env
HOST=0.0.0.0
```

---

## Zugriff im lokalen Netzwerk

Wenn sich der Server-PC und ein Testgerät im gleichen WLAN oder LAN befinden, kann die Anwendung lokal geteilt werden.

### IPv4-Adresse ermitteln

```powershell
ipconfig
```

Beispiel:

```text
192.168.178.45
```

Danach öffnet die Testperson:

```text
http://192.168.178.45:3000
```

Voraussetzungen:

- beide Geräte befinden sich im gleichen Netzwerk,
- KING AI läuft mit `npm start`,
- Node.js ist in der Windows-Firewall für private Netzwerke freigegeben,
- der verwendete Port wird nicht blockiert.

---

## API-Endpunkte

Das Backend stellt folgende Endpunkte bereit:

### Systemstatus

```http
GET /api/health
```

Liefert unter anderem:

- Backendstatus,
- OpenAI-Verfügbarkeit,
- aktives Modell.

### Allgemeine OpenAI-Anfrage

```http
POST /api/openai
```

Wird unter anderem für den KI-Chat verwendet.

### Lastenheftanalyse

```http
POST /api/analyze/requirements
```

Extrahiert strukturierte Anforderungen aus dem Lastenheft.

### Angebotsanalyse

```http
POST /api/analyze/offers
```

Extrahiert Lieferanten und Angebotsdaten.

### Angebotsvergleich

```http
POST /api/analyze/compare
```

Vergleicht Anforderungen und Angebote und erzeugt eine Empfehlung.

### Trainingsspeicher

```http
GET /api/memory
```

Liefert Regeln für die Datenbereinigung und Lieferantenerkennung.

### Feedback

```http
POST /api/feedback
```

Speichert internes technisches Feedback zur späteren Verbesserung.

---

## Daten und interner Trainingsspeicher

Der Ordner `data` enthält:

```text
data/training-memory.json
```

Diese Datei enthält unter anderem:

- Begriffe, die nicht als Lieferanten erkannt werden dürfen,
- typische Bestandteile von Firmennamen,
- Hinweise zur Bereinigung von Anforderungen,
- Regeln gegen falsche Lieferantenerkennung.

Bei abgegebenem Feedback kann zusätzlich folgende Datei erzeugt werden:

```text
data/feedback.jsonl
```

Diese Datei sollte nicht veröffentlicht werden, wenn sie sensible Dokumentinformationen enthalten könnte.

### Aktuelle Datenhaltung

Die aktuelle Version verwendet keine SQL- oder NoSQL-Datenbank.

- Projekte, Uploadzuordnungen, Analyseergebnisse und Chatdaten werden während der Nutzung im Browserzustand verwaltet.
- Diese Daten sind nicht als belastbare dauerhafte Mehrbenutzerspeicherung ausgelegt.
- `training-memory.json` enthält feste Regeln und ersetzt keine Projektdatenbank.
- `feedback.jsonl` kann technisches Feedback speichern, ist aber ebenfalls keine allgemeine Datenbank.
- GitHub dient als Versions- und Quellcodespeicher und ersetzt keine Datenbank der laufenden Anwendung.
- Ohne zusätzliche Persistenz können Anwendungsdaten nach einem Neuladen, Neustart oder einer neuen Sitzung verloren gehen.

---

## Deployment auf Render

### Voraussetzungen

Folgende Dateien müssen im Repository vorhanden sein:

```text
server.js
package.json
package-lock.json
public/
data/training-memory.json
.env.example
.gitignore
README.md
```

Die echte `.env`-Datei darf nicht hochgeladen werden.

### Render-Einstellungen

**Build Command**

```text
npm install
```

**Start Command**

```text
npm start
```

### Umgebungsvariablen

In Render unter **Environment** eintragen:

```env
OPENAI_API_KEY=DEIN_OPENAI_API_KEY
OPENAI_MODEL=gpt-5.5
HOST=0.0.0.0
```

`PORT` wird von Render automatisch vergeben und vom Server selbst gelesen.

### Deployment prüfen

Nach der Bereitstellung:

- Startseite öffnen,
- Backendstatus kontrollieren,
- Lastenheft hochladen,
- Angebot hochladen,
- Analyse starten,
- KI-Chat testen,
- Export testen,
- Server-Logs auf Fehler kontrollieren.

### Sicherheitswarnung

Da kein Login vorhanden ist, ist die veröffentlichte Anwendung für jede Person mit dem Render-Link erreichbar.

Verwende in der öffentlich bereitgestellten Version ausschließlich:

- Testdaten,
- anonymisierte Daten,
- synthetische Lastenhefte,
- synthetische Angebote.

---

## Projektstruktur

Die bereinigte aktuelle Version enthält ausschließlich die für Betrieb, Konfiguration und Dokumentation benötigten Dateien:

```text
king-ai-einkauf-demo-main/
│
├── data/
│   └── training-memory.json
│
├── public/
│   ├── index.html
│   ├── backend-openai-only.js
│   ├── backend-analysis-bridge.js
│   ├── key-status-lamp.js
│   └── quiet-status.js
│
├── server.js
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
└── README.md
```

Alte Sicherungskopien sowie die nicht eingebundenen Dateien `app.js`, `styles.css`, `auth-profile.js` und `server-openai.js` wurden aus dem aktuellen Projektstand entfernt.

---

## Beschreibung der aktuellen Dateien

### `server.js`

Zentraler Einstiegspunkt des Node.js-/Express-Backends. Die Datei:

- startet den Webserver,
- stellt den Ordner `public` als Frontend bereit,
- lädt Umgebungsvariablen,
- liest den Trainingsspeicher ein,
- schützt den OpenAI API-Key vor einer Speicherung im Browser,
- stellt die Analyse- und Status-Endpunkte bereit,
- sendet Analyseanfragen an die OpenAI Responses API,
- validiert und bereinigt strukturierte Antworten,
- kann technisches Feedback serverseitig speichern.

Ohne `server.js` starten weder Backend noch Frontend.

### `public/index.html`

Hauptdatei der Benutzeroberfläche. Sie enthält:

- die HTML-Struktur,
- die aktiven CSS-Regeln,
- einen großen Teil der Frontend-Logik,
- Dashboard und Projektansichten,
- Datei-Upload und clientseitige Parser,
- Lastenheft- und Angebotsdarstellung,
- Vergleich und Entscheidungsempfehlung,
- Exportfunktionen,
- KI-Chat und Einstellungen.

Da keine separate aktive `styles.css` und keine separate aktive `app.js` mehr vorhanden sind, befinden sich Gestaltung und wesentliche Anwendungslogik direkt in dieser Datei.

### `public/backend-openai-only.js`

Kapselt die Kommunikation des Browsers mit dem eigenen Backend. Direkte OpenAI-Aufrufe aus dem Browser werden vermieden, damit der API-Key ausschließlich serverseitig gespeichert bleibt.

### `public/backend-analysis-bridge.js`

Verbindet die Benutzeroberfläche mit den spezialisierten Backend-Endpunkten für:

- Lastenheftanalyse,
- Angebotsanalyse,
- Vergleich und Empfehlung.

Die Datei überträgt extrahierten Dokumenttext an das Backend und schreibt die strukturierten Antworten zurück in den aktuellen Anwendungszustand.

### `public/key-status-lamp.js`

Prüft über den Systemstatus-Endpunkt, ob:

- das Backend erreichbar ist,
- ein OpenAI API-Key konfiguriert ist,
- die KI-Verbindung grundsätzlich verwendet werden kann.

Das Ergebnis wird als Statusanzeige in der Benutzeroberfläche dargestellt.

### `public/quiet-status.js`

Passt bestimmte Status- und Hinweistexte in der Oberfläche an, damit technische Meldungen kompakter und für die Präsentation weniger störend erscheinen.

### `data/training-memory.json`

Enthält feste Filter- und Bereinigungsregeln, beispielsweise:

- Begriffe, die nicht als Lieferant gelten,
- typische Bestandteile von Firmennamen,
- Regeln zur Bereinigung erkannter Anforderungen,
- Hinweise gegen falsche Lieferantenerkennung.

Die Datei ist ein regelbasierter Projektspeicher, aber keine lernende KI und keine Datenbank für Benutzerprojekte.

### `package.json`

Beschreibt das Node.js-Projekt. Die Datei enthält insbesondere:

- Projektname und Version,
- Startskript,
- benötigte Laufzeitpakete,
- Node.js-Anforderungen.

`npm start` verwendet den dort definierten Startbefehl und führt `server.js` aus.

### `package-lock.json`

Fixiert die tatsächlich installierten Paketversionen. Dadurch installiert `npm install` beziehungsweise `npm ci` auf unterschiedlichen Rechnern möglichst denselben Abhängigkeitsstand.

### `.env.example`

Vorlage für die benötigten Umgebungsvariablen:

- `OPENAI_API_KEY`,
- `OPENAI_MODEL`,
- `PORT`,
- `HOST`.

Die Datei enthält keinen echten geheimen Schlüssel. Für den lokalen Betrieb wird daraus eine nicht veröffentlichte `.env` erstellt.

### `.gitignore`

Legt fest, welche lokalen oder sensiblen Dateien Git nicht versionieren soll. Dazu gehören insbesondere:

- `.env`,
- `node_modules`,
- lokale Feedbackdaten,
- Editor- und Betriebssystemdateien.

### `README.md`

Dokumentiert Installation, Betrieb, Architektur, Sicherheit, Deployment, Projektgrenzen und den aktuellen Entwicklungsstand.
---

## Test-&-Learn-Phase

Der Prototyp wurde intern in mehreren Testdurchläufen mit generierten Lastenheften und Angebotsdateien geprüft.

Getestet wurden:

- Datei-Upload,
- unterschiedliche Dokumentgrößen,
- Lastenheftauslesung,
- Muss-/Soll-/Kann-Klassifizierung,
- Lieferantenerkennung,
- Angebotsauslesung,
- Vergleich mehrerer Anbieter,
- Gewichtungslogik,
- Rangfolge,
- Entscheidungsempfehlung,
- Frontend-Darstellung,
- Exportfunktionen.

### Erkannte und behobene Fehler

- Fehler beim Datei-Upload wurden reduziert beziehungsweise behoben.
- Falsch im Frontend dargestellte interne Daten wurden korrigiert.
- Tabellenbegriffe und Zahlen werden stärker als falsche Lieferantennamen herausgefiltert.
- Anforderungen werden gekürzt und von Inhaltsverzeichnissen sowie allgemeinen Projekttexten bereinigt.
- Der OpenAI API-Key wurde vollständig aus dem Browser entfernt und in das Backend verlagert.

### Offener Verbesserungsbedarf

- Die Datenextraktion ist noch nicht in allen Fällen zuverlässig.
- Die Laufzeit schwankt abhängig von Dokumentgröße und Dokumentstruktur.
- Die Gewichtungs- und Berechnungslogik ist noch nicht vollständig validiert.
- Eine externe Nutzerevaluation steht noch aus.
- Die fachliche Qualität wurde noch nicht systematisch mit Expertenbewertungen verglichen.

---

## Bekannte Limitationen

### Verarbeitungszeit

Die Dokumentenanalyse dauert derzeit abhängig von Größe und Struktur der Dateien ungefähr:

```text
3 bis 6 Minuten
```

### Fehleranfällige Extraktion

Mögliche Probleme:

- unvollständig erkannte Anforderungen,
- falsch zugeordnete Werte,
- fehlende Lieferantenangaben,
- falsch interpretierte Tabellen,
- Probleme mit uneindeutigen Formulierungen,
- eingeschränkte Verarbeitung gescannter Dokumente.

### Gewichtungs- und Berechnungslogik

Die Gewichtung arbeitet noch nicht in allen Fällen vollständig korrekt.

Dadurch können entstehen:

- fehlerhafte Scores,
- falsche Rangfolgen,
- unzutreffende Kriterienerfüllungen,
- nicht belastbare Entscheidungsempfehlungen.

### Keine externe Nutzerevaluation

Der Prototyp wurde intern getestet, aber noch nicht systematisch durch Personen aus Einkauf oder Technik evaluiert.

Daher sind Aussagen zu folgenden Punkten nur eingeschränkt möglich:

- Benutzerfreundlichkeit,
- Praxistauglichkeit,
- tatsächliche Zeitersparnis,
- Akzeptanz,
- fachliche Zuverlässigkeit.

### Keine Zugriffskontrolle

Da kein Login vorhanden ist, besitzt die Anwendung keine Zugriffsbeschränkung.

---

## Fachlicher Hinweis

KING AI ist eine Entscheidungshilfe.

Die Anwendung:

- ersetzt keine fachliche Prüfung,
- übernimmt keine rechtlich verbindliche Vergabeentscheidung,
- darf fehlende Daten nicht erfinden,
- kann technische Nachweise nicht vollständig selbst überprüfen,
- kann aufgrund fehlerhaft ausgelesener Daten falsche Ergebnisse liefern.

Die finale Entscheidung verbleibt bei den verantwortlichen Personen.

---

## `.gitignore`

Empfohlener Inhalt:

```gitignore
node_modules/

.env
.env.*
!.env.example

npm-debug.log*
yarn-debug.log*
yarn-error.log*

data/feedback.jsonl

.DS_Store
Thumbs.db

.vscode/
.idea/

dist/
build/
coverage/
```

---

## Sicherheit

Niemals in GitHub veröffentlichen:

- `.env`
- OpenAI API-Key
- vertrauliche Lastenhefte
- reale Unternehmensangebote
- personenbezogene Daten
- interne Feedbackdateien
- Passwörter oder Zugangsdaten

Falls ein echter API-Key bereits veröffentlicht wurde:

1. alten Key deaktivieren,
2. neuen Key erstellen,
3. neuen Key ausschließlich in `.env` oder Render speichern,
4. Git-Historie auf sensible Daten prüfen.

---

## Fehlerbehebung

### `npm` wird nicht erkannt

Node.js installieren und PowerShell neu starten:

```powershell
node --version
npm --version
```

### `package.json` wurde nicht gefunden

Prüfen, ob PowerShell im richtigen Ordner geöffnet ist:

```powershell
Get-Location
Get-ChildItem
```

### OpenAI API-Key fehlt

```powershell
notepad .env
```

Prüfen:

```env
OPENAI_API_KEY=sk-...
```

Danach den Server neu starten:

```powershell
npm start
```

### Backend nicht erreichbar

Prüfen, ob der Server läuft:

```text
http://localhost:3000/api/health
```

Die Antwort sollte ungefähr enthalten:

```json
{
  "ok": true,
  "openaiReady": true,
  "backendOnly": true
}
```

### Port bereits belegt

In `.env` ändern:

```env
PORT=3001
```

Danach öffnen:

```text
http://localhost:3001
```

### Lokaler Netzwerkzugriff funktioniert nicht

Prüfen:

- gleiche WLAN-Verbindung,
- korrekte IPv4-Adresse,
- Windows-Firewall,
- laufender Node.js-Server,
- richtiger Port.

---

## Verwendete Technologien

| Bereich | Technologie |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| PDF-Verarbeitung | PDF.js |
| Excel-Verarbeitung | SheetJS |
| DOCX-Verarbeitung | Mammoth.js |
| Backend | Node.js, Express |
| KI-Anbindung | OpenAI Responses API |
| Konfiguration | dotenv |
| Datenformate | JSON, JSONL, CSV |
| Temporärer Anwendungszustand | Browser-Arbeitsspeicher; keine Projektdatenbank |
| Entwicklung | Visual Studio Code |
| Versionsverwaltung | Git und GitHub |
| Hosting | Render |

---

## Projektstatus

KING AI befindet sich im Prototypstatus.

Vor einem produktiven Einsatz sind insbesondere notwendig:

- zuverlässigere Dokumentenextraktion,
- Validierung der Gewichtungslogik,
- automatisierte Tests,
- Stabilitäts- und Belastungstests,
- Datenschutz- und Sicherheitsprüfung,
- Benutzer- und Rollenverwaltung,
- Datenbankanbindung,
- externe Nutzertests,
- Expertenvalidierung,
- Zugriffsschutz für öffentliches Hosting.

---

## Team

**Team 10**
Aus privaten Gründen nicht angezeigt.
### Hochschule

TH Köln  
Fakultät für Informatik und Ingenieurwissenschaften  
Institute for Business Administration and Leadership

### Modul

Wissenschaftliches Arbeiten und Grundlagen der Projektarbeit  
Sommersemester 2026

---

## Rechtlicher Hinweis

KING AI ist ein studentischer Software-Prototyp.

Die Anwendung stellt keine verbindliche Einkaufs-, Vergabe-, Rechts- oder Unternehmensberatung dar. Ergebnisse können aufgrund unvollständiger Dokumente, fehlerhafter Extraktion oder nicht vollständig validierter Berechnungen unzutreffend sein.

Die finale Prüfung und Entscheidung verbleiben beim Menschen.
