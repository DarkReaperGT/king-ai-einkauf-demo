require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-5.5';
const API_KEY = process.env.OPENAI_API_KEY || '';

const DATA_DIR = path.join(__dirname, 'data');
const MEMORY_FILE = path.join(DATA_DIR, 'training-memory.json');
const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback.jsonl');

app.set('trust proxy', 1);
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: false, limit: '128kb' }));

function isOpenAIReady() {
  return Boolean(API_KEY && API_KEY.length > 20);
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function cleanText(value, maxChars = 10000) {
  const text = typeof value === 'string' ? value : String(value || '');
  const normalized = text.replace(/\u0000/g, '').trim();

  if (normalized.length <= maxChars) return normalized;
  return normalized.slice(0, maxChars) + '\n[Text serverseitig gekürzt]';
}

function cleanSmall(value, maxChars = 400) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, maxChars);
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

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const raw = String(value)
    .replace(/\s/g, '')
    .replace(/€/g, '')
    .replace(/EUR/gi, '')
    .replace(/[^\d.,-]/g, '');

  if (!raw) return null;

  let normalized = raw;
  if (raw.includes(',') && raw.includes('.')) {
    normalized = raw.replace(/\./g, '').replace(',', '.');
  } else if (raw.includes(',')) {
    normalized = raw.replace(',', '.');
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function toBooleanOrNull(value) {
  if (value === true || value === false) return value;
  if (value === null || value === undefined || value === '') return null;

  const v = String(value).toLowerCase().trim();

  if (['ja', 'yes', 'true', '1', 'vorhanden', 'inklusive', 'enthalten', 'included'].includes(v)) return true;
  if (['nein', 'no', 'false', '0', 'nicht vorhanden', 'nicht enthalten', 'excluded'].includes(v)) return false;

  return null;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(MEMORY_FILE)) {
    const initialMemory = {
      supplierRejectWords: [
        'mittel', 'gesamt', 'summe', 'preis', 'kosten', 'lieferzeit', 'garantie',
        'wartung', 'remote', 'schulung', 'angebot', 'angebote', 'lieferant',
        'lieferanten', 'bewertung', 'score', 'rang', 'ranking', 'ja', 'nein',
        'x', 'ok', 'n/a', 'keine daten', 'nicht erkannt', 'budget', 'gesamtpreis'
      ],
      supplierCompanyHints: [
        'gmbh', 'ag', 'kg', 'ohg', 'ug', 'bau', 'hallenbau', 'stahlbau',
        'modul', 'technik', 'system', 'systems', 'solutions', 'partner',
        'group', 'citybau', 'krantec', 'nordhall', 'massiv', 'industriebau',
        'office', 'beta'
      ],
      notes: [
        'Keine Zahlen als Lieferanten akzeptieren.',
        'Keine Tabellenüberschriften als Lieferanten akzeptieren.',
        'Keine Bewertungsbegriffe wie Mittel, Gesamt, Preis oder Lieferzeit als Lieferant akzeptieren.',
        'Lastenheftanforderungen kurz und einzeln extrahieren.',
        'Keine ganzen Seiten als eine Anforderung übernehmen.',
        'Inhaltsverzeichnisse, Seitenzahlen und Projektfließtexte nicht als R-Kriterien übernehmen.'
      ]
    };

    fs.writeFileSync(MEMORY_FILE, JSON.stringify(initialMemory, null, 2), 'utf8');
  }
}

function readTrainingMemory() {
  ensureDataDir();

  try {
    return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
  } catch {
    return { supplierRejectWords: [], supplierCompanyHints: [], notes: [] };
  }
}

function appendFeedback(entry) {
  ensureDataDir();

  const record = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...entry
  };

  fs.appendFileSync(FEEDBACK_FILE, JSON.stringify(record) + '\n', 'utf8');
  return record;
}

function normalizePriority(value) {
  const v = String(value || '').toLowerCase().trim();

  if (['must', 'muss', 'mandatory', 'pflicht', 'zwingend'].includes(v)) return 'must';
  if (['should', 'soll', 'preferred', 'bevorzugt'].includes(v)) return 'should';
  if (['can', 'kann', 'optional', 'option'].includes(v)) return 'can';

  return 'should';
}

function cleanRequirementText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/seite\s+\d+/gi, '')
    .replace(/inhaltsübersicht/gi, '')
    .replace(/inhaltsverzeichnis/gi, '')
    .trim()
    .slice(0, 700);
}

