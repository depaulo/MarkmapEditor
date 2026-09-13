// @ts-nocheck
// Help / Reference modal logic.
// Extracted from js/main.js into a standalone UI module.
// Content is owned by js/ui/help-content.js (MME_HELP_TOPICS registry).
// ================================
// Help / Reference Modal
// ================================

// Navigation state for mode-aware Help and contextual Help.
let helpOrigin = 'toolbar';     // 'toolbar' | 'welcome'
let helpStack = [];             // stack of topic IDs
let helpReturnTarget = null;    // 'welcome' | 'release-notes' | null
let helpReturnEl = null;        // element to return focus to on Close

// Topic registry (loaded by help-content.js via script-loader before this file).
var TOPICS = (typeof globalThis !== 'undefined' && globalThis.MME_HELP_TOPICS) || [];
var TOPIC_MAP = {};
(function () {
  try { TOPICS = globalThis.MME_HELP_TOPICS || []; } catch {}
  try { TOPICS = window.MME_HELP_TOPICS || TOPICS; } catch {}
  if (Array.isArray(TOPICS)) {
    TOPICS.forEach(function (t) { if (t && t.id) TOPIC_MAP[t.id] = t; });
  }
})();

function setHelpOrigin(origin) {
  helpOrigin = origin === 'welcome' ? 'welcome' : 'toolbar';
}

function getHelpOrigin() {
  return helpOrigin;
}

function updateHelpBackToWelcomeVisibility() {
  try {
    var btn = document.getElementById('btnHelpBackToWelcome');
    if (btn) btn.hidden = getHelpOrigin() !== 'welcome';
  } catch {}
}

function getCurrentHelpContext() {
  var contextId =
    globalThis.currentAppContextId ||
    document.documentElement.dataset.appContext ||
    localStorage.getItem('markmap:appContext') ||
    'editor';

  if (contextId === 'slides') {
    return 'slides';
  }

  if (contextId === 'journal') {
    var workspaceState = globalThis.WORKSPACE_STATE || window.WORKSPACE_STATE || null;

    var activeKind =
      typeof normalizeWorkspaceKindForCompare === 'function'
        ? normalizeWorkspaceKindForCompare(workspaceState?.activeFile?.kind || '')
        : String(workspaceState?.activeFile?.kind || '').trim();

    if (activeKind === 'concepts') {
      return 'concept';
    }

    return 'journal';
  }

  return 'editor';
}

function contextToTopicId(context) {
  if (context === 'slides') return 'mode-slides';
  if (context === 'journal' || context === 'concept') return 'mode-journal';
  return 'mode-editor';
}

function getCurrentHelpTopic() {
  return contextToTopicId(getCurrentHelpContext());
}

function getHelpContextTitle(context) {
  var topic = TOPIC_MAP[contextToTopicId(context)];
  if (topic) return topic.title;
  return 'Help / Reference';
}

function getHelpContextSubtitle(context) {
  var topic = TOPIC_MAP[contextToTopicId(context)];
  if (topic) return topic.subtitle;
  return 'Contextual reference for the current mode.';
}

function renderHelpTopic(topicId) {
  var topic = TOPIC_MAP[topicId];
  if (!topic) {
    log?.('Help: unknown topic ' + topicId);
    return;
  }

  var titleEl = document.getElementById('helpTitle');
  var subtitleEl = document.getElementById('helpSubtitle');
  var body = document.getElementById('helpBody');

  if (!body) {
    log?.('Help: body missing');
    return;
  }

  if (titleEl) titleEl.textContent = topic.title;
  if (subtitleEl) subtitleEl.textContent = topic.subtitle;

  body.innerHTML = topic.html || '';
  try { body.scrollTop = 0; } catch {}

  updateNavVisibility();

  var overlay = document.getElementById('helpOverlay');
  if (overlay) {
    overlay.hidden = false;
    overlay.style.display = 'flex';
    try { overlay.focus?.(); } catch {}
  }
}

function updateNavVisibility() {
  var btnBack = document.getElementById('btnHelpBack');
  var btnBackWelcome = document.getElementById('btnHelpBackToWelcome');

  var hasStack = helpStack.length > 1;
  var hasReturn = !!helpReturnTarget;

  if (btnBackWelcome) btnBackWelcome.hidden = getHelpOrigin() !== 'welcome';
  if (btnBack) btnBack.hidden = !(hasStack || hasReturn);

  log?.('Help: nav stack=' + helpStack.length + ' origin=' + getHelpOrigin() +
    ' returnTarget=' + (helpReturnTarget || 'none'));
}

function showHelpOverlay() {
  var overlay = document.getElementById('helpOverlay');
  if (!overlay) {
    log?.('Help: overlay missing');
    return;
  }
  overlay.hidden = false;
  overlay.style.display = 'flex';
  try { overlay.focus?.(); } catch {}
}

function hideHelpOverlay() {
  var overlay = document.getElementById('helpOverlay');
  if (overlay) {
    overlay.hidden = true;
  }

  // Return focus to the invoker.
  if (helpReturnEl) {
    try { helpReturnEl.focus({ preventScroll: true }); } catch {}
    helpReturnEl = null;
  } else {
    try { document.getElementById('btnHelp')?.focus?.(); } catch {}
  }

  log?.('Help: hidden');
}

function goBack() {
  if (helpStack.length > 1) {
    // Mode → feature: pop to mode topic.
    helpStack.pop();
    var prev = helpStack[helpStack.length - 1];
    renderHelpTopic(prev);
    try { document.getElementById('btnHelpBack')?.focus?.(); } catch {}
  } else if (helpReturnTarget) {
    // From Welcome or Release Notes: exit Help.
    hideHelpOverlay();
    if (helpReturnTarget === 'release-notes') {
      try { window.showReleaseNotes?.(); } catch {}
    } else if (helpReturnTarget === 'welcome') {
      try { window.showWelcomeOverlay?.(); } catch {}
    }
    helpReturnTarget = null;
    helpStack = [];
  }
}

