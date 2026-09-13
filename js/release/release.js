// @ts-nocheck
// ================================
// Canonical runtime release identity.
// Single source of truth for the semantic product version and cache identity.
// This module owns ONLY identity values (productVersion, cacheIdentity,
// lastSeenKey). It contains NO user-visible copy.
// Visible Release Notes copy lives in js/ui/release-notes-content.js.
// Visible Help copy lives in js/ui/help-content.js.
// ================================
(function () {
  'use strict';

  const RELEASE = Object.freeze({
    // User-facing semantic product version (MAJOR.MINOR.PATCH).
    productVersion: '0.6.0',
    // Service-worker / cache identity for this release boundary.
    // Must match APP_VERSION in sw.js (checked by scripts/release-parity.cjs).
    cacheIdentity: 'markmap-journal-pwa-0.6.0-help-release-foundation',
    // One-time What's New / Release Notes seen-state storage key.
    // Records the active productVersion when the current release is dismissed.
    lastSeenKey: 'mme:lastSeenRelease',
  });

  const MME_RELEASE = Object.freeze({
    productVersion: RELEASE.productVersion,
    cacheIdentity: RELEASE.cacheIdentity,
    lastSeenKey: RELEASE.lastSeenKey,
  });

  try {
    globalThis.MME_RELEASE = MME_RELEASE;
    window.MME_RELEASE = MME_RELEASE;
  } catch {}
})();