function normalizeRequirements(requirements) {
  if (!Array.isArray(requirements)) return [];

  return requirements
    .map((r, index) => {
      const description = cleanRequirementText(r?.description);

      return {
        id: cleanSmall(r?.id || `R${String(index + 1).padStart(2, '0')}`, 30),
        priority: normalizePriority(r?.priority),
        category: cleanSmall(r?.category || 'Allgemein', 80),
        description,
        evidence: cleanSmall(r?.evidence, 500)
      };
    })
    .filter((r) => {
      if (!r.description || r.description.length < 12) return false;

      const lower = r.description.toLowerCase();

      if (lower.includes('inhaltsverzeichnis')) return false;
      if (lower.includes('inhaltsübersicht')) return false;
      if (r.description.length > 650 && lower.includes('projektsteckbrief')) return false;
      if (r.description.length > 650 && lower.includes('ausgangssituation')) return false;
      if (r.description.length > 650 && lower.includes('leistungsumfang')) return false;

      return true;
    })
    .slice(0, 100);
}

function isValidSupplierName(name) {
  if (!name) return false;

  const memory = readTrainingMemory();
  const value = String(name).trim();
  const lower = value.toLowerCase();

  if (value.length < 3) return false;
  if (value.length > 100) return false;
  if (/^[\d\s.,€%/-]+$/.test(value)) return false;
  if (!/[a-zA-ZäöüÄÖÜß]/.test(value)) return false;

  const normalized = lower
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (memory.supplierRejectWords.some((word) => normalized === word)) return false;
  if (memory.supplierRejectWords.some((word) => normalized.startsWith(word + ' '))) return false;

  const hasCompanyHint = memory.supplierCompanyHints.some((hint) => lower.includes(hint));
  const looksLikeCompany = hasCompanyHint || /\b(gmbh|ag|kg|ohg|ug|bau|hallenbau|stahlbau|partner|systems|solutions|industriebau)\b/i.test(value);

  return looksLikeCompany;
}

function normalizeOffers(offers) {
  if (!Array.isArray(offers)) return [];

  const seen = new Set();
  const cleaned = [];

  for (const offer of offers) {
    const supplier = cleanSmall(offer?.supplier, 100);
    if (!isValidSupplierName(supplier)) continue;

    const key = supplier.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    cleaned.push({
      supplier,
      good: cleanSmall(offer?.good, 200) || null,
      price: toNumberOrNull(offer?.price),
      deliveryWeeks: toNumberOrNull(offer?.deliveryWeeks),
      warrantyMonths: toNumberOrNull(offer?.warrantyMonths),
      maintenance: toBooleanOrNull(offer?.maintenance),
      remote: toBooleanOrNull(offer?.remote),
      training: toBooleanOrNull(offer?.training),
      technicalNotes: Array.isArray(offer?.technicalNotes)
        ? offer.technicalNotes.slice(0, 16).map((x) => cleanSmall(x, 300)).filter(Boolean)
        : [],
      missingData: Array.isArray(offer?.missingData)
        ? offer.missingData.slice(0, 16).map((x) => cleanSmall(x, 200)).filter(Boolean)
        : [],
      source: cleanSmall(offer?.source, 200) || null
    });
  }

  return cleaned.slice(0, 50);
}

async function callOpenAIText({ input, instructions, model = DEFAULT_MODEL, maxOutputTokens = 1800 }) {
  if (!isOpenAIReady()) {
    throw new Error('OPENAI_API_KEY fehlt im Backend.');
  }

  const upstream = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model,
      instructions: cleanText(instructions, 12000),
      input: cleanText(input, 140000),
      max_output_tokens: clampNumber(maxOutputTokens, 60, 6000, 1800)
    })
  });

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    throw new Error(data?.error?.message || `OpenAI HTTP ${upstream.status}`);
  }

  const text = extractOutputText(data);
  if (!text) throw new Error('OpenAI hat keine Textantwort geliefert.');

  return text;
}

async function callOpenAIJson({ input, instructions, schema, maxOutputTokens = 3000 }) {
  if (!isOpenAIReady()) {
    throw new Error('OPENAI_API_KEY fehlt im Backend.');
  }

  const upstream = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      instructions: cleanText(instructions, 12000),
      input: cleanText(input, 140000),
      max_output_tokens: clampNumber(maxOutputTokens, 300, 6000, 3000),
      text: {
        format: {
          type: 'json_schema',
          name: schema.name,
          strict: true,
          schema: schema.schema
        }
      }
    })
  });

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    throw new Error(data?.error?.message || `OpenAI HTTP ${upstream.status}`);
  }

  const text = extractOutputText(data);
  if (!text) throw new Error('OpenAI hat kein JSON geliefert.');

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('OpenAI-Antwort konnte nicht als JSON gelesen werden.');
  }
}

