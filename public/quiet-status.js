(function () {
  const silentPatterns = [
    /datei\(en\).*eingelesen/i,
    /du kannst weitere einzelne dateien hinzufügen/i,
    /analyse läuft/i,
    /parserdaten werden ausgewertet/i,
    /lokaler extraktionslogik/i,
    /teilanalyse abgeschlossen/i,
    /datei entfernt/i,
    /starte die analyse erneut/i,
    /analyse gestartet/i,
    /daten werden verarbeitet/i
  ];

  const importantPatterns = [
    /fehler/i,
    /error/i,
    /nicht erkannt/i,
    /keine strukturierten angebotsdaten/i,
    /openai/i,
    /backend/i,
    /nicht angemeldet/i,
    /konnte nicht/i
  ];

  function isSilentSystemMessage(text) {
    const value = String(text || '').trim();

    if (!value) return false;

    const isImportant = importantPatterns.some((pattern) => pattern.test(value));
    if (isImportant) return false;

    return silentPatterns.some((pattern) => pattern.test(value));
  }

  function cleanupChatMessages() {
    document.querySelectorAll('.msg, .message, .chat-message, .chat-bubble').forEach((el) => {
      const text = el.innerText || el.textContent || '';
      if (isSilentSystemMessage(text)) {
        el.remove();
      }
    });
  }

  const observer = new MutationObserver(() => {
    cleanupChatMessages();
  });

  document.addEventListener('DOMContentLoaded', () => {
    cleanupChatMessages();

    const target =
      document.getElementById('chatMessages') ||
      document.querySelector('.chat-messages') ||
      document.body;

    observer.observe(target, {
      childList: true,
      subtree: true
    });
  });

  window.KING_AI_shouldHideSystemMessage = isSilentSystemMessage;
})();
