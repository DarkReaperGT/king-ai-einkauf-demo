# KING AI Einkauf – lokale Unterstützungs-KI mit Login

Diese Version nutzt einen lokalen Node.js-Server. Der OpenAI API-Key wird nicht mehr im Browser eingegeben, sondern über `.env` vom Server gelesen. Zusätzlich ist die Anwendung durch einen Unternehmens-Login geschützt.

## Design

Die Oberfläche (`public/index.html`) und die Login-Seite (`public/login.html`) verwenden jetzt die Farben aus dem Logo: Schwarz/Dunkelblau als Grundton sowie einen Blau-Violett-Verlauf (`#2f6fed → #6b2fe8`) für Buttons, aktive Tabs, Score-Ring und Chat-Blasen. Die Markenfarben stehen als CSS-Variablen (`--blue`, `--violet`, `--brand-gradient`) oben in `index.html` bzw. `login.html` und können dort zentral angepasst werden, falls sich das Logo ändert.

## Start in PowerShell

```powershell
cd "PFAD_ZU_DIESEM_ORDNER"
npm install
Copy-Item .env.example .env
notepad .env
npm start
```

Danach im Browser öffnen:

```text
http://localhost:3000
```

## Login

Die Zugangsdaten stehen in `.env`:

```env
LOGIN_USERNAME=unternehmen
LOGIN_PASSWORD=Bitte_Aendern_123!
```

Bitte ändere das Passwort, bevor du den Link an ein Unternehmen gibst.

## Deployment auf Render.com

- `NODE_ENV=production` in den Render-Umgebungsvariablen setzen (oder `COOKIE_SECURE=true`), damit das Login-Cookie korrekt als "secure" gesetzt wird. Render terminiert HTTPS am Proxy; der Server vertraut diesem Proxy jetzt über `app.set('trust proxy', 1)`, ohne das würde der Login unter Umständen nach dem Absenden einfach wieder zur Login-Seite zurückspringen.
- `OPENAI_API_KEY`, `LOGIN_USERNAME`, `LOGIN_PASSWORD` und `SESSION_SECRET` als Render-Umgebungsvariablen (nicht im Repo) eintragen.
- Start-Command: `npm start`, Build-Command: `npm install`.
- Render vergibt den Port automatisch über `PORT`; das liest der Server bereits selbst ein.

## Zugriff im gleichen Netzwerk (lokal)

Wenn dein PC und das Unternehmen bzw. der Tester im gleichen WLAN/LAN sind:

1. PowerShell öffnen:

```powershell
ipconfig
```

2. IPv4-Adresse suchen, z. B.:

```text
192.168.178.45
```

3. Tester öffnet im Browser:

```text
http://192.168.178.45:3000
```

Falls Windows fragt, ob Node.js durch die Firewall darf: Zugriff für privates Netzwerk erlauben.

## Wichtig

- In `.env` bei `OPENAI_API_KEY=` deinen echten OpenAI API-Key eintragen.
- `LOGIN_PASSWORD` vor Weitergabe ändern.
- `SESSION_SECRET` ändern.
- `.env` niemals in GitHub hochladen.
- Die HTML-App ruft nur noch `/api/openai` auf. Der Server ruft OpenAI auf.
- Für echte öffentliche Nutzung später HTTPS, Hosting, Rate-Limits und sauberes Benutzer-/Rechtemanagement ergänzen.

## Aufbau

```text
Browser / HTML-Oberfläche
  ↓
Login / Session-Cookie
  ↓
Lokaler Node.js-Server
  ↓
OpenAI Responses API
  ↓
Antwort zurück an die Anwendung
```

## Dateien

- `server.js` – lokaler Backend-Server mit Login, Session und OpenAI-Proxy
- `public/index.html` – deine angepasste Oberfläche (Logo-Farbschema)
- `public/login.html` – Login-Seite (Logo-Farbschema)
- `.env.example` – Vorlage für API-Key, Login und Servereinstellungen
- `package.json` – Start- und Installationsdaten

