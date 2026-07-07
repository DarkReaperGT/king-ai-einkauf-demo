(function () {
  window.getOpenAIConfig = function () {
    return {
      apiKey: "",
      model: "server",
      hasKey: true,
      useExtraction: true,
      useChat: true
    };
  };

  window.updateOpenAIStatus = function () {};

  window.callOpenAI = async function (inputText, cfg, instructions, maxOutputTokens = 1800) {
    const response = await fetch("/api/openai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify({
        input: inputText,
        instructions: instructions || "Du bist ein präziser Assistent für Einkauf, Lastenheftanalyse und Angebotsvergleich.",
        maxOutputTokens: maxOutputTokens
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || data.message || "OpenAI-Backendfehler");
    }

    return data.text || data.output_text || data.result || "";
  };
})();
