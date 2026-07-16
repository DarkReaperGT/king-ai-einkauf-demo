(function () {
  "use strict";

  const MAX_REQUIREMENT_LENGTH = 260;

  function text(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function mapPriority(priority) {
    const value = text(priority).toLowerCase();
    if (value === "must" || value === "muss" || value === "pflicht" || value === "zwingend") return "Muss";
    if (value === "should" || value === "soll" || value === "bevorzugt") return "Soll";
    if (value === "can" || value === "kann" || value === "optional" || value === "option") return "Kann";
    return "Soll";
  }

  function cleanRequirementDescription(value) {
    let result = text(value);

    // Falls OpenAI oder ein Parser versehentlich zu viel Text liefert, hart begrenzen.
    if (result.length > MAX_REQUIREMENT_LENGTH) {
      result = result.slice(0, MAX_REQUIREMENT_LENGTH).replace(/[,;:\s]+$/g, "") + " …";
    }

    return result;
  }

  function isBadRequirement(r) {
    const description = text(r && r.description).toLowerCase();
    if (!description || description.length < 10) return true;

    const badSignals = [
      "inhaltsverzeichnis",
      "inhaltsübersicht",
      "dokumentenstatus",
      "vertraulichkeit",
      "freigabe",
      "anlagen",
      "dieses dokument ist ein professionell realistisch",
      "ausschreibungsgrundlage datum"
    ];

    return badSignals.some((signal) => description.includes(signal)) && description.length > 120;
  }

  function mapRequirement(r, index) {
    const priority = mapPriority(r && r.priority);

    return {
      id: text((r && r.id) || `R${String(index + 1).padStart(2, "0")}`),
      priority,
      category: text((r && r.category) || "Allgemein"),
      description: cleanRequirementDescription(r && r.description),
      weight: priority === "Muss" ? 3 : priority === "Soll" ? 2 : 1
    };
  }

  function mapOffer(o) {
    return {
      supplier: text(o && o.supplier),
      good: text((o && o.good) || "Nicht eindeutig erkannt"),
      price: Number.isFinite(Number(o && o.price)) ? Number(o.price) : null,
      delivery: Number.isFinite(Number(o && (o.deliveryWeeks ?? o.delivery))) ? Number(o.deliveryWeeks ?? o.delivery) : null,
      warranty: Number.isFinite(Number(o && (o.warrantyMonths ?? o.warranty))) ? Number(o.warrantyMonths ?? o.warranty) : null,
      load: Number.isFinite(Number(o && o.load)) ? Number(o.load) : null,
      span: Number.isFinite(Number(o && o.span)) ? Number(o.span) : null,
      ce: o && o.ce !== undefined ? o.ce : null,
      documentationGerman: o && o.documentationGerman !== undefined ? o.documentationGerman : null,
      mounting: o && o.mounting !== undefined ? o.mounting : null,
      commissioning: o && o.commissioning !== undefined ? o.commissioning : null,
      maintenance: o && o.maintenance !== undefined ? o.maintenance : null,
      energy: o && o.energy !== undefined ? o.energy : null,
      remote: o && o.remote !== undefined ? o.remote : null,
      training: o && o.training !== undefined ? o.training : null,
      source: text((o && o.source) || "Backend-OpenAI-Analyse")
    };
  }

  async function postJson(url, body) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || data.message || `HTTP ${response.status}`);
    }

    return data;
  }

  async function ensureBackendReady() {
    const health = await fetch("/api/health", { credentials: "same-origin" })
      .then((r) => r.json())
      .catch(() => null);

    if (!health || health.ok !== true) {
      throw new Error("Backend ist nicht erreichbar oder die Session ist abgelaufen.");
    }

    if (health.openaiReady !== true) {
      throw new Error("OPENAI_API_KEY ist im Backend nicht aktiv. Prüfe .env oder Render Environment Variables.");
    }
  }

  function combineRequirementText() {
    return (state.requirementFiles || [])
      .map((f) => f && f.content)
      .filter(Boolean)
      .join("\n\n");
  }

  function combineOfferText() {
    return (state.offerFiles || [])
      .filter((f) => f && (f.parserStatus === "parsed" || f.parserStatus === "warning" || f.content))
      .map((f, i) => `--- ANGEBOT ${i + 1}: ${f.name || "Datei"} ---\n${f.content || ""}`)
      .join("\n\n");
  }

  function setAnalyzedState() {
    state.analyzed = Boolean((state.requirements || []).length || (state.offers || []).length);
  }

  function renderAndNavigate() {
    renderAll();

    if ((state.comparison || []).length) {
      showSection("vergleich");
      return;
    }

    if ((state.requirements || []).length) {
      showSection("lastenheft");
      return;
    }

    if ((state.offers || []).length) {
      showSection("angebote");
      return;
    }

    showSection("upload");
  }

  const MAX_AI_VERDICT_PAIRS = 80;

  function truncate(text, maxLen) {
    const value = String(text || "");
    return value.length > maxLen ? value.slice(0, maxLen) + "\n[...gekürzt...]" : value;
  }

  function stripJsonFence(raw) {
    return String(raw || "")
      .trim()
      .replace(/^```json/i, "")
      .replace(/^```/, "")
      .replace(/```$/, "")
      .trim();
  }

  // Fragt die KI gezielt nur für die Kriterien, die die lokale Stichwort-Prüfung
  // NICHT automatisiert zuordnen konnte (check.checked === false). So bleiben
  // eindeutige, exakt prüfbare Sachen (Preis, Lieferzeit, Garantie...) schnell und
  // kostenlos lokal, und nur der unklare Rest (z.B. Hallenfläche, Baugenehmigung,
  // Statik) geht an die KI. Ergebnis wird direkt in state.comparison[].checks gemerged
  // und Score/Empfehlung je Angebot neu berechnet.
  async function enrichChecksWithAiVerdicts(requirements, comparison, reqRawText, offerRawText) {
    const pending = [];
    for (const entry of comparison) {
      for (const check of entry.checks) {
        if (!check.checked && pending.length < MAX_AI_VERDICT_PAIRS) {
          pending.push({ requirementId: check.id, priority: check.priority, description: check.description, supplier: entry.offer.supplier });
        }
      }
    }

    if (!pending.length) return { attempted: false, updated: 0 };

    const pairsList = pending
      .map((p) => `- ${p.requirementId} (${p.priority}) für Lieferant "${p.supplier}": ${p.description}`)
      .join("\n");

    const instructions =
      "Du bist ein präziser Prüf-Assistent für Einkauf und Vergabe. Du bekommst Anforderungen aus einem Lastenheft " +
      "und Rohtext von Lieferantenangeboten. Prüfe für jede genannte Kombination aus Anforderung und Lieferant, ob " +
      "der Angebotstext belegt, dass die Anforderung erfüllt ist. Antworte AUSSCHLIESSLICH mit einem JSON-Array, ohne " +
      "Erklärtext, ohne Markdown-Codeblock. Format genau so: " +
      '[{"requirementId":"R01","supplier":"Firma X","fulfilled":true,"evidence":"kurzer Grund, max. 20 Woerter"}]. ' +
      'Wenn der Angebotstext dazu gar nichts hergibt, setze "fulfilled": null und begruende kurz, warum eine manuelle Pruefung noetig ist.';

    const input =
      `LASTENHEFT (Auszug):\n${truncate(reqRawText, 6000)}\n\n` +
      `ANGEBOTE (Rohtext, kann mehrere Lieferanten enthalten):\n${truncate(offerRawText, 8000)}\n\n` +
      `ZU PRÜFENDE KOMBINATIONEN:\n${pairsList}`;

    let raw;
    try {
      raw = await window.callOpenAI(input, {}, instructions, 3000);
    } catch (error) {
      console.warn("KI-Zweitprüfung fehlgeschlagen, Kriterien bleiben auf 'manuell prüfen':", error);
      return { attempted: true, updated: 0, error: error.message || String(error) };
    }

    let verdicts;
    try {
      verdicts = JSON.parse(stripJsonFence(raw));
      if (!Array.isArray(verdicts)) throw new Error("Antwort war kein JSON-Array.");
    } catch (error) {
      console.warn("KI-Antwort der Zweitprüfung konnte nicht als JSON gelesen werden:", raw);
      return { attempted: true, updated: 0, error: "Antwort nicht als JSON lesbar" };
    }

    let updated = 0;
    for (const entry of comparison) {
      let touched = false;
      for (const check of entry.checks) {
        if (check.checked) continue;
        const verdict = verdicts.find(
          (v) => v && String(v.requirementId).trim() === check.id && sameSupplier(v.supplier, entry.offer.supplier)
        );
        if (!verdict || verdict.fulfilled === null || verdict.fulfilled === undefined) continue;
        check.checked = true;
        check.fulfilled = verdict.fulfilled === true;
        check.evidence = `KI-Einschätzung: ${text(verdict.evidence) || (check.fulfilled ? "erfüllt laut Angebotstext" : "nicht erfüllt laut Angebotstext")}`;
        touched = true;
        updated++;
      }
      if (touched) {
        const must = entry.checks.filter((c) => c.priority === "Muss");
        const soll = entry.checks.filter((c) => c.priority === "Soll");
        const kann = entry.checks.filter((c) => c.priority === "Kann");
        entry.mustRate = rate(must);
        entry.sollRate = rate(soll);
        entry.kannRate = rate(kann);
        const mustFailed = must.some((c) => c.checked && !c.fulfilled);
        const mustUnchecked = must.length > 0 && entry.mustRate === null;
        let score = Math.round(
          (entry.mustRate ?? 100) * 0.45 +
            (entry.sollRate ?? 100) * 0.18 +
            entry.priceScore * 0.16 +
            entry.deliveryScore * 0.08 +
            entry.serviceScore * 0.08 +
            entry.dataCompleteness * 0.05
        );
        if (mustFailed) score = Math.min(score, 49);
        if (entry.dataCompleteness < 35) score = Math.min(score, 55);
        let recommendation = "Nachrangige Option";
        if (mustFailed) recommendation = "Ausgeschlossen / Muss-Abweichung";
        else if (entry.dataCompleteness < 35) recommendation = "Nicht prüfbar / Daten fehlen";
        else if (mustUnchecked) recommendation = "Manuelle Prüfung der Muss-Kriterien erforderlich";
        else if (score >= 85 && entry.mustRate === 100) recommendation = "Bevorzugte Empfehlung";
        else if (score >= 72 && entry.mustRate === 100) recommendation = "Verhandelbare Alternative";
        entry.score = score;
        entry.recommendation = recommendation;
      }
    }

    return { attempted: true, updated };
  }

  window.runAnalysis = async function () {
    try {
      resetAnalysisState();

      if (!state.requirementFiles.length && !state.offerFiles.length) {
        renderAll();
        showSection("upload");
        addSystemChat("Fehler: Keine Dateien vorhanden. Bitte zuerst Lastenheft- und Angebotsdateien laden.");
        return;
      }

      await ensureBackendReady();

      const reqText = combineRequirementText();
      const offerText = combineOfferText();

      state.aiMode = "backend-openai";
      state.aiLastError = null;

      if (reqText.trim()) {
        const reqResult = await postJson("/api/analyze/requirements", { text: reqText });

        state.project = reqResult.project || {};
        state.requirements = Array.isArray(reqResult.requirements)
          ? reqResult.requirements
              .filter((r) => !isBadRequirement(r))
              .map(mapRequirement)
              .filter((r) => r.description)
          : [];
      }

      if (offerText.trim()) {
        const offerResult = await postJson("/api/analyze/offers", { text: offerText });

        state.offers = Array.isArray(offerResult.offers)
          ? offerResult.offers
              .map(mapOffer)
              .filter((o) => o.supplier && !/^\d+$/.test(o.supplier))
          : [];
      }

      if (state.requirements.length && state.offers.length) {
        // Die vorhandene Oberfläche erwartet die alte interne Comparison-Struktur.
        // Deshalb wird nur die Extraktion serverseitig gemacht, der vorhandene Renderer bleibt kompatibel.
        state.comparison = compareOffers(state.offers, state.requirements, state.project)
          .sort(compareDecisionResults);

        // Zweite Runde: Kriterien, die lokal nicht automatisiert zugeordnet werden konnten
        // (z.B. Hallenfläche, Baugenehmigung, Statik...), gezielt von der KI beurteilen lassen.
        const aiVerdictResult = await enrichChecksWithAiVerdicts(
          state.requirements,
          state.comparison,
          reqText,
          offerText
        );
        if (aiVerdictResult.attempted && aiVerdictResult.updated > 0) {
          state.comparison.sort(compareDecisionResults);
        }
        if (aiVerdictResult.attempted && aiVerdictResult.error) {
          addSystemChat(
            "Hinweis: Die KI-gestützte Zweitprüfung einiger Muss-/Soll-Kriterien ist fehlgeschlagen (" +
              aiVerdictResult.error +
              "). Diese Kriterien bleiben als 'manuell prüfen' markiert."
          );
        }

        state.bestOffer = chooseBestOffer(state.comparison);
      } else {
        state.comparison = [];
        state.bestOffer = null;
      }

      setAnalyzedState();
      renderAndNavigate();

      if (!state.requirements.length && reqText.trim()) {
        addSystemChat("Fehler: Das Backend konnte keine sauberen Lastenheft-Anforderungen extrahieren.");
      }

      if (!state.offers.length && offerText.trim()) {
        addSystemChat("Fehler: Das Backend konnte keine gültigen Lieferantenangebote extrahieren.");
      }
    } catch (error) {
      console.error(error);
      state.aiLastError = error.message || String(error);
      state.aiMode = "backend-error";
      renderAll();
      showSection("upload");
      addSystemChat("Fehler: Backend-OpenAI-Analyse fehlgeschlagen: " + state.aiLastError);
    }
  };

  console.info("KING AI: Backend-Analyse-Bridge aktiv. runAnalysis nutzt /api/analyze/*.");
})();