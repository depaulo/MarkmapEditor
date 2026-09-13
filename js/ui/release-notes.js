// @ts-nocheck
// Release Notes viewer + one-time What's New.
// Visible copy lives in js/ui/release-notes-content.js.
// Canonical version lives in js/release/release.js (window.MME_RELEASE).
(function () {
  'use strict';

  // Canonical data contract (single shape, no aliases):
  //   window.MME_RELEASE_NOTES = { releases: [entry...], subtitle }
  //   entry = { version, title, summary,
  //             changes: [{ group, items: [string] }],
  //             tryIt?, uiPath?, limitations?: [string], helpTopic?, expanded? }
  // The registry is resolved at render/open time — never captured at module
  // load — so load-order races cannot produce an empty viewer.
  function registry() {
    return (typeof globalThis !== 'undefined' && globalThis.MME_RELEASE_NOTES) || null;
  }
  function releaseIdentity() {
    return (typeof globalThis !== 'undefined' && globalThis.MME_RELEASE) || null;
  }

  function esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escAttr(str) { return esc(str).replace(/"/g, '&quot;'); }
  function tag(strings) {
    var out = '';
    for (var i = 0; i < strings.length; i++) {
      out += strings[i];
      if (i + 1 < arguments.length) {
        out += arguments[i + 1];
      }
    }
    return out;
  }

  // The active semantic version. Always MME_RELEASE.productVersion at call
  // time; the registry entry version is only a fallback for diagnostics.
  function currentVersion() {
    var rel = releaseIdentity();
    if (rel && rel.productVersion) return rel.productVersion;
    var reg = registry();
    if (reg && reg.releases && reg.releases[0] && reg.releases[0].version) {
      return reg.releases[0].version;
    }
    return '(unversioned)';
  }

  function seenKey() {
    var rel = releaseIdentity();
    return (rel && rel.lastSeenKey) || 'mme:lastSeenRelease';
  }

  function getSeen() {
    try { return localStorage.getItem(seenKey()); } catch { return null; }
  }
  function markSeen() {
    try { localStorage.setItem(seenKey(), currentVersion()); } catch {}
  }

  function shouldShowWhatsNew() {
    try {
      if (typeof window.shouldShowWelcome === 'function' && window.shouldShowWelcome()) return false;
    } catch {}
    return getSeen() !== currentVersion();
  }

  function showOverlay() {
    var overlay = document.getElementById('releaseNotesOverlay');
    if (!overlay) return;
    renderAll();
    overlay.hidden = false;
    overlay.classList.add('open');
    overlay.style.display = 'flex';
    try { overlay.focus?.(); } catch {}
  }

  function hideOverlay(markSeenNow) {
    var overlay = document.getElementById('releaseNotesOverlay');
    if (overlay) { overlay.hidden = true; overlay.classList.remove('open'); }
    if (markSeenNow) markSeen();
  }

  function renderAll() {
    var body = document.getElementById('releaseNotesBody');
    var sub = document.getElementById('releaseNotesSubtitle');
    var reg = registry();
    if (!body || !reg || !reg.releases) return;
    if (sub) sub.textContent = reg.subtitle || '';
    var entries = reg.releases;
    body.innerHTML = entries.map(renderEntry).join('');

    // Exactly one toggle owner per entry: the .releaseToggle button. The
    // entry header itself is not a toggle target, so one click produces one
    // state change.
    body.querySelectorAll('.releaseToggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ver = btn.getAttribute('data-release-toggle');
        var entry = body.querySelector('[data-release="' + CSS.escape(ver) + '"]');
        if (!entry) return;
        var content = entry.querySelector('.releaseEntryContent');
        if (!content) return;
        var expanded = content.getAttribute('aria-expanded') === 'true';
        setEntryExpanded(entry, content, btn, !expanded);
      });
    });

    body.querySelectorAll('[data-help-link]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tid = btn.getAttribute('data-help-link');
        try {
          globalThis.__releaseNotesReturn = true;
          globalThis.openHelpTopic?.(tid, { fromReleaseNotes: true });
          hideOverlay();
        } catch {}
      });
    });
  }

  function setEntryExpanded(entry, content, btn, expanded) {
    content.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    if (expanded) {
      content.removeAttribute('hidden');
    } else {
      content.setAttribute('hidden', '');
    }
    var ver = entry.getAttribute('data-release');
    var showLabel = 'Show release ' + ver;
    var hideLabel = 'Hide release ' + ver;
    btn.textContent = expanded ? hideLabel : showLabel;
    btn.setAttribute('aria-label', expanded ? hideLabel : showLabel);
  }

  function renderEntry(rel) {
    var expanded = rel.expanded !== false;
    var v = rel.version;
    var showLabel = 'Show release ' + v;
    var hideLabel = 'Hide release ' + v;
    return tag`
      <div class="releaseNotesEntry" data-release="${escAttr(v)}">
        <div class="releaseEntryHeader">
          <span class="releaseEntryVersion">${esc(v)}</span>
          <span class="releaseEntryTitle">${esc(rel.title || '')}</span>
          <button type="button" class="releaseToggle" data-release-toggle="${escAttr(v)}" aria-expanded="${expanded ? 'true' : 'false'}" aria-label="${escAttr(expanded ? hideLabel : showLabel)}">${esc(expanded ? hideLabel : showLabel)}</button>
        </div>
        <div class="releaseEntryContent" aria-expanded="${expanded ? 'true' : 'false'}"${expanded ? '' : ' hidden'}>
          <p class="releaseEntrySummary">${esc(rel.summary || '')}</p>
          ${renderChanges(rel)}
          ${renderTryIt(rel)}
          ${renderUiPath(rel)}
          ${renderLimitations(rel)}
          ${renderHelpLink(rel)}
        </div>
      </div>`;
  }

  function renderChanges(rel) {
    if (!rel.changes || !rel.changes.length) return '';
    return tag`${rel.changes.map(function (g) {
      return tag`<div class="releaseChangeGroup"><strong>${esc(g.group || '')}</strong><ul>${g.items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('')}</ul></div>`;
    }).join('')}`;
  }

  function renderTryIt(rel) {
    if (!rel.tryIt) return '';
    return tag`<strong>Try it</strong><pre class="releaseTryIt">${esc(rel.tryIt)}</pre>`;
  }
  function renderUiPath(rel) {
    if (!rel.uiPath) return '';
    return tag`<div class="releaseUiPath">${esc(rel.uiPath)}</div>`;
  }
  function renderLimitations(rel) {
    if (!rel.limitations || !rel.limitations.length) return '';
    return tag`<div class="releaseLimitations"><strong>Limitations</strong><ul>${rel.limitations.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('')}</ul></div>`;
  }
  function renderHelpLink(rel) {
    if (!rel.helpTopic) return '';
    return tag`<button type="button" class="releaseHelpLink" data-help-link="${escAttr(rel.helpTopic)}" aria-label="Open Help for this release">Open Help</button>`;
  }

  function wireBtn(id, handler, key) {
    var btn = document.getElementById(id);
    if (!btn || btn[key]) return;
    btn.addEventListener('click', handler);
    btn[key] = true;
  }

  function init() {
    wireBtn('btnReleaseNotes', function () { showOverlay(); }, '__rnBound');
    wireBtn('btnReleaseNotesClose', function () { hideOverlay(true); }, '__rnClose');
  }

  (function expose() {
    try {
      globalThis.showReleaseNotes = showOverlay;
      globalThis.hideReleaseNotes = function (m) { hideOverlay(!!m); };
      globalThis.showWhatsNewIfNeeded = function () {
        if (!shouldShowWhatsNew()) return false;
        showOverlay();
        return true;
      };
      globalThis.shouldShowWhatsNew = shouldShowWhatsNew;
      globalThis.markReleaseSeen = markSeen;
      window.showReleaseNotes = showOverlay;
      window.hideReleaseNotes = globalThis.hideReleaseNotes;
      window.showWhatsNewIfNeeded = globalThis.showWhatsNewIfNeeded;
      window.shouldShowWhatsNew = shouldShowWhatsNew;
      window.markReleaseSeen = markSeen;
    } catch {}
  })();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
