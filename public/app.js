(() => {
  'use strict';

  const STORAGE_KEY = 'king-ai-einkauf-v2';
  const FILE_LIMIT = 900000;
  const sectionMeta = {
    dashboard: ['Einkaufsplattform', 'Dashboard', 'Zentrale Übersicht für Projekte, Dateien, Analysen und Entscheidungen.'],
    projects: ['Projektverwaltung', 'Projekte', 'Projekte erstellen, auswählen und Projektnamen direkt bearbeiten.'],
    requirements: ['Analysebereich', 'Lastenheftanalyse', 'Dateien aus dem Lastenheft-Ordner analysieren und Anforderungen strukturieren.'],
    offers: ['Analysebereich', 'Angebotsanalyse', 'Dateien aus dem Angebot-Ordner analysieren und Lieferantendaten extrahieren.'],
    comparison: ['Bewertung', 'Vergleich', 'Lastenheftanforderungen und Anbieterangebote nachvollziehbar gegenüberstellen.'],
    decision: ['Entscheidung', 'Entscheidungsanalyse', 'Empfehlung, Risiken und Entscheidungslogik transparent vorbereiten.'],
    chat: ['Projektchat', 'KI-Chat', 'Fragen zum aktiven Projekt stellen und Antworten projektbezogen speichern.'],
    history: ['Dokumentation', 'Verlauf', 'Gespeicherte Chatfragen und KI-Antworten chronologisch je Projekt verwalten.']
  };

  const els = {};
  const state = loadState();

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    cacheEls();
    bindEvents();
    ensureFirstProject();
    renderAll();
    checkBackend();
  }

  function cacheEls() {
    els.sections = [...document.querySelectorAll('.section')];
    els.navButtons = [...document.querySelectorAll('.nav-item')];
    els.sectionEyebrow = document.getElementById('sectionEyebrow');
    els.sectionTitle = document.getElementById('sectionTitle');
    els.sectionDescription = document.getElementById('sectionDescription');
    els.projectSelect = document.getElementById('projectSelect');
    els.newProjectBtn = document.getElementById('newProjectBtn');
    els.sidebarNewProjectBtn = document.getElementById('sidebarNewProjectBtn');
    els.exportBtn = document.getElementById('exportBtn');
    els.backendStatus = document.getElementById('backendStatus');
    els.projectDialog = document.getElementById('projectDialog');
    els.projectForm = document.getElementById('projectForm');
    els.projectNameInput = document.getElementById('projectNameInput');
    els.cancelProjectDialog = document.getElementById('cancelProjectDialog');
    els.toastRegion = document.getElementById('toastRegion');
  }

  function bindEvents() {
    els.navButtons.forEach((button) => {
      button.addEventListener('click', () => showSection(button.dataset.section));
    });

    els.projectSelect.addEventListener('change', () => {
      state.currentProjectId = els.projectSelect.value;
      touchProject(currentProject());
      saveState();
      renderAll();
      toast('Projekt gewechselt.', 'success');
    });

    els.newProjectBtn.addEventListener('click', openProjectDialog);
    els.sidebarNewProjectBtn.addEventListener('click', openProjectDialog);
    els.cancelProjectDialog.addEventListener('click', () => els.projectDialog.close());

    els.projectForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = els.projectNameInput.value.trim();
      if (!name) return;
      createProject(name);
      els.projectDialog.close();
      els.projectForm.reset();
      showSection('projects');
    });

    els.exportBtn.addEventListener('click', exportData);
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (parsed && Array.isArray(parsed.projects)) {
        return {
          projects: parsed.projects,
          currentProjectId: parsed.currentProjectId || parsed.projects[0]?.id || null,
          activeSection: parsed.activeSection || 'dashboard'
        };
      }
    } catch (_) {}

    return { projects: [], currentProjectId: null, activeSection: 'dashboard' };
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function newId(prefix = 'id') {
    if (crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function ensureFirstProject() {
    if (!state.projects.length) {
      const project = buildProject('Erstes Einkaufsprojekt');
      state.projects.push(project);
      state.currentProjectId = project.id;
      saveState();
    }

    if (!state.projects.some((project) => project.id === state.currentProjectId)) {
      state.currentProjectId = state.projects[0]?.id || null;
      saveState();
    }
  }

  function buildProject(name) {
    const now = new Date().toISOString();
    return {
      id: newId('project'),
      name: sanitizeProjectName(name),
      createdAt: now,
      updatedAt: now,
      folders: {
        requirements: [],
        offers: []
      },
      analyses: {
        requirements: null,
        offers: null,
        comparison: null,
        decision: null
      },
      chat: []
    };
  }

  function sanitizeProjectName(name) {
    return String(name || '').replace(/\s+/g, ' ').trim().slice(0, 90) || 'Unbenanntes Projekt';
  }

  function currentProject() {
    return state.projects.find((project) => project.id === state.currentProjectId) || state.projects[0] || null;
  }

  function touchProject(project) {
    if (project) project.updatedAt = new Date().toISOString();
  }

  function createProject(name) {
    const project = buildProject(name);
    state.projects.unshift(project);
    state.currentProjectId = project.id;
    saveState();
    renderAll();
    toast('Projekt erstellt. Lastenheft-Ordner und Angebot-Ordner wurden getrennt angelegt.', 'success');
  }

  function openProjectDialog() {
    els.projectNameInput.value = '';
    els.projectDialog.showModal();
    setTimeout(() => els.projectNameInput.focus(), 40);
  }

  function showSection(section) {
    state.activeSection = section;
    saveState();
    renderShell();
    renderActiveSection();
  }

  function renderAll() {
    renderShell();
    renderActiveSection();
  }

  function renderShell() {
    const meta = sectionMeta[state.activeSection] || sectionMeta.dashboard;
    els.sectionEyebrow.textContent = meta[0];
    els.sectionTitle.textContent = meta[1];
    els.sectionDescription.textContent = meta[2];

    els.navButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.section === state.activeSection);
    });

    els.sections.forEach((section) => {
      section.classList.toggle('active', section.id === state.activeSection);
    });

    renderProjectSelect();
  }

  function renderProjectSelect() {
    els.projectSelect.innerHTML = state.projects.map((project) => {
      return `<option value="${escapeAttr(project.id)}" ${project.id === state.currentProjectId ? 'selected' : ''}>${escapeHtml(project.name)}</option>`;
    }).join('');
  }

  function renderActiveSection() {
    const section = state.activeSection;
    if (section === 'dashboard') return renderDashboard();
    if (section === 'projects') return renderProjects();
    if (section === 'requirements') return renderRequirements();
    if (section === 'offers') return renderOffers();
    if (section === 'comparison') return renderComparison();
    if (section === 'decision') return renderDecision();
    if (section === 'chat') return renderChat();
    if (section === 'history') return renderHistory();
  }

  function renderDashboard() {
    const project = currentProject();
    const totalRequirementFiles = state.projects.reduce((sum, p) => sum + p.folders.requirements.length, 0);
    const totalOfferFiles = state.projects.reduce((sum, p) => sum + p.folders.offers.length, 0);
    const analyzedProjects = state.projects.filter((p) => p.analyses.requirements || p.analyses.offers || p.analyses.comparison || p.analyses.decision).length;
    const recent = [...state.projects].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 5);

    setHTML('dashboard', `
      <div class="grid grid-4 mb">
        ${kpi('Projekte', state.projects.length, 'P')}
        ${kpi('Lastenheft-Dateien', totalRequirementFiles, 'L')}
        ${kpi('Angebotsdateien', totalOfferFiles, 'A')}
        ${kpi('Analysierte Projekte', analyzedProjects, '✓')}
      </div>

      <div class="grid grid-2">
        <article class="card strong">
          <h3>Aktives Projekt</h3>
          ${project ? projectSummaryHTML(project) : emptyHTML('Kein Projekt vorhanden', 'Erstelle ein Projekt, um Dateien hochzuladen und Analysen zu starten.')}
        </article>
        <article class="card strong">
          <h3>Analyseübersicht</h3>
          ${analysisProgressHTML(project)}
        </article>
      </div>

      <div class="grid grid-2 mt">
        <article class="card">
          <h3>Zuletzt bearbeitet</h3>
          <div class="mini-list">
            ${recent.map((p) => `
              <button class="mini-item text-left" data-action="select-project" data-id="${escapeAttr(p.id)}" type="button">
                <strong>${escapeHtml(p.name)}</strong>
                <span class="mini-meta">${formatDate(p.updatedAt)} · ${p.folders.requirements.length} Lastenheft · ${p.folders.offers.length} Angebot</span>
              </button>
            `).join('')}
          </div>
        </article>
        <article class="card">
          <h3>Schnellaktionen</h3>
          <div class="actions">
            <button class="primary" data-action="go" data-target="projects" type="button">Projekt verwalten</button>
            <button class="ghost" data-action="go" data-target="requirements" type="button">Lastenheft hochladen</button>
            <button class="ghost" data-action="go" data-target="offers" type="button">Angebote hochladen</button>
            <button class="secondary" data-action="go" data-target="comparison" type="button">Vergleich öffnen</button>
          </div>
        </article>
      </div>
    `);

    bindActionButtons(document.getElementById('dashboard'));
  }

  function renderProjects() {
    setHTML('projects', `
      <div class="project-title-row">
        <h3>Projekte</h3>
        <button class="icon-btn" id="projectPlusBtn" type="button" title="Neues Projekt erstellen">+</button>
      </div>

      <div class="grid grid-3">
        ${state.projects.map(projectCardHTML).join('')}
      </div>
    `);

    document.getElementById('projectPlusBtn').addEventListener('click', openProjectDialog);

    document.querySelectorAll('[data-action="select-project"]').forEach((button) => {
      button.addEventListener('click', (event) => {
        if (event.target.matches('.project-name')) return;
        state.currentProjectId = button.dataset.id;
        touchProject(currentProject());
        saveState();
        renderAll();
      });
    });

    document.querySelectorAll('.project-name').forEach((input) => {
      input.addEventListener('click', (event) => event.stopPropagation());
      input.addEventListener('change', () => renameProject(input.dataset.id, input.value));
      input.addEventListener('blur', () => renameProject(input.dataset.id, input.value));
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') input.blur();
      });
    });
  }

  function projectCardHTML(project) {
    const active = project.id === state.currentProjectId;
    return `
      <article class="card project-card ${active ? 'active' : ''}" data-action="select-project" data-id="${escapeAttr(project.id)}">
        <input class="project-name" data-id="${escapeAttr(project.id)}" value="${escapeAttr(project.name)}" aria-label="Projektname bearbeiten" />
        <div class="folder-row">
          <div class="folder-box">
            <strong>Lastenheft-Ordner</strong>
            <span>${project.folders.requirements.length} Datei(en), strikt getrennt</span>
          </div>
          <div class="folder-box">
            <strong>Angebot-Ordner</strong>
            <span>${project.folders.offers.length} Datei(en), strikt getrennt</span>
          </div>
        </div>
        <div class="badges">
          ${badge(project.analyses.requirements ? 'Lastenheft analysiert' : 'Lastenheft offen', project.analyses.requirements ? 'green' : 'yellow')}
          ${badge(project.analyses.offers ? 'Angebote analysiert' : 'Angebote offen', project.analyses.offers ? 'green' : 'yellow')}
          ${badge(project.analyses.comparison ? 'Vergleich vorhanden' : 'Vergleich offen', project.analyses.comparison ? 'blue' : '')}
        </div>
        <span class="mini-meta">Bearbeitet: ${formatDate(project.updatedAt)}</span>
      </article>
    `;
  }

  function renameProject(id, value) {
    const project = state.projects.find((p) => p.id === id);
    if (!project) return;
    const nextName = sanitizeProjectName(value);
    if (project.name === nextName) return;
    project.name = nextName;
    touchProject(project);
    saveState();
    renderProjectSelect();
    toast('Projektname gespeichert.', 'success');
  }

  function renderRequirements() {
    const project = currentProject();
    if (!project) return setHTML('requirements', emptyHTML('Kein Projekt vorhanden', 'Erstelle zuerst ein Projekt.'));
    const analysis = project.analyses.requirements;

    setHTML('requirements', `
      <div class="upload-layout">
        <div class="grid">
          <article class="card">
            <h3>Lastenheft-Ordner</h3>
            <p>Dieser Bereich verwendet ausschließlich Dateien aus dem Lastenheft-Ordner des aktiven Projekts.</p>
            <div class="upload-zone">
              <strong>Lastenheft-Dateien hochladen</strong>
              <p class="muted">Geeignet sind lesbare Textdateien, CSV, Markdown, HTML und aus PDF kopierter Text. PDF-Dateien werden im Browser nicht zuverlässig ausgelesen.</p>
              <input id="requirementsUpload" type="file" multiple accept=".txt,.md,.csv,.json,.html,.htm,.xml,.rtf,.pdf" />
            </div>
            <div class="actions mt">
              <button class="primary" id="runRequirementsBtn" type="button" ${project.folders.requirements.length ? '' : 'disabled'}>Lastenheft analysieren</button>
              <button class="danger" data-action="clear-folder" data-folder="requirements" type="button" ${project.folders.requirements.length ? '' : 'disabled'}>Ordner leeren</button>
            </div>
          </article>

          <article class="card">
            <h3>Erkannte Anforderungen</h3>
            ${analysis?.requirements?.length ? requirementsHTML(analysis.requirements) : emptyHTML('Noch keine Lastenheftanalyse', 'Lade Lastenheft-Dateien hoch und starte die Analyse.')}
          </article>
        </div>

        <aside class="card">
          <h3>Dateien im Lastenheft-Ordner</h3>
          ${fileListHTML(project.folders.requirements, 'requirements')}
        </aside>
      </div>
    `);

    document.getElementById('requirementsUpload').addEventListener('change', (event) => handleFiles(event, 'requirements'));
    document.getElementById('runRequirementsBtn')?.addEventListener('click', runRequirementsAnalysis);
    bindFolderActions(document.getElementById('requirements'));
  }

  function renderOffers() {
    const project = currentProject();
    if (!project) return setHTML('offers', emptyHTML('Kein Projekt vorhanden', 'Erstelle zuerst ein Projekt.'));
    const analysis = project.analyses.offers;

    setHTML('offers', `
      <div class="upload-layout">
        <div class="grid">
          <article class="card">
            <h3>Angebot-Ordner</h3>
            <p>Dieser Bereich verwendet ausschließlich Dateien aus dem Angebot-Ordner des aktiven Projekts.</p>
            <div class="upload-zone">
              <strong>Angebotsdateien hochladen</strong>
              <p class="muted">Mehrere Angebote können separat in diesem Ordner abgelegt und gemeinsam analysiert werden.</p>
              <input id="offersUpload" type="file" multiple accept=".txt,.md,.csv,.json,.html,.htm,.xml,.rtf,.pdf" />
            </div>
            <div class="actions mt">
              <button class="primary" id="runOffersBtn" type="button" ${project.folders.offers.length ? '' : 'disabled'}>Angebote analysieren</button>
              <button class="danger" data-action="clear-folder" data-folder="offers" type="button" ${project.folders.offers.length ? '' : 'disabled'}>Ordner leeren</button>
            </div>
          </article>

          <article class="card">
            <h3>Erkannte Angebotsdaten</h3>
            ${analysis?.offers?.length ? offersHTML(analysis.offers) : emptyHTML('Noch keine Angebotsanalyse', 'Lade Angebotsdateien hoch und starte die Analyse.')}
          </article>
        </div>

        <aside class="card">
          <h3>Dateien im Angebot-Ordner</h3>
          ${fileListHTML(project.folders.offers, 'offers')}
        </aside>
      </div>
    `);

    document.getElementById('offersUpload').addEventListener('change', (event) => handleFiles(event, 'offers'));
    document.getElementById('runOffersBtn')?.addEventListener('click', runOffersAnalysis);
    bindFolderActions(document.getElementById('offers'));
  }

  function renderComparison() {
    const project = currentProject();
    if (!project) return setHTML('comparison', emptyHTML('Kein Projekt vorhanden', 'Erstelle zuerst ein Projekt.'));
    const comparison = project.analyses.comparison?.comparison || [];

    setHTML('comparison', `
      <article class="card mb">
        <h3>Vergleich ausführen</h3>
        <p>Der Vergleich verwendet die Lastenheftanalyse und die Angebotsanalyse des aktiven Projekts. Muss-Kriterien werden gesondert geprüft.</p>
        <div class="actions">
          <button class="primary" id="runCompareBtn" type="button" ${canCompare(project) ? '' : 'disabled'}>Lastenheft und Angebote vergleichen</button>
          <button class="ghost" data-action="go" data-target="requirements" type="button">Lastenheftanalyse öffnen</button>
          <button class="ghost" data-action="go" data-target="offers" type="button">Angebotsanalyse öffnen</button>
        </div>
      </article>

      ${comparison.length ? comparisonHTML(comparison) : emptyHTML('Noch kein Vergleich vorhanden', 'Analysiere zuerst Lastenheft und Angebote. Danach kann der Vergleich erstellt werden.')}
    `);

    document.getElementById('runCompareBtn')?.addEventListener('click', runComparison);
    bindActionButtons(document.getElementById('comparison'));
  }

  function renderDecision() {
    const project = currentProject();
    if (!project) return setHTML('decision', emptyHTML('Kein Projekt vorhanden', 'Erstelle zuerst ein Projekt.'));
    const decision = project.analyses.decision;

    setHTML('decision', `
      <article class="card mb">
        <h3>Entscheidungsanalyse erstellen</h3>
        <p>Die Entscheidung basiert auf Lastenheftanalyse, Angebotsanalyse und Vergleich. Anbieter mit nicht belegten wichtigen Muss-Kriterien werden nicht empfohlen.</p>
        <div class="actions">
          <button class="primary" id="runDecisionBtn" type="button" ${project.analyses.comparison?.comparison?.length ? '' : 'disabled'}>Entscheidungsanalyse erstellen</button>
          <button class="ghost" data-action="go" data-target="comparison" type="button">Vergleich öffnen</button>
        </div>
      </article>
      ${decision ? decisionHTML(decision) : emptyHTML('Noch keine Entscheidungsanalyse', 'Erstelle zuerst einen Vergleich. Danach kann die Empfehlungsvorlage erzeugt werden.')}
    `);

    document.getElementById('runDecisionBtn')?.addEventListener('click', runDecision);
    bindActionButtons(document.getElementById('decision'));
  }

  function renderChat() {
    const project = currentProject();
    if (!project) return setHTML('chat', emptyHTML('Kein Projekt vorhanden', 'Erstelle zuerst ein Projekt.'));

    setHTML('chat', `
      <div class="chat-layout">
        <article class="chat-window">
          <div class="warning-panel">
            Hinweis: KI-generierte Antworten können unvollständig oder fehlerhaft sein. Bitte prüfen Sie wichtige Informationen anhand der hochgeladenen Originaldokumente.
          </div>
          <div class="chat-messages" id="chatMessages">
            ${project.chat.length ? project.chat.map(messagePairHTML).join('') : `<div class="message ai">Stelle eine Frage zum aktiven Projekt. Ich unterscheide Lastenheft-Dateien, Angebotsdateien, Analyseergebnisse, Vergleichsergebnisse und Entscheidungsanalyse.</div>`}
          </div>
          <form class="chat-form" id="chatForm">
            <textarea id="chatInput" placeholder="Frage zum Projekt stellen …" required></textarea>
            <button class="primary" type="submit">Senden</button>
          </form>
        </article>

        <aside class="card">
          <h3>Verfügbare Quellen</h3>
          ${sourceStatusHTML(project)}
          <div class="actions mt">
            <button class="ghost" data-action="go" data-target="history" type="button">Verlauf öffnen</button>
            <button class="danger" id="clearChatBtn" type="button" ${project.chat.length ? '' : 'disabled'}>Chatverlauf löschen</button>
          </div>
        </aside>
      </div>
    `);

    document.getElementById('chatForm').addEventListener('submit', handleChatSubmit);
    document.getElementById('clearChatBtn')?.addEventListener('click', clearChat);
    bindActionButtons(document.getElementById('chat'));
    scrollChatToBottom();
  }

  function renderHistory() {
    const project = currentProject();
    if (!project) return setHTML('history', emptyHTML('Kein Projekt vorhanden', 'Erstelle zuerst ein Projekt.'));
    const items = [...project.chat].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    setHTML('history', `
      <article class="card mb">
        <h3>Projektbezogener Verlauf</h3>
        <p>Der Verlauf gehört ausschließlich zum aktiven Projekt <strong>${escapeHtml(project.name)}</strong>.</p>
        <div class="actions">
          <button class="danger" id="clearHistoryBtn" type="button" ${items.length ? '' : 'disabled'}>Verlauf löschen</button>
        </div>
      </article>
      <div class="history-list">
        ${items.length ? items.map(historyItemHTML).join('') : emptyHTML('Kein Verlauf vorhanden', 'Im KI-Chat gestellte Fragen erscheinen hier chronologisch je Projekt.')}
      </div>
    `);

    document.getElementById('clearHistoryBtn')?.addEventListener('click', clearChat);
    document.querySelectorAll('[data-action="open-history-question"]').forEach((button) => {
      button.addEventListener('click', () => {
        showSection('chat');
        setTimeout(() => {
          const input = document.getElementById('chatInput');
          if (input) {
            input.value = button.dataset.question || '';
            input.focus();
          }
        }, 60);
      });
    });
  }

  function kpi(label, value, icon) {
    return `
      <article class="card kpi-card">
        <div>
          <div class="label">${escapeHtml(label)}</div>
          <div class="value">${escapeHtml(String(value))}</div>
        </div>
        <div class="icon">${escapeHtml(icon)}</div>
      </article>
    `;
  }

  function projectSummaryHTML(project) {
    return `
      <h4>${escapeHtml(project.name)}</h4>
      <div class="badges">
        ${badge(`${project.folders.requirements.length} Lastenheft-Datei(en)`, 'blue')}
        ${badge(`${project.folders.offers.length} Angebotsdatei(en)`, 'violet')}
        ${badge(`${project.chat.length} Chat-Einträge`, '')}
      </div>
      <div class="folder-row mt">
        <div class="folder-box"><strong>Lastenheft-Ordner</strong><span>Eigener Upload und eigene Analysequelle</span></div>
        <div class="folder-box"><strong>Angebot-Ordner</strong><span>Eigener Upload und eigene Analysequelle</span></div>
      </div>
    `;
  }

  function analysisProgressHTML(project) {
    if (!project) return emptyHTML('Kein Projekt vorhanden', '');
    const steps = [
      ['Lastenheftanalyse', Boolean(project.analyses.requirements)],
      ['Angebotsanalyse', Boolean(project.analyses.offers)],
      ['Vergleich', Boolean(project.analyses.comparison)],
      ['Entscheidungsanalyse', Boolean(project.analyses.decision)]
    ];
    return `<div class="mini-list">${steps.map(([label, done]) => `
      <div class="mini-item">
        <strong>${escapeHtml(label)}</strong>
        ${badge(done ? 'abgeschlossen' : 'offen', done ? 'green' : 'yellow')}
      </div>`).join('')}</div>`;
  }

  function sourceStatusHTML(project) {
    const sources = [
      ['Lastenheft-Dateien', project.folders.requirements.length],
      ['Angebotsdateien', project.folders.offers.length],
      ['Lastenheftanalyse', project.analyses.requirements?.requirements?.length || 0],
      ['Angebotsanalyse', project.analyses.offers?.offers?.length || 0],
      ['Vergleichsergebnisse', project.analyses.comparison?.comparison?.length || 0],
      ['Entscheidungsanalyse', project.analyses.decision ? 1 : 0]
    ];
    return `<div class="mini-list">${sources.map(([name, count]) => `
      <div class="mini-item">
        <strong>${escapeHtml(name)}</strong>
        <span class="mini-meta">${count ? `${count} verfügbar` : 'nicht vorhanden'}</span>
      </div>
    `).join('')}</div>`;
  }

  function fileListHTML(files, folder) {
    if (!files.length) return emptyHTML('Ordner ist leer', 'Lade Dateien über den Upload-Bereich hoch.');
    return `<div class="file-list">${files.map((file) => `
      <div class="file-chip">
        <div>
          <span class="file-name" title="${escapeAttr(file.name)}">${escapeHtml(file.name)}</span>
          <span class="file-meta">${formatBytes(file.size)} · ${formatDate(file.createdAt)}</span>
        </div>
        <button class="danger" data-action="remove-file" data-folder="${escapeAttr(folder)}" data-id="${escapeAttr(file.id)}" type="button">Entfernen</button>
      </div>
    `).join('')}</div>`;
  }

  function requirementsHTML(requirements) {
    return `<div class="mini-list">${requirements.map((r) => `
      <div class="requirement-item">
        ${badge(r.priority, priorityColor(r.priority))}
        <div>
          <strong>${escapeHtml(r.id || '')} ${escapeHtml(r.description || '')}</strong>
          <div class="mini-meta">Kategorie: ${escapeHtml(r.category || 'Allgemein')}</div>
          ${r.evidence ? `<div class="mini-meta">Beleg: ${escapeHtml(r.evidence)}</div>` : ''}
        </div>
        ${r.missingOrUnclear ? badge('unklar', 'yellow') : badge('erkannt', 'green')}
      </div>
    `).join('')}</div>`;
  }

  function offersHTML(offers) {
    return `<div class="offer-grid">${offers.map((offer) => `
      <article class="card">
        <h4>${escapeHtml(offer.supplier)}</h4>
        <p>${escapeHtml(offer.title || 'Angebot')}</p>
        <div class="badges">
          ${badge(formatEuro(offer.price), 'blue')}
          ${badge(formatWeeks(offer.deliveryWeeks), 'violet')}
          ${badge(formatMonths(offer.warrantyMonths), '')}
        </div>
        <p><strong>Zahlungsbedingungen:</strong><br>${escapeHtml(offer.paymentTerms || 'Nicht angegeben')}</p>
        ${(offer.missingFields || []).length ? `<div class="badges">${offer.missingFields.map((x) => badge(`Fehlt: ${x}`, 'yellow')).join('')}</div>` : badge('Pflichtfelder erkannt', 'green')}
      </article>
    `).join('')}</div>`;
  }

  function comparisonHTML(comparison) {
    return `
      <div class="grid">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Anbieter</th>
                <th>Score</th>
                <th>Muss</th>
                <th>Soll</th>
                <th>Kann</th>
                <th>Preis</th>
                <th>Lieferzeit</th>
                <th>Bewertung</th>
              </tr>
            </thead>
            <tbody>
              ${comparison.map((row) => `
                <tr>
                  <td><strong>${escapeHtml(row.supplier)}</strong></td>
                  <td><div class="score-ring" style="--deg:${Number(row.score || 0) * 3.6}deg"><span>${escapeHtml(String(row.score || 0))}</span></div></td>
                  <td>${row.mustRate ?? 0}%</td>
                  <td>${row.sollRate ?? 0}%</td>
                  <td>${row.kannRate ?? 0}%</td>
                  <td>${formatEuro(row.price)}</td>
                  <td>${formatWeeks(row.deliveryWeeks)}</td>
                  <td>${row.blocked ? badge('nicht empfehlbar', 'red') : badge('bewertbar', 'green')}<br><span class="mini-meta">${escapeHtml(row.summary || '')}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${comparison.map((row) => `
          <article class="card">
            <h3>${escapeHtml(row.supplier)} · Kriterienprüfung</h3>
            ${(row.risks || []).length ? `<div class="badges mb">${row.risks.map((risk) => badge(risk, 'yellow')).join('')}</div>` : ''}
            <div class="table-wrap">
              <table>
                <thead><tr><th>Kriterium</th><th>Status</th><th>Begründung</th></tr></thead>
                <tbody>
                  ${(row.checks || []).map((check) => `
                    <tr>
                      <td><strong>${escapeHtml(check.requirementId || '')}</strong> ${escapeHtml(check.description || '')}<br>${badge(check.priority || 'Soll', priorityColor(check.priority))}</td>
                      <td>${check.fulfilled ? badge(check.status || 'erfüllt', 'green') : badge(check.status || 'nicht belegt', check.priority === 'Muss' ? 'red' : 'yellow')}</td>
                      <td>${escapeHtml(check.evidence || 'Kein Beleg vorhanden.')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </article>
        `).join('')}
      </div>
    `;
  }

  function decisionHTML(decision) {
    return `
      <article class="decision-paper">
        <h3>Empfehlungsvorlage</h3>
        <p><strong>Empfohlener Anbieter:</strong> ${decision.recommendedSupplier ? escapeHtml(decision.recommendedSupplier) : 'Keine belastbare Empfehlung'}</p>
        <p>${escapeHtml(decision.recommendation || '')}</p>
        <h4>Nachvollziehbare Entscheidungslogik</h4>
        <ul>${(decision.logic || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        <h4>Risiken</h4>
        ${(decision.risks || []).length ? `<ul>${decision.risks.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p>Keine zusätzlichen Risiken gespeichert.</p>'}
        <h4>Nächste Schritte</h4>
        <ul>${(decision.nextSteps || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        ${(decision.decisionTable || []).length ? `
          <h4>Entscheidungstabelle</h4>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Anbieter</th><th>Score</th><th>Muss-Erfüllung</th><th>Status</th><th>Begründung</th></tr></thead>
              <tbody>
                ${decision.decisionTable.map((row) => `
                  <tr>
                    <td>${escapeHtml(row.supplier)}</td>
                    <td>${row.score}/100</td>
                    <td>${row.mustRate}%</td>
                    <td>${row.blocked ? badge('gesperrt', 'red') : badge('bewertbar', 'green')}</td>
                    <td>${escapeHtml(row.reason || '')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
      </article>
    `;
  }

  function messagePairHTML(entry) {
    return `
      <div class="message user">${escapeHtml(entry.question)}</div>
      <div class="message ai">${escapeHtml(entry.answer)}</div>
    `;
  }

  function historyItemHTML(entry) {
    return `
      <article class="history-item">
        <strong>${escapeHtml(entry.question)}</strong>
        <p>${escapeHtml(entry.answer)}</p>
        <div class="inline-actions">
          <span class="mini-meta">${formatDate(entry.createdAt)}</span>
          <button class="ghost" data-action="open-history-question" data-question="${escapeAttr(entry.question)}" type="button">Frage erneut öffnen</button>
        </div>
      </article>
    `;
  }

  function emptyHTML(title, text) {
    return `<div class="empty"><strong>${escapeHtml(title)}</strong>${text ? `<span>${escapeHtml(text)}</span>` : ''}</div>`;
  }

  function badge(text, color = '') {
    return `<span class="badge ${escapeAttr(color)}">${escapeHtml(String(text || ''))}</span>`;
  }

  function priorityColor(priority) {
    if (priority === 'Muss') return 'red';
    if (priority === 'Soll') return 'blue';
    if (priority === 'Kann') return 'green';
    return '';
  }

  async function handleFiles(event, folder) {
    const project = currentProject();
    if (!project) return;

    const files = [...event.target.files];
    if (!files.length) return;

    for (const file of files) {
      try {
        const content = await readFile(file);
        project.folders[folder].push({
          id: newId('file'),
          folder,
          name: file.name,
          type: file.type || 'unknown',
          size: file.size,
          createdAt: new Date().toISOString(),
          content
        });
      } catch (error) {
        toast(`${file.name}: ${error.message}`, 'error');
      }
    }

    if (folder === 'requirements') {
      project.analyses.requirements = null;
      project.analyses.comparison = null;
      project.analyses.decision = null;
    } else {
      project.analyses.offers = null;
      project.analyses.comparison = null;
      project.analyses.decision = null;
    }

    touchProject(project);
    saveState();
    renderAll();
    event.target.value = '';
    toast('Dateien wurden dem getrennten Ordner hinzugefügt.', 'success');
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      if (file.size > FILE_LIMIT) {
        reject(new Error('Datei ist zu groß für den Browser-Upload. Bitte kürzere Textfassung verwenden.'));
        return;
      }

      if (/pdf$/i.test(file.name) || file.type === 'application/pdf') {
        reject(new Error('PDF kann im Browser nicht zuverlässig gelesen werden. Bitte Text aus PDF kopieren oder als TXT/CSV bereitstellen.'));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
      reader.onload = () => resolve(String(reader.result || '').slice(0, FILE_LIMIT));
      reader.readAsText(file, 'utf-8');
    });
  }

  function bindFolderActions(root) {
    root.querySelectorAll('[data-action="remove-file"]').forEach((button) => {
      button.addEventListener('click', () => removeFile(button.dataset.folder, button.dataset.id));
    });

    root.querySelectorAll('[data-action="clear-folder"]').forEach((button) => {
      button.addEventListener('click', () => clearFolder(button.dataset.folder));
    });
  }

  function removeFile(folder, id) {
    const project = currentProject();
    if (!project) return;
    project.folders[folder] = project.folders[folder].filter((file) => file.id !== id);
    resetDependentAnalyses(project, folder);
    touchProject(project);
    saveState();
    renderAll();
    toast('Datei entfernt.', 'success');
  }

  function clearFolder(folder) {
    const project = currentProject();
    if (!project) return;
    if (!confirm('Diesen Ordner wirklich leeren? Die zugehörigen Analysen werden zurückgesetzt.')) return;
    project.folders[folder] = [];
    resetDependentAnalyses(project, folder);
    touchProject(project);
    saveState();
    renderAll();
    toast('Ordner geleert.', 'success');
  }

  function resetDependentAnalyses(project, folder) {
    if (folder === 'requirements') project.analyses.requirements = null;
    if (folder === 'offers') project.analyses.offers = null;
    project.analyses.comparison = null;
    project.analyses.decision = null;
  }

  async function runRequirementsAnalysis() {
    const project = currentProject();
    if (!project?.folders.requirements.length) return;
    await withBusy('runRequirementsBtn', 'Analyse läuft …', async () => {
      const text = project.folders.requirements.map((file) => `--- LASTENHEFT: ${file.name} ---\n${file.content}`).join('\n\n');
      const result = await postJson('/api/analyze/requirements', { text });
      project.analyses.requirements = result;
      project.analyses.comparison = null;
      project.analyses.decision = null;
      touchProject(project);
      saveState();
      renderAll();
      toast('Lastenheftanalyse abgeschlossen.', 'success');
    });
  }

  async function runOffersAnalysis() {
    const project = currentProject();
    if (!project?.folders.offers.length) return;
    await withBusy('runOffersBtn', 'Analyse läuft …', async () => {
      const text = project.folders.offers.map((file, index) => `--- ANGEBOT ${index + 1}: ${file.name} ---\n${file.content}`).join('\n\n');
      const result = await postJson('/api/analyze/offers', { text });
      project.analyses.offers = result;
      project.analyses.comparison = null;
      project.analyses.decision = null;
      touchProject(project);
      saveState();
      renderAll();
      toast('Angebotsanalyse abgeschlossen.', 'success');
    });
  }

  function canCompare(project) {
    return Boolean(project?.analyses.requirements?.requirements?.length && project?.analyses.offers?.offers?.length);
  }

  async function runComparison() {
    const project = currentProject();
    if (!canCompare(project)) return;
    await withBusy('runCompareBtn', 'Vergleich läuft …', async () => {
      const result = await postJson('/api/analyze/compare', {
        requirements: project.analyses.requirements.requirements,
        offers: project.analyses.offers.offers
      });
      project.analyses.comparison = result;
      project.analyses.decision = null;
      touchProject(project);
      saveState();
      renderAll();
      toast('Vergleich erstellt.', 'success');
    });
  }

  async function runDecision() {
    const project = currentProject();
    const comparison = project?.analyses.comparison?.comparison || [];
    if (!comparison.length) return;
    await withBusy('runDecisionBtn', 'Entscheidung läuft …', async () => {
      const result = await postJson('/api/analyze/decision', {
        requirements: project.analyses.requirements?.requirements || [],
        offers: project.analyses.offers?.offers || [],
        comparison
      });
      project.analyses.decision = result;
      touchProject(project);
      saveState();
      renderAll();
      toast('Entscheidungsanalyse erstellt.', 'success');
    });
  }

  async function handleChatSubmit(event) {
    event.preventDefault();
    const project = currentProject();
    const input = document.getElementById('chatInput');
    const question = input.value.trim();
    if (!project || !question) return;

    input.value = '';
    const tempId = newId('chat');
    project.chat.push({ id: tempId, question, answer: 'Antwort wird erstellt …', createdAt: new Date().toISOString(), pending: true });
    touchProject(project);
    saveState();
    renderChat();

    try {
      const result = await postJson('/api/chat', { question, context: buildChatContext(project) });
      const entry = project.chat.find((item) => item.id === tempId);
      if (entry) {
        entry.answer = result.answer || 'Keine Antwort erhalten.';
        entry.pending = false;
      }
      touchProject(project);
      saveState();
      renderChat();
    } catch (error) {
      const entry = project.chat.find((item) => item.id === tempId);
      if (entry) {
        entry.answer = `Fehler: ${error.message}`;
        entry.pending = false;
      }
      saveState();
      renderChat();
    }
  }

  function buildChatContext(project) {
    return {
      project: { name: project.name, updatedAt: project.updatedAt },
      requirementFiles: project.folders.requirements.map((file) => ({ name: file.name, content: file.content.slice(0, 12000) })),
      offerFiles: project.folders.offers.map((file) => ({ name: file.name, content: file.content.slice(0, 12000) })),
      requirements: project.analyses.requirements?.requirements || [],
      offers: project.analyses.offers?.offers || [],
      comparison: project.analyses.comparison?.comparison || [],
      decision: project.analyses.decision || null
    };
  }

  function clearChat() {
    const project = currentProject();
    if (!project || !project.chat.length) return;
    if (!confirm('Chatverlauf für dieses Projekt wirklich löschen?')) return;
    project.chat = [];
    touchProject(project);
    saveState();
    renderAll();
    toast('Projektverlauf gelöscht.', 'success');
  }

  async function postJson(url, body) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || `HTTP ${response.status}`);
    return data;
  }

  async function checkBackend() {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error('Backend nicht erreichbar');
      els.backendStatus.className = data.openaiReady ? 'backend-status ok' : 'backend-status warn';
      els.backendStatus.textContent = data.openaiReady
        ? `KI-Backend aktiv · ${data.model}`
        : 'Backend aktiv · OpenAI-Key fehlt, lokale Analyse verfügbar';
    } catch (_) {
      els.backendStatus.className = 'backend-status fail';
      els.backendStatus.textContent = 'Backend nicht erreichbar';
    }
  }

  async function withBusy(buttonId, label, task) {
    const button = document.getElementById(buttonId);
    const original = button?.textContent || '';
    try {
      if (button) {
        button.disabled = true;
        button.textContent = label;
      }
      await task();
    } catch (error) {
      toast(error.message || 'Aktion fehlgeschlagen.', 'error');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = original;
      }
    }
  }

  function bindActionButtons(root) {
    root.querySelectorAll('[data-action="go"]').forEach((button) => {
      button.addEventListener('click', () => showSection(button.dataset.target));
    });
    root.querySelectorAll('[data-action="select-project"]').forEach((button) => {
      button.addEventListener('click', () => {
        state.currentProjectId = button.dataset.id;
        touchProject(currentProject());
        saveState();
        renderAll();
      });
    });
  }

  function exportData() {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `king-ai-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function setHTML(id, html) {
    const node = document.getElementById(id);
    node.innerHTML = html;
  }

  function toast(message, type = '') {
    const node = document.createElement('div');
    node.className = `toast ${type}`.trim();
    node.textContent = message;
    els.toastRegion.appendChild(node);
    setTimeout(() => node.remove(), 4200);
  }

  function scrollChatToBottom() {
    const messages = document.getElementById('chatMessages');
    if (messages) messages.scrollTop = messages.scrollHeight;
  }

  function formatDate(value) {
    if (!value) return 'unbekannt';
    try {
      return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
    } catch (_) {
      return 'unbekannt';
    }
  }

  function formatBytes(bytes) {
    const n = Number(bytes || 0);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  function formatEuro(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'Preis fehlt';
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
  }

  function formatWeeks(value) {
    const n = Number(value);
    return Number.isFinite(n) ? `${n} Wochen` : 'Lieferzeit fehlt';
  }

  function formatMonths(value) {
    const n = Number(value);
    return Number.isFinite(n) ? `${n} Monate Garantie` : 'Garantie fehlt';
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[ch]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }
})();
