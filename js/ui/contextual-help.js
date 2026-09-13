// @ts-nocheck
// Shared contextual Help-button helper.
// Called from selected panel owners (Reports, Projects, Tasks, Related/Wiki Links).
// Does not introduce an OO panel hierarchy.
(function () {
  'use strict';

  function escAttr(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  // Creates the contextual Help button element (separate from the collapse
  // toggle; never placed inside a button).
  function makeHelpButton(topicId, returnEl) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ctxHelpBtn';
    btn.setAttribute('title', 'Help for this panel');
    btn.setAttribute('aria-label', 'Help for this panel');
    btn.setAttribute('data-help-topic', escAttr(topicId));
    btn.textContent = '?';

    btn.addEventListener('click', function (e) {
      e && e.preventDefault && e.preventDefault();
      e && e.stopPropagation && e.stopPropagation();
      try {
        if (typeof globalThis.openHelpTopic === 'function') {
          globalThis.openHelpTopic(topicId, { origin: 'panel', returnEl: returnEl || btn });
        } else {
          globalThis.showHelpOverlay?.();
        }
      } catch {}
    });

    return btn;
  }

  // Inserts a small "?" button into a panel header controls container,
  // immediately before the final badge/count/status element (so the badge
  // remains the last element on the right).
  // opts: { panel, helpTopicId, returnEl }
  function attachContextualHelpButton(opts) {
    var panelEl = opts && opts.panel;
    var topicId = opts && opts.helpTopicId;
    var returnEl = opts && opts.returnEl;

    if (!panelEl || !topicId) return null;

    // Resolve the exact direct-child panel header.
    var header =
      panelEl.querySelector(':scope > .workspaceProjectsHeader') ||
      panelEl.querySelector(':scope > .workspaceTasksHeader') ||
      panelEl.querySelector(':scope > .workspaceReportHeader') ||
      panelEl.querySelector(':scope > .workspaceRelatedHeader');
    if (!header) return null;

    // Resolve the right-controls container.
    var controls = header.querySelector(':scope > .workspacePanelHeaderControls');
    if (!controls) {
      log?.('Help: contextual controls container missing for ' + topicId);
      return null;
    }

    // Find the final badge/count/status (the rightmost indicator).
    var indicator = controls.querySelector(':scope > .workspacePanelBadge');
    if (!indicator) {
      log?.('Help: contextual indicator missing for ' + topicId);
      return null;
    }

    // Idempotency: never attach a duplicate Help control.
    if (controls.querySelector(':scope > .ctxHelpBtn')) {
      return controls.querySelector(':scope > .ctxHelpBtn');
    }

    var btn = makeHelpButton(topicId, returnEl);
    // Insert immediately before the final indicator so the badge stays last.
    controls.insertBefore(btn, indicator);
    return btn;
  }

  (function () {
    try {
      globalThis.attachContextualHelpButton = attachContextualHelpButton;
      window.attachContextualHelpButton = attachContextualHelpButton;
    } catch {}
  })();
})();