const requirementSchema = {
  name: 'requirements_analysis',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['project', 'requirements'],
    properties: {
      project: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'good', 'budget', 'maxWeeks'],
        properties: {
          name: { type: ['string', 'null'] },
          good: { type: ['string', 'null'] },
          budget: { type: ['number', 'null'] },
          maxWeeks: { type: ['number', 'null'] }
        }
      },
      requirements: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'priority', 'category', 'description', 'evidence'],
          properties: {
            id: { type: 'string' },
            priority: { type: 'string', enum: ['must', 'should', 'can'] },
            category: { type: 'string' },
            description: { type: 'string' },
            evidence: { type: 'string' }
          }
        }
      }
    }
  }
};

const offersSchema = {
  name: 'offers_analysis',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['offers'],
    properties: {
      offers: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'supplier', 'good', 'price', 'deliveryWeeks', 'warrantyMonths',
            'maintenance', 'remote', 'training', 'technicalNotes', 'missingData', 'source'
          ],
          properties: {
            supplier: { type: 'string' },
            good: { type: ['string', 'null'] },
            price: { type: ['number', 'null'] },
            deliveryWeeks: { type: ['number', 'null'] },
            warrantyMonths: { type: ['number', 'null'] },
            maintenance: { type: ['boolean', 'null'] },
            remote: { type: ['boolean', 'null'] },
            training: { type: ['boolean', 'null'] },
            technicalNotes: { type: 'array', items: { type: 'string' } },
            missingData: { type: 'array', items: { type: 'string' } },
            source: { type: ['string', 'null'] }
          }
        }
      }
    }
  }
};

const compareSchema = {
  name: 'comparison_analysis',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['ranking', 'fulfilled', 'criticalGaps', 'recommendation'],
    properties: {
      ranking: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['supplier', 'score', 'mustRate', 'shouldRate', 'priceScore', 'status', 'reason'],
          properties: {
            supplier: { type: 'string' },
            score: { type: 'number' },
            mustRate: { type: 'number' },
            shouldRate: { type: 'number' },
            priceScore: { type: 'number' },
            status: { type: 'string' },
            reason: { type: 'string' }
          }
        }
      },
      fulfilled: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['supplier', 'requirementId', 'description', 'evidence'],
          properties: {
            supplier: { type: 'string' },
            requirementId: { type: 'string' },
            description: { type: 'string' },
            evidence: { type: 'string' }
          }
        }
      },
      criticalGaps: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['supplier', 'requirementId', 'description', 'evidence'],
          properties: {
            supplier: { type: 'string' },
            requirementId: { type: 'string' },
            description: { type: 'string' },
            evidence: { type: 'string' }
          }
        }
      },
      recommendation: {
        type: 'object',
        additionalProperties: false,
        required: ['supplier', 'decision', 'reasoning', 'nextSteps'],
        properties: {
          supplier: { type: ['string', 'null'] },
          decision: { type: 'string' },
          reasoning: { type: 'string' },
          nextSteps: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }
};

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    openaiReady: isOpenAIReady(),
    model: DEFAULT_MODEL,
    backendOnly: true
  });
});

app.post('/api/openai', async (req, res) => {
  try {
    const input = cleanText(req.body?.input, 140000);
    const instructions = cleanText(
      req.body?.instructions || 'Du bist ein präziser Assistent für Einkauf, Lastenheftanalyse und Angebotsvergleich.',
      12000
    );
    const model = cleanSmall(req.body?.model || DEFAULT_MODEL, 80);
    const maxOutputTokens = clampNumber(req.body?.max_output_tokens ?? req.body?.maxOutputTokens, 60, 6000, 1800);

    if (!input.trim()) {
      return res.status(400).json({ error: 'Eingabetext fehlt.' });
    }

    const text = await callOpenAIText({ input, instructions, model, maxOutputTokens });
    return res.json({ text, model });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || String(error) });
  }
});

app.post('/api/analyze/requirements', async (req, res) => {
  try {
    const memory = readTrainingMemory();
    const text = cleanText(req.body?.text || req.body?.input || '', 140000);

    if (!text.trim()) {
      return res.status(400).json({ error: 'Lastenhefttext fehlt.' });
    }

    const result = await callOpenAIJson({
      input: text,
      maxOutputTokens: 5000,
      instructions: `
Du bist ein Einkaufsanalyst für Investitionsgüter.
Extrahiere ausschließlich konkrete, prüfbare Anforderungen aus dem Lastenheft.
Ignoriere Inhaltsverzeichnis, Seitenzahlen, Deckblatt, allgemeine Einleitung und reine Projektbeschreibung.
Übernimm niemals ganze Seiten als eine Anforderung.
Jede Anforderung muss kurz, einzeln und prüfbar sein.
Wenn R01, R02, R03 usw. vorhanden sind, nutze diese IDs.
Wenn keine saubere ID vorhanden ist, nummeriere selbst mit R01, R02, R03.
Muss = zwingend / mindestens / erforderlich / Nachweis / einzuhalten.
Soll = gewünscht / bevorzugt / sollte.
Kann = optional / als Option / möglich.
Erzeuge keine künstlichen Anforderungen.
Verwende Deutsch.
Hinweise aus Memory:
${memory.notes.map((n) => `- ${n}`).join('\n')}
`,
      schema: requirementSchema
    });

    result.requirements = normalizeRequirements(result.requirements);
    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || String(error) });
  }
});

app.post('/api/analyze/offers', async (req, res) => {
  try {
    const memory = readTrainingMemory();
    const text = cleanText(req.body?.text || req.body?.input || '', 140000);

    if (!text.trim()) {
      return res.status(400).json({ error: 'Angebotstext fehlt.' });
    }

    const result = await callOpenAIJson({
      input: text,
      maxOutputTokens: 5000,
      instructions: `
Du bist ein Einkaufsanalyst für Lieferantenangebote.
Extrahiere ausschließlich echte Anbieter/Lieferanten und deren Angebotsdaten.
Keine Zahlen als Lieferanten.
Keine Wörter wie Mittel, Preis, Summe, Gesamt, Lieferzeit, Garantie, Score als Lieferanten.
Ein Lieferant muss wie ein Firmenname aussehen.
Wenn ein Feld fehlt, nutze null.
Keine Daten erfinden.
Falls eine Excel-Tabelle mehrere Zeilen enthält: nur echte Anbieterzeilen verwenden.
Verwende Deutsch.
Bekannte Ausschlusswörter:
${memory.supplierRejectWords.join(', ')}
Typische Firmenhinweise:
${memory.supplierCompanyHints.join(', ')}
`,
      schema: offersSchema
    });

    result.offers = normalizeOffers(result.offers);
    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || String(error) });
  }
});

app.post('/api/analyze/compare', async (req, res) => {
  try {
    const requirements = normalizeRequirements(req.body?.requirements || []);
    const offers = normalizeOffers(req.body?.offers || []);

    if (!requirements.length) {
      return res.status(400).json({ error: 'Keine gültigen Anforderungen vorhanden.' });
    }

    if (!offers.length) {
      return res.status(400).json({ error: 'Keine gültigen Lieferantenangebote vorhanden.' });
    }

    const result = await callOpenAIJson({
      input: JSON.stringify({ requirements, offers }, null, 2),
      maxOutputTokens: 5500,
      instructions: `
Du bist ein Einkaufsanalyst.
Vergleiche gültige Lieferantenangebote gegen ein Lastenheft.
Muss-Kriterien sind kritisch.
Nicht erfüllte Muss-Kriterien führen zu deutlichem Score-Abzug.
Bewerte nur echte Lieferanten.
Nutze keine Zahlen oder Tabellenbegriffe als Anbieter.
Keine Daten erfinden.
Fehlende Daten als Risiko bewerten.
Erstelle eine klare Empfehlung mit Begründung.
Verwende Deutsch.
`,
      schema: compareSchema
    });

    result.ranking = Array.isArray(result.ranking)
      ? result.ranking.filter((r) => isValidSupplierName(r.supplier))
      : [];

    result.fulfilled = Array.isArray(result.fulfilled)
      ? result.fulfilled.filter((x) => isValidSupplierName(x.supplier))
      : [];

    result.criticalGaps = Array.isArray(result.criticalGaps)
      ? result.criticalGaps.filter((x) => isValidSupplierName(x.supplier))
      : [];

    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || String(error) });
  }
});

app.get('/api/memory', (_req, res) => {
  res.json(readTrainingMemory());
});

app.post('/api/feedback', (req, res) => {
  try {
    const saved = appendFeedback({
      type: cleanSmall(req.body?.type || 'general', 80),
      wrongValue: cleanSmall(req.body?.wrongValue, 300),
      correctValue: cleanSmall(req.body?.correctValue, 300),
      note: cleanSmall(req.body?.note, 800),
      context: cleanText(req.body?.context || '', 4000)
    });

    return res.json({ ok: true, feedback: saved });
  } catch (error) {
    return res.status(500).json({ error: error.message || String(error) });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, HOST, () => {
  ensureDataDir();

  console.log(`KING AI Einkauf läuft lokal auf http://localhost:${PORT}`);
  console.log(`Im Netzwerk erreichbar über http://DEINE-IP:${PORT}`);
  console.log(isOpenAIReady() ? 'OpenAI API-Key wurde gefunden.' : 'WARNUNG: OPENAI_API_KEY fehlt in .env.');
  console.log(`OpenAI-Modell: ${DEFAULT_MODEL}`);
  console.log('Backend-only OpenAI: aktiv');
});