// @ts-nocheck
// ACT 5B-2 — Project record utilities (single normalization + ordering owner).
//
// This module is the ONE owner of Project currency normalization and Project
// ordering. It is pure: no DOM, no file handles, no editor buffer, no Save, no
// Workspace Index mutation. Consumers (parser, Workspace Index build, Sidebar,
// Index Projects section, dedicated Projects route) share these functions so
// they can never drift apart again.
//
// It deliberately does NOT own Project mutation: that is
// js/workspace/project-metadata-mutation.js.

(function () {
  'use strict';

  // ---- Currency -----------------------------------------------------------
  // Trim + uppercase. Empty stays empty so "missing currency" remains
  // distinguishable from a present currency. Zero values are handled by
  // consumers (Number.isFinite), never here. No FX conversion, ever.

  function normalizeProjectCurrencyCode(raw) {
    return String(raw == null ? '' : raw).trim().toUpperCase();
  }

  // ---- Ordering -----------------------------------------------------------
  // Canonical Project comparator. This PRESERVES the accepted
  // buildWorkspaceIndex() order exactly and only appends `projectId` as a
  // final stable tiebreaker:
  //   1. valid Expected Order before invalid/missing
  //   2. Expected Order canonical (ascending)
  //   3. name, lowercased for comparison only
  //   4. sourcePath
  //   5. sourceLine
  //   6. projectId (final stable tiebreaker)
  //
  // Archived metadata is deliberately NOT consulted: ACT 5B does not change
  // visibility.

  function compareProjects(a, b) {
    const orderA = a && a.expectedOrder;
    const orderB = b && b.expectedOrder;
    const validA = Boolean(orderA && orderA.valid === true);
    const validB = Boolean(orderB && orderB.valid === true);

    // 1. Scheduled before unscheduled.
    if (validA && !validB) return -1;
    if (!validA && validB) return 1;

    // 2. Canonical quarter ascending.
    if (validA && validB) {
      const canA = orderA.canonical || '';
      const canB = orderB.canonical || '';
      if (canA !== canB) return canA < canB ? -1 : 1;
    }

    // 3. Name, normalized for comparison only (display text is untouched).
    const nameA = String((a && a.name) || '').toLowerCase();
    const nameB = String((b && b.name) || '').toLowerCase();
    if (nameA !== nameB) return nameA < nameB ? -1 : 1;

    // 4. Source path.
    const pathA = String((a && a.sourcePath) || '');
    const pathB = String((b && b.sourcePath) || '');
    if (pathA !== pathB) return pathA < pathB ? -1 : 1;

    // 5. Source line.
    const lineA = (a && a.sourceLine) || 0;
    const lineB = (b && b.sourceLine) || 0;
    if (lineA !== lineB) return lineA - lineB;

    // 6. projectId final stable tiebreaker. Legacy Projects without an ID sort
    // before managed ones deterministically ('' < 'prj_…'); they are never
    // merged with a managed Project.
    const idA = String((a && a.projectId) || '');
    const idB = String((b && b.projectId) || '');
    if (idA !== idB) return idA < idB ? -1 : 1;
    return 0;
  }

  function sortProjects(list) {
    return (Array.isArray(list) ? list.slice() : []).sort(compareProjects);
  }

  // ---- Record key ---------------------------------------------------------
  // Managed Projects key by projectId. Legacy Projects without one get a
  // bounded transitional key. The title is NEVER used as identity.

  function projectRecordKey(project) {
    const id = String((project && project.projectId) || '').trim();
    if (id) return id;
    const path = String((project && project.sourcePath) || '');
    const line = (project && project.sourceLine) || 0;
    return `legacy:${path}:${line}`;
  }

  function isManagedProjectRecord(project) {
    return Boolean(String((project && project.projectId) || '').trim());
  }

  const PROJECT_RECORD_UTILS = {
    normalizeProjectCurrencyCode,
    compareProjects,
    sortProjects,
    projectRecordKey,
    isManagedProjectRecord,
  };

  try {
    globalThis.MME_PROJECT_RECORD_UTILS = PROJECT_RECORD_UTILS;
    window.MME_PROJECT_RECORD_UTILS = PROJECT_RECORD_UTILS;
  } catch {}
})();
