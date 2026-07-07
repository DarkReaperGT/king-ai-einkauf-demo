(function () {
  function removeOpenAICard() {
    document.querySelectorAll('.card').forEach((card) => {
      const text = card.innerText || '';
      if (
        text.includes('OpenAI API') ||
        text.includes('API-Key') ||
        text.includes('Verbindung testen') ||
        card.querySelector('#openaiApiKey') ||
        card.querySelector('.api-panel')
      ) {
        card.remove();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', removeOpenAICard);
  setTimeout(removeOpenAICard, 300);
  setTimeout(removeOpenAICard, 1000);

  window.getOpenAIConfig = function () {
    return {
      apiKey: '',
      model: 'backend',
      hasKey: true,
      useExtraction: true,
      useChat: true
    };
  };

  window.updateOpenAIStatus = function () {};

  window.testOpenAIConnection = async function () {
    alert('OpenAI läuft über das Backend.');
  };

  window.callOpenAI = async function (inputText, cfg, instructions, maxOutputTokens = 1800) {
    const response = await fetch('/api/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        input: inputText,
        instructions: instructions || 'Du bist ein präziser Assistent für Einkauf, Lastenheftanalyse und Angebotsvergleich.',
        maxOutputTokens,
        max_output_tokens: maxOutputTokens
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || data.message || 'Backend-OpenAI-Fehler');
    }

    return data.text || data.output_text || data.result || '';
  };

  window.analyzeRequirementsBackend = async function (text) {
    const response = await fetch('/api/analyze/requirements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ text })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Lastenheftanalyse fehlgeschlagen');
    return data;
  };

  window.analyzeOffersBackend = async function (text) {
    const response = await fetch('/api/analyze/offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ text })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Angebotsanalyse fehlgeschlagen');
    return data;
  };

  window.compareBackend = async function (requirements, offers) {
    const response = await fetch('/api/analyze/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ requirements, offers })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Vergleichsanalyse fehlgeschlagen');
    return data;
  };
})();
