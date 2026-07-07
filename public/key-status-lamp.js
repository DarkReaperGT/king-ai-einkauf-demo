(function () {
  function createLamp() {
    if (document.getElementById("openaiBackendLamp")) return;

    const lamp = document.createElement("div");
    lamp.id = "openaiBackendLamp";
    lamp.innerHTML = `
      <span class="lamp-dot"></span>
      <span class="lamp-text">KI-Backend prüft...</span>
    `;

    const style = document.createElement("style");
    style.textContent = `
      #openaiBackendLamp {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 13px;
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.92);
        color: #fff;
        font: 700 12px/1.2 Inter, Arial, sans-serif;
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.28);
      }

      #openaiBackendLamp .lamp-dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: #f59e0b;
        box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.18);
      }

      #openaiBackendLamp.ok .lamp-dot {
        background: #22c55e;
        box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.18);
      }

      #openaiBackendLamp.fail .lamp-dot {
        background: #ef4444;
        box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.18);
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(lamp);
  }

  async function checkBackend() {
    createLamp();

    const lamp = document.getElementById("openaiBackendLamp");
    const text = lamp.querySelector(".lamp-text");

    try {
      const response = await fetch("/api/health", {
        credentials: "same-origin"
      });

      const data = await response.json();

      if (response.ok && data.openaiReady) {
        lamp.className = "ok";
        text.textContent = `KI-Backend aktiv · ${data.model || "Modell"}`;
      } else {
        lamp.className = "fail";
        text.textContent = "OpenAI-Key fehlt";
      }
    } catch (error) {
      lamp.className = "fail";
      text.textContent = "Backend nicht erreichbar";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    checkBackend();
    setInterval(checkBackend, 30000);
  });
})();
