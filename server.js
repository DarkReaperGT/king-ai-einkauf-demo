require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-5.5';
const API_KEY = process.env.OPENAI_API_KEY || '';

const LOGIN_USERNAME = process.env.LOGIN_USERNAME || 'unternehmen';
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || 'Bitte_Aendern_123!';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-bitte-in-env-aendern';
const COOKIE_SECURE = String(process.env.COOKIE_SECURE || 'false').toLowerCase() === 'true';
const SESSION_HOURS = Number(process.env.SESSION_HOURS || 8);

const failedLogins = new Map();

app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));

app.use(session({
  name: 'king_ai_einkauf_sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: COOKIE_SECURE,
    maxAge: Math.max(1, SESSION_HOURS) * 60 * 60 * 1000
  }
}));

function isOpenAIReady() {
  return Boolean(API_KEY && API_KEY.length > 20);
}

function isAuthenticated(req) {
  return Boolean(req.session && req.session.authenticated === true);
}

function requireAuth(req, res, next) {
  if (isAuthenticated(req)) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Nicht angemeldet. Bitte zuerst einloggen.' });
  }
  return res.redirect('/login');
}

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function isRateLimited(ip) {
  const entry = failedLogins.get(ip);
  if (!entry) return false;
  const now = Date.now();
  if (now > entry.blockedUntil) {
    failedLogins.delete(ip);
    return false;
  }
  return entry.count >= 8;
}

function registerFailedLogin(ip) {
  const now = Date.now();
  const current = failedLogins.get(ip) || { count: 0, blockedUntil: 0 };
  const nextCount = current.count + 1;
  failedLogins.set(ip, {
    count: nextCount,
    blockedUntil: nextCount >= 8 ? now + 15 * 60 * 1000 : now + 5 * 60 * 1000
  });
}

function clearFailedLogin(ip) {
  failedLogins.delete(ip);
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function cleanText(value, maxChars) {
  const text = typeof value === 'string' ? value : String(value || '');
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n[Text serverseitig gekürzt]';
}

function extractOutputText(data) {
  if (typeof data?.output_text === 'string') return data.output_text;
  const parts = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') parts.push(content.text);
      if (typeof content?.value === 'string') parts.push(content.value);
    }
  }
  return parts.join('\n').trim();
}

app.get('/login', (req, res) => {
  if (isAuthenticated(req)) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
  const ip = getClientIp(req);

  if (isRateLimited(ip)) {
    return res.status(429).send('Zu viele Login-Versuche. Bitte nach 15 Minuten erneut versuchen.');
  }

  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');

  if (username === LOGIN_USERNAME && password === LOGIN_PASSWORD) {
    clearFailedLogin(ip);
    req.session.regenerate((error) => {
      if (error) return res.status(500).send('Session konnte nicht erstellt werden.');
      req.session.authenticated = true;
      req.session.username = username;
      req.session.loginAt = new Date().toISOString();
      return res.redirect('/');
    });
    return;
  }

  registerFailedLogin(ip);
  return res.status(401).send(`
    <!doctype html>
    <html lang="de">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Login fehlgeschlagen</title>
        <style>
          body{font-family:Arial,sans-serif;background:#f1f5f9;color:#0f172a;display:grid;place-items:center;min-height:100vh;margin:0}
          main{background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:28px;max-width:460px;box-shadow:0 18px 48px rgba(15,23,42,.12)}
          a{display:inline-block;margin-top:14px;color:#1d4ed8;font-weight:700;text-decoration:none}
        </style>
      </head>
      <body>
        <main>
          <h1>Login fehlgeschlagen</h1>
          <p>Benutzername oder Passwort ist falsch.</p>
          <a href="/login">Zurück zum Login</a>
        </main>
      </body>
    </html>
  `);
});

app.post('/logout', requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('king_ai_einkauf_sid');
    res.redirect('/login');
  });
});

app.get('/api/session', requireAuth, (req, res) => {
  res.json({
    authenticated: true,
    username: req.session.username || LOGIN_USERNAME,
    loginAt: req.session.loginAt || null
  });
});

app.get('/api/health', requireAuth, (_req, res) => {
  res.json({
    ok: true,
    openaiReady: isOpenAIReady(),
    model: DEFAULT_MODEL
  });
});

app.post('/api/openai', requireAuth, async (req, res) => {
  try {
    if (!isOpenAIReady()) {
      return res.status(500).json({
        error: 'OPENAI_API_KEY fehlt. Trage deinen API-Key in die .env-Datei ein und starte den Server neu.'
      });
    }

    const input = cleanText(req.body?.input, 140000);
    const instructions = cleanText(
      req.body?.instructions || 'Du bist ein präziser Assistent für Einkauf, Lastenheftanalyse und Angebotsvergleich.',
      8000
    );
    const model = cleanText(req.body?.model || DEFAULT_MODEL, 80);
    const maxOutputTokens = clampNumber(req.body?.max_output_tokens, 60, 6000, 1800);

    if (!input.trim()) {
      return res.status(400).json({ error: 'Eingabetext fehlt.' });
    }

    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model,
        instructions,
        input,
        max_output_tokens: maxOutputTokens
      })
    });

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: data?.error?.message || `OpenAI HTTP ${upstream.status}`
      });
    }

    const text = extractOutputText(data);
    if (!text) {
      return res.status(502).json({ error: 'OpenAI hat keine Textantwort geliefert.' });
    }

    res.json({ text, model });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || String(error) });
  }
});

app.use(requireAuth);
app.use(express.static(path.join(__dirname, 'public')));

app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`KING AI Einkauf läuft lokal auf http://localhost:${PORT}`);
  console.log(`Im Netzwerk erreichbar über http://DEINE-IP:${PORT}`);
  console.log(`Login-Benutzer: ${LOGIN_USERNAME}`);
  console.log(isOpenAIReady() ? 'OpenAI API-Key wurde gefunden.' : 'WARNUNG: OPENAI_API_KEY fehlt in .env.');
  if (SESSION_SECRET === 'dev-secret-bitte-in-env-aendern') {
    console.log('WARNUNG: SESSION_SECRET in .env ändern, bevor andere Personen testen.');
  }
});