function openHelpTopic(topicId, options) {
  options = options || {};
  var topic = TOPIC_MAP[topicId];
  if (!topic) {
    log?.('Help: unknown topic ' + topicId);
    return;
  }

  var origin = options.origin || 'toolbar';
  setHelpOrigin(origin);

  if (options.fromWelcome) {
    helpStack = [topicId];
    helpReturnTarget = 'welcome';
    helpReturnEl = null;
  } else if (options.fromReleaseNotes) {
    helpStack = [topicId];
    helpReturnTarget = 'release-notes';
    helpReturnEl = null;
  } else if (options.fromPanel) {
    var modeTopic = getCurrentHelpTopic();
    helpStack = [modeTopic, topicId];
    helpReturnTarget = null;
    helpReturnEl = options.returnEl || null;
  } else {
    helpStack = [topicId];
    helpReturnTarget = null;
    helpReturnEl = null;
  }

  renderHelpTopic(topicId);
  showHelpOverlay();
}

function showHelpForContext(context, options) {
  var valid = context === 'journal' || context === 'concept' || context === 'slides' || context === 'editor';
  var target = valid ? context : 'editor';
  var topicId = contextToTopicId(target);

  // UX-MODE1.2: Every Help opening path assigns its origin explicitly.
  setHelpOrigin(options && typeof options === 'object' ? options.origin : 'toolbar');

  if (getHelpOrigin() === 'welcome') {
    openHelpTopic(topicId, { fromWelcome: true });
  } else {
    openHelpTopic(topicId, { origin: 'toolbar', returnEl: document.getElementById('btnHelp') || null });
  }

  log?.('Help: context=' + target + ' topic=' + topicId + ' origin=' + getHelpOrigin());
}

function renderHelpContent() {
  var topicId = getCurrentHelpTopic();
  setHelpOrigin('toolbar');
  helpStack = [topicId];
  helpReturnTarget = null;
  helpReturnEl = document.getElementById('btnHelp') || null;
  renderHelpTopic(topicId);
  showHelpOverlay();
}

function wireHelpOverlay() {
  var btnHelp = document.getElementById('btnHelp');
  var overlay = document.getElementById('helpOverlay');
  var btnClose = document.getElementById('btnHelpClose');
  var btnBack = document.getElementById('btnHelpBack');
  var btnBackToWelcome = document.getElementById('btnHelpBackToWelcome');

  if (!overlay) {
    log?.('Help: wire skipped; overlay missing');
    return;
  }

  if (overlay.__helpBound) {
    return;
  }

  btnHelp?.addEventListener('click', function () {
    var topicId = getCurrentHelpTopic();
    openHelpTopic(topicId, { origin: 'toolbar', returnEl: btnHelp });
  });

  btnClose?.addEventListener('click', function (e) {
    e?.preventDefault?.();
    hideHelpOverlay();
  });

  btnBack?.addEventListener('click', function (e) {
    e?.preventDefault?.();
    goBack();
  });

    btnBackToWelcome?.addEventListener('click', function (e) {
    e?.preventDefault?.();
    setHelpOrigin('toolbar');
    helpStack = [];
    helpReturnTarget = null;
    helpReturnEl = null;
    hideHelpOverlay();
    try { window.showWelcomeOverlay?.(); } catch {}
  });

  overlay.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (helpStack.length > 1 || helpReturnTarget) {
        goBack();
      } else {
        hideHelpOverlay();
      }
    }
  });

  overlay.addEventListener('click', function (event) {
    // Handle in-Help topic links (Journal Help → feature topics).
    var topicLink = event.target.closest('[data-help-topic]');
    if (topicLink) {
      event.preventDefault();
      event.stopPropagation();
      var tid = topicLink.getAttribute('data-help-topic');
      if (tid && typeof globalThis.openHelpTopic === 'function') {
        globalThis.openHelpTopic(tid, { origin: 'toolbar', returnEl: btnHelp });
      }
      return;
    }

    if (event.target === overlay) {
      hideHelpOverlay();
    }
  });

  overlay.__helpBound = true;

  log?.('Help: wired');
}

(function () {
  try {
    window.getCurrentHelpContext = getCurrentHelpContext;
    window.getHelpContextTitle = getHelpContextTitle;
    window.getHelpContextSubtitle = getHelpContextSubtitle;
    window.showHelpOverlay = showHelpOverlay;
    window.hideHelpOverlay = hideHelpOverlay;
    window.wireHelpOverlay = wireHelpOverlay;
    window.renderHelpContent = renderHelpContent;

    globalThis.getCurrentHelpContext = getCurrentHelpContext;
    globalThis.getHelpContextTitle = getHelpContextTitle;
    globalThis.getHelpContextSubtitle = getHelpContextSubtitle;
    globalThis.showHelpOverlay = showHelpOverlay;
    globalThis.hideHelpOverlay = hideHelpOverlay;
    globalThis.wireHelpOverlay = wireHelpOverlay;
    globalThis.renderHelpContent = renderHelpContent;
    globalThis.showHelpForContext = showHelpForContext;
    globalThis.openHelpTopic = openHelpTopic;

    // UX-MODE1.2: Expose navigation origin state.
    globalThis.setHelpOrigin = setHelpOrigin;
    globalThis.getHelpOrigin = getHelpOrigin;

    window.showHelpForContext = showHelpForContext;
    window.openHelpTopic = openHelpTopic;
    window.setHelpOrigin = setHelpOrigin;
    window.getHelpOrigin = getHelpOrigin;
  } catch {}
})();
