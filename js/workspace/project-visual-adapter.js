// @ts-nocheck
// ACT 5C — Projects VISUAL MUTATION ADAPTER (orchestration only).
//
// This adapter does NOT parse Project Markdown and does NOT serialize Project
// metadata. Those remain owned by:
//   - MME_PROJECT_METADATA_MUTATION (pure Markdown mutation)
//   - WORKSPACE_PARSER                (parsing)
//
// The adapter only ORCHESTRATES accepted owners, in this order:
//   1. resolve the authoritative document (active buffer OR open the source)
//   2. re-verify `projectId` against LIVE Markdown (never trust a stale line)
//   3. invoke the pure mutation owner
//   4. ONE programmatic editor-buffer update (main.js owner)
//   5. ONE physical Save (main.js owner)
//   6. ONLY after Save success: Index rebuild + Projects route refresh
//
// It never writes files directly, never owns currentSaveHandle, never calls
// createWritable, never targets by title, and never creates a second Save path.

(function () {
  'use strict';

  const REASONS = Object.freeze({
    PROJECT_NOT_FOUND: 'project-not-found',
    PROJECT_ID_MISSING: 'project-id-missing',
    DUPLICATE_PROJECT_ID: 'duplicate-project-id',
    SOURCE_FILE_NOT_FOUND: 'source-file-not-found',
    SOURCE_NOT_WRITABLE: 'source-not-writable',
    SOURCE_STALE: 'source-stale',
    MALFORMED_PROJECT_COMMENT: 'malformed-project-comment',
    INVALID_VALUE: 'invalid-value',
    INVALID_CURRENCY: 'invalid-currency',
    INVALID_QUARTER: 'invalid-quarter',
    UNSUPPORTED_STAGE: 'unsupported-stage',
    UNSUPPORTED_STATE: 'unsupported-state',
    SAVE_CANCELED: 'save-canceled',
    SAVE_FAILED: 'save-failed',
    DIRTY_NOTE_CANCELED: 'dirty-note-canceled',
    NO_CHANGE: 'no-change',
    NO_OWNER: 'no-owner',
  });

  const PHASES = Object.freeze({
    RESOLVE: 'resolve',
    VERIFY: 'verify',
    MUTATE: 'mutate',
    APPLY: 'apply',
    SAVE: 'save',
    REBUILD: 'rebuild',
    REFRESH: 'refresh',
    DONE: 'done',
  });

  // ACT 5C batch phases (diagnostics only).
  const BATCH_PHASES = Object.freeze({
    VALIDATE: 'validate',
    TRANSITION: 'transition',
    SOURCE_READY: 'source-ready',
    MUTATE: 'mutate',
    SAVE: 'save',
    REFRESH: 'refresh',
    COMPLETE: 'complete',
    FAILED: 'failed',
  });

  function safeLog(m) {
    try { if (typeof globalThis.MME_APP?.log === 'function') globalThis.MME_APP.log(m); } catch {}
  }

  // ACT 5C device correction: every failure leaves ONE bounded reason.
  // The vocabulary is closed, machine-comparable and never contains a title, a
  // path, a value, a project id or any Markdown.
  const BOUNDED = Object.freeze({
    NO_DRAFTS: 'no-drafts',
    HOST_UNAVAILABLE: 'host-unavailable',
    OWNER_UNAVAILABLE: 'owner-unavailable',
    ALREADY_APPLYING: 'already-applying',
    SOURCE_RECORD_MISSING: 'source-record-missing',
    SOURCE_FILE_NOT_FOUND: 'source-file-not-found',
    SOURCE_OPEN_FAILED: 'source-open-failed',
    SOURCE_OPEN_CANCELED: 'source-open-canceled',
    SOURCE_NOT_READY: 'source-not-ready',
    SOURCE_KIND_INVALID: 'source-kind-invalid',
    SOURCE_STALE: 'source-stale',
    PROJECT_NOT_FOUND: 'project-not-found',
    PROJECT_ID_MISSING: 'project-id-missing',
    DUPLICATE_PROJECT_ID: 'duplicate-project-id',
    MALFORMED_PROJECT_COMMENT: 'malformed-project-comment',
    OPERATION_INVALID: 'operation-invalid',
    MUTATION_FAILED: 'mutation-failed',
    INVALID_VALUE: 'invalid-value',
    INVALID_CURRENCY: 'invalid-currency',
    INVALID_QUARTER: 'invalid-quarter',
    UNSUPPORTED_STAGE: 'unsupported-stage',
    UNSUPPORTED_STATE: 'unsupported-state',
    BUFFER_UPDATE_FAILED: 'buffer-update-failed',
    SAVE_CANCELED: 'save-canceled',
    SAVE_FAILED: 'save-failed',
    DIRTY_NOTE_CANCELED: 'dirty-note-canceled',
    INDEX_REBUILD_FAILED: 'index-rebuild-failed',
    RETURN_FAILED: 'return-failed',
    UNKNOWN: 'unknown-failure',
  });

  // Owner reason -> bounded reason. Anything unknown degrades to
  // `mutation-failed` instead of leaking an unbounded string.
  const REASON_MAP = Object.freeze({
    [REASONS.PROJECT_NOT_FOUND]: BOUNDED.PROJECT_NOT_FOUND,
    [REASONS.PROJECT_ID_MISSING]: BOUNDED.PROJECT_ID_MISSING,
    [REASONS.DUPLICATE_PROJECT_ID]: BOUNDED.DUPLICATE_PROJECT_ID,
    [REASONS.MALFORMED_PROJECT_COMMENT]: BOUNDED.MALFORMED_PROJECT_COMMENT,
    [REASONS.SOURCE_FILE_NOT_FOUND]: BOUNDED.SOURCE_FILE_NOT_FOUND,
    [REASONS.SOURCE_NOT_WRITABLE]: BOUNDED.SOURCE_FILE_NOT_FOUND,
    [REASONS.SOURCE_STALE]: BOUNDED.SOURCE_STALE,
    [REASONS.INVALID_VALUE]: BOUNDED.INVALID_VALUE,
    [REASONS.INVALID_CURRENCY]: BOUNDED.INVALID_CURRENCY,
    [REASONS.INVALID_QUARTER]: BOUNDED.INVALID_QUARTER,
    [REASONS.UNSUPPORTED_STAGE]: BOUNDED.UNSUPPORTED_STAGE,
    [REASONS.UNSUPPORTED_STATE]: BOUNDED.UNSUPPORTED_STATE,
    [REASONS.SAVE_CANCELED]: BOUNDED.SAVE_CANCELED,
    [REASONS.SAVE_FAILED]: BOUNDED.SAVE_FAILED,
    [REASONS.DIRTY_NOTE_CANCELED]: BOUNDED.DIRTY_NOTE_CANCELED,
    [REASONS.NO_OWNER]: BOUNDED.HOST_UNAVAILABLE,
    'no-change': BOUNDED.NO_DRAFTS,
    'unsupported-operation': BOUNDED.OPERATION_INVALID,
    'no-owner': BOUNDED.HOST_UNAVAILABLE,
  });

  function boundedReason(reason, fallback) {
    const key = String(reason == null ? '' : reason).trim();
    if (!key) return fallback || BOUNDED.UNKNOWN;
    // An already-bounded value passes through unchanged.
    if (Object.values(BOUNDED).indexOf(key) !== -1) return key;
    if (REASON_MAP[key]) return REASON_MAP[key];
    return fallback || BOUNDED.MUTATION_FAILED;
  }

  function logBatch(phase, counts, reason, sourceReady) {
    const c = counts || {};
    const suffix = reason ? ` reason=${reason}` : '';
    // ACT 5C diagnostics: readiness is reported on the transition, source-ready
    // and failed phases. Nothing else is logged — no paths, titles, values,
    // project ids, Markdown or handles.
    const ready = sourceReady === undefined || sourceReady === null ? '' : ` sourceReady=${sourceReady === true}`;
    safeLog(`ProjectsApplyBatch: phase=${phase}${suffix}${ready} projects=${c.projects || 0} sources=${c.sources || 0} applied=${c.applied || 0} failed=${c.failed || 0} pending=${c.pending || 0}`);
  }

  // Errors that mean "the target document is somewhere else": resolve it
  // through the accepted Workspace source owner rather than writing blindly.
  const RESOLVABLE = new Set([REASONS.PROJECT_NOT_FOUND, REASONS.SOURCE_FILE_NOT_FOUND, REASONS.SOURCE_STALE]);

  function host() { return globalThis.MME_PROJECT_EDIT_HOST || null; }
  function owner() { return globalThis.MME_PROJECT_METADATA_MUTATION || null; }
  function utils() { return globalThis.MME_PROJECT_RECORD_UTILS || null; }

  function outcome(over) {
    return Object.assign(
      {
        ok: false,
        changed: false,
        reason: '',
        phase: '',
        projectId: '',
        field: '',
        saveResult: null,
        refreshed: false,
        diagnostics: [],
        sourcePath: '',
        sourceLine: null,
      },
      over || {}
    );
  }

  function projectIdPresentIn(markdown, projectId) {
    // Independent of the parser: a projectId is only trusted if the id literal
    // appears inside a managed comment in the LIVE text we are about to save.
    const text = String(markdown == null ? '' : markdown);
    const wanted = String(projectId == null ? '' : projectId).trim();
    if (!wanted) return 0;
    const re = /<!--\s*mme-project:([\s\S]*?)-->/gi;
    let hits = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const inner = m[1] || '';
      const idm = inner.match(/(?:^|;)\s*id\s*=\s*([^;]+)/i);
      if (idm && idm[1].trim() === wanted) hits += 1;
    }
    return hits;
  }

  function normalizePhaseOf(operation) {
    if (/ExpectedOrder/.test(operation)) return 'expectedOrder';
    if (/ValueCurrency/.test(operation)) return 'valueCurrency';
    if (/Stage/.test(operation)) return 'stage';
    if (/State/.test(operation)) return 'state';
    if (/ExpectedDelivery/.test(operation)) return 'expectedDelivery';
    if (/ExpectedBilling/.test(operation)) return 'expectedBilling';
    return '';
  }

  /**
   * Apply one Project field change.
   *
   * @param {{projectId:string, sourcePath?:string, sourceLine?:number,
   *          operation:string, value?:any, currency?:string, quarter?:string,
   *          resolveSource?:boolean}} request
   */
  async function applyProjectFieldChange(request) {
    const req = request || {};
    const h = host();
    const m = owner();
    const projectId = String(req.projectId == null ? '' : req.projectId).trim();

    if (!h || !m) return outcome({ reason: REASONS.NO_OWNER, projectId, phase: PHASES.RESOLVE });
    if (!projectId) {
      return outcome({ reason: REASONS.PROJECT_ID_MISSING, projectId, phase: PHASES.VERIFY });
    }

    const operation = String(req.operation || '');
    const field = normalizePhaseOf(operation);

    // ---- 1. RESOLVE: is the target already the active document? ----
    let phase = PHASES.RESOLVE;
    let active = h.getMarkdown();

    if (projectIdPresentIn(active, projectId) === 0) {
      // Not in the live buffer. Resolve it through the accepted Workspace owner.
      const resolved = await resolveSourceDocument(req);
      if (!resolved.ok) {
        return outcome({ reason: resolved.reason, projectId, field, phase: PHASES.RESOLVE, diagnostics: resolved.diagnostics || [] });
      }
      active = h.getMarkdown();
    }

    // ---- 2. VERIFY: projectId is the authority ----
    phase = PHASES.VERIFY;
    const hits = projectIdPresentIn(active, projectId);
    if (hits === 0) {
      return outcome({ reason: REASONS.PROJECT_NOT_FOUND, projectId, field, phase });
    }
    if (hits > 1) {
      // Refuse to guess which duplicate-title Project is meant.
      return outcome({ reason: REASONS.DUPLICATE_PROJECT_ID, projectId, field, phase });
    }

    // ---- 3. MUTATE: the PURE owner, once ----
    phase = PHASES.MUTATE;
    const mutation = m.mutateProject(active, { projectId }, {
      op: operation,
      value: req.value,
      currency: req.currency,
      quarter: req.quarter,
    });

    if (!mutation.ok) {
      // A refused mutation never touches the buffer.
      return outcome({
        reason: mutation.reason || REASONS.PROJECT_NOT_FOUND,
        projectId,
        field,
        phase,
        diagnostics: mutation.diagnostics || [],
      });
    }
    if (!mutation.changed) {
      return outcome({
        ok: true,
        changed: false,
        reason: REASONS.NO_CHANGE,
        projectId,
        field,
        phase: PHASES.DONE,
        diagnostics: mutation.diagnostics || [],
      });
    }

    // ---- 4. APPLY: exactly ONE buffer update ----
    phase = PHASES.APPLY;
    h.applyMarkdown(mutation.proposedMarkdown);

    // ---- 5. SAVE: exactly ONE physical Save through the accepted owner ----
    phase = PHASES.SAVE;
    let saveResult = null;
    try {
      saveResult = await h.save();
    } catch (e) {
      return outcome({
        reason: REASONS.SAVE_FAILED,
        projectId,
        field,
        phase,
        saveResult: { ok: false, error: String(e && e.message ? e.message : e) },
      });
    }

    if (!saveResult || saveResult.ok !== true) {
      const canceled = saveResult && saveResult.reason === 'canceled';
      // The reconciled buffer stays dirty and retryable; nothing is persisted
      // and no Index rebuild happens.
      return outcome({
        reason: canceled ? REASONS.SAVE_CANCELED : REASONS.SAVE_FAILED,
        projectId,
        field,
        phase,
        saveResult,
      });
    }

    // ---- 6. REBUILD only after physical Save success ----
    phase = PHASES.REBUILD;
    try {
      await h.rebuildIndex();
    } catch (e) {
      return outcome({
        reason: REASONS.SAVE_FAILED,
        projectId,
        field,
        phase,
        saveResult,
        diagnostics: [{ code: 'index-rebuild-failed', detail: String(e && e.message ? e.message : e) }],
      });
    }

    // ---- 7. REFRESH the Projects route ----
    phase = PHASES.REFRESH;
    let refreshed = false;
    try {
      if (typeof globalThis.MME_PROJECTS_VIEW?.refreshRoute === 'function') {
        globalThis.MME_PROJECTS_VIEW.refreshRoute();
        refreshed = true;
      }
    } catch {}

    return outcome({
      ok: true,
      changed: true,
      reason: '',
      projectId,
      field,
      phase: PHASES.DONE,
      saveResult,
      refreshed,
      diagnostics: mutation.diagnostics || [],
      sourceLine: mutation.resolvedSourceLine,
    });
  }

  /**
   * Resolve a Project that is not in the active buffer.
   *
   * Reuses the accepted Save / Discard / Cancel transition and the accepted
   * Workspace source-opening owner. It NEVER writes a file directly and never
   * opens a second editor.
   */
  async function resolveSourceDocument(req) {
    const h = host();
    const sourcePath = String((req && req.sourcePath) || '');
    const sourceLine = Number(req && req.sourceLine) || 0;
    // The batch plan carries sourceKind on both the source group and the Project
    // entry; 'kind' is the legacy single-field spelling. Reading only 'kind' made
    // every batch group fall back to 'notes'.
    const kind = String((req && (req.sourceKind || req.kind)) || 'notes');

    if (!sourcePath) return { ok: false, reason: BOUNDED.SOURCE_RECORD_MISSING };

    // Dirty active Note: reuse the coordinated Save / Discard / Cancel
    // transition. Nothing is ever auto-discarded or auto-saved silently.
    if (h && h.isDirty()) {
      const transition = await resolveDirtyNote();
      if (!transition.ok) {
        return { ok: false, reason: boundedReason(transition.reason, BOUNDED.DIRTY_NOTE_CANCELED), diagnostics: transition.diagnostics || [] };
      }
    }

    // The record comes from the ACCEPTED Workspace file owner.
    const resolved = resolveFileRecord(sourcePath, kind);
    if (!resolved.record) return { ok: false, reason: resolved.reason };
    const record = resolved.record;
    const recordKind = String(record.kind || kind || 'notes');
    if (typeof recordKind !== 'string' || !recordKind) {
      return { ok: false, reason: BOUNDED.SOURCE_KIND_INVALID };
    }

    if (typeof globalThis.openWorkspaceFile !== 'function') {
      return { ok: false, reason: BOUNDED.SOURCE_OPEN_FAILED };
    }

    const hostApi = globalThis.MME_WORKSPACE_HOST;
    if (hostApi && typeof hostApi.switchTo === 'function') {
      try {
        await hostApi.switchTo('journal', { reason: 'projects edit: open source' });
      } catch (e) {
        return { ok: false, reason: BOUNDED.SOURCE_OPEN_FAILED, diagnostics: [{ code: 'switch-failed', detail: String(e && e.message ? e.message : e) }] };
      }
    }

    try {
      // Accepted signature: openWorkspaceFile(file, kind, reason, options).
      // The options object MUST NOT be passed in the KIND position.
      const opened = await globalThis.openWorkspaceFile(record, recordKind, 'projects edit: open source', {
        focusLine: sourceLine,
      });
      // ACT 5C source-ready contract (Sections 7-8): navigation alone is NOT
      // success. The accepted opener returns an explicit result whose `ready`
      // flag is true only after its activation sequence completes. Refusals
      // stay explicit: null when navigation was in progress or the dirty
      // prompt was declined, {cancelled:true} on cancellation and {ok:false}
      // when a Report guard blocks the open. An open that has not reported
      // ready must never be verified against the live buffer — that is how the
      // device reached 'project-not-found' before the source finished
      // activating.
      const openOk = opened != null && opened.cancelled !== true && opened.ok !== false && opened.ready === true;
      if (!openOk) {
        const reason = opened == null || opened.cancelled === true
          ? BOUNDED.SOURCE_OPEN_CANCELED
          : opened.ok === false
            ? BOUNDED.SOURCE_OPEN_FAILED
            : BOUNDED.SOURCE_NOT_READY;
        return { ok: false, reason };
      }
    } catch (e) {
      return { ok: false, reason: BOUNDED.SOURCE_OPEN_FAILED, diagnostics: [{ code: 'open-failed', detail: String(e && e.message ? e.message : e) }] };
    }

    // The projectId is re-verified by the caller against LIVE text; the stale
    // sourceLine is only a navigation hint and is deliberately ignored when the
    // id resolves elsewhere.
    return { ok: true, sourcePath, sourceKind: kind, ready: true };
  }

  // Bounded, source-proven Save / Discard / Cancel. Cancel mutates nothing.
  async function resolveDirtyNote() {
    const h = host();
    if (!h || !h.isDirty()) return { ok: true, action: 'none' };
    const confirmFn = typeof globalThis.confirm === 'function' ? globalThis.confirm : null;
    if (!confirmFn) return { ok: false, reason: REASONS.DIRTY_NOTE_CANCELED };

    if (confirmFn('The current Note has unsaved changes. Save it before opening the Project source?')) {
      let saved = null;
      try {
        saved = await h.save();
      } catch (e) {
        return { ok: false, reason: REASONS.SAVE_FAILED, diagnostics: [{ code: 'save-failed', detail: String(e && e.message ? e.message : e) }] };
      }
      if (!saved || saved.ok !== true) {
        return { ok: false, reason: saved && saved.reason === 'canceled' ? REASONS.SAVE_CANCELED : REASONS.SAVE_FAILED };
      }
      return { ok: true, action: 'save' };
    }

    if (confirmFn('Discard the unsaved changes in the current Note and continue?')) {
      // Accepted discard behaviour: opening the source replaces the buffer and
      // clears dirty state through the existing open owner. No new discard path.
      return { ok: true, action: 'discard' };
    }

    return { ok: false, reason: REASONS.DIRTY_NOTE_CANCELED, action: 'cancel' };
  }

  // ---- ACT 5C BATCH OWNER -------------------------------------------------
  // One entry point for the Projects View. Contract:
  //   1. protect the current dirty Note ONCE through Save/Discard/Cancel;
  //   2. group by source file deterministically;
  //   3. open each source visibly through the accepted owners;
  //   4. verify projectId against LIVE Markdown (never a stale line);
  //   5. compose ALL pure mutations for that source in memory;
  //   6. ONE buffer update + ONE physical Save for that source;
  //   7. rebuild the Index only after Save success, then continue.
  //
  // There is NO hidden file writer and NO rollback of already-saved files.

  function batchResult(over) {
    return Object.assign({
      ok: false,
      outcome: 'failed',
      reason: '',
      reasonCode: '',
      appliedProjectIds: [],
      appliedProjects: 0,
      appliedFields: 0,
      failedProjects: 0,
      pendingProjects: 0,
      sources: 0,
      diagnostics: [],
    }, over || {});
  }

  // Every failure leaves a BOUNDED reason on the result and in the log.
  function failedResult(reason, fallback, over) {
    const code = boundedReason(reason, fallback);
    return batchResult(Object.assign({ outcome: 'failed', reason: code, reasonCode: code }, over || {}));
  }

  function fieldCountOf(ops) {
    let n = 0;
    for (const op of ops) if (op && op.operation) n += 1;
    return n;
  }

  function partialOutcome(reason, appliedIds, appliedFields, failed, projects, groups, processed, extra) {
    const code = boundedReason(reason);
    return batchResult(Object.assign({
      outcome: 'partial',
      reason: code,
      reasonCode: code,
      appliedProjectIds: appliedIds.slice(),
      appliedProjects: appliedIds.length,
      appliedFields,
      failedProjects: failed,
      pendingProjects: Math.max(0, projects.length - processed - failed),
      sources: groups.length,
    }, extra || {}));
  }

  // ACT 5C device correction: the source file record is resolved through the
  // ACCEPTED Workspace owner (findWorkspaceFileByPath). The hand-rolled scan is
  // ONLY a fallback for a host that does not expose the owner at all, so a
  // "not found" answer from the owner is never second-guessed.
  function resolveFileRecord(sourcePath, kind) {
    const path = String(sourcePath || '').trim();
    if (!path) return { record: null, reason: BOUNDED.SOURCE_RECORD_MISSING };

    const hasOwner = typeof globalThis.findWorkspaceFileByPath === 'function';
    if (hasOwner) {
      let record = null;
      try { record = globalThis.findWorkspaceFileByPath(path, kind || 'notes'); } catch { record = null; }
      if (record && record.handle) return { record, reason: '' };
      return { record: null, reason: record ? BOUNDED.SOURCE_FILE_NOT_FOUND : BOUNDED.SOURCE_FILE_NOT_FOUND };
    }

    try {
      const state = globalThis.WORKSPACE_STATE || {};
      const files = state && state.files && (state.files.notes || state.files);
      if (Array.isArray(files)) {
        const record = files.find((f) => f && String(f.path || '').trim() === path) || null;
        if (record && record.handle) return { record, reason: '' };
      }
    } catch { /* treated as not found */ }
    return { record: null, reason: BOUNDED.SOURCE_FILE_NOT_FOUND };
  }

  // ACT 5C device correction: Save is capability-gated by the ACTIVE route.
  // saveSmart() refuses with { ok:false, reason:'unavailable' } (and a toast)
  // whenever the Projects route is active, because PROJECTS_CAPABILITIES.save
  // is deliberately false. A batch that Saves while Projects is active can
  // therefore never change a Project on a real device. This predicate reports
  // that exact condition; it is pure and side-effect free. When the capability
  // module is absent it returns false, so an environment that owns no
  // capability policy never gets a route transition.
  function saveCapabilityBlocked() {
    try {
      const caps = globalThis.MME_WORKSPACE_CAPABILITIES;
      if (!caps || typeof caps.canActive !== 'function') return false;
      return caps.canActive('save') !== true;
    } catch {
      return false;
    }
  }

  /**
   * @param {{projects:Array, sources:Array, fieldCount:number}} plan
   */
  async function applyProjectBatch(plan) {
    const h = host();
    const m = owner();
    const projects = Array.isArray(plan && plan.projects) ? plan.projects : [];
    const groups = Array.isArray(plan && plan.sources) ? plan.sources : [];
    // ACT 5C diagnostics: false until the source-ready barrier proves the
    // target document, true afterwards. Reported on transition/source-ready/
    // failed phases; never a path, title, value, id, Markdown or handle.
    let sourceReady = false;

    if (!h) {
      logBatch(BATCH_PHASES.FAILED, { projects: projects.length, sources: groups.length, failed: projects.length, pending: projects.length }, BOUNDED.HOST_UNAVAILABLE, sourceReady);
      return failedResult(BOUNDED.HOST_UNAVAILABLE, null, { failedProjects: projects.length, pendingProjects: projects.length, sources: groups.length });
    }
    if (!m) {
      logBatch(BATCH_PHASES.FAILED, { projects: projects.length, sources: groups.length, failed: projects.length, pending: projects.length }, BOUNDED.OWNER_UNAVAILABLE, sourceReady);
      return failedResult(BOUNDED.OWNER_UNAVAILABLE, null, { failedProjects: projects.length, pendingProjects: projects.length, sources: groups.length });
    }
    if (!projects.length) {
      logBatch(BATCH_PHASES.COMPLETE, { projects: 0, sources: 0, applied: 0, failed: 0, pending: 0 });
      return batchResult({ outcome: 'complete', reason: BOUNDED.NO_DRAFTS, reasonCode: BOUNDED.NO_DRAFTS });
    }

    // A plan entry without an identity is refused BEFORE any source transition:
    // a plan error must never cost a visible open.
    for (const p of projects) {
      if (!String((p && p.projectId) || '').trim()) {
        logBatch(BATCH_PHASES.FAILED, { projects: projects.length, sources: groups.length, failed: projects.length, pending: projects.length }, BOUNDED.PROJECT_ID_MISSING, sourceReady);
        return failedResult(BOUNDED.PROJECT_ID_MISSING, null, { failedProjects: projects.length, pendingProjects: projects.length, sources: groups.length });
      }
    }

    const appliedIds = [];
    let appliedFields = 0;
    let failed = 0;
    let processed = 0;
    const counts = () => ({ projects: projects.length, sources: groups.length, applied: appliedIds.length, failed, pending: projects.length - processed - failed });

    // ---- 0. ACT 5C device correction: reach the Save-capable route FIRST ----
    // Every Save below (the dirty Note guard, resolveSourceDocument's guard and
    // the per-source Save) is refused while the Projects route is active. ONE
    // transition to Journal — the route that owns Save — satisfies the accepted
    // capability policy; it is not a second Save path and it touches no file.
    if (saveCapabilityBlocked()) {
      const capHost = globalThis.MME_WORKSPACE_HOST;
      if (capHost && typeof capHost.switchTo === 'function') {
        let status = '';
        try {
          const r = await capHost.switchTo('journal', { reason: 'projects apply: needs Save capability' });
          status = String((r && r.status) || '') || 'unknown';
        } catch (e) { status = 'failed'; }
        safeLog(`ProjectsApplyBatch: route=journal status=${status}`);
      }
    }

    // ---- 1. dirty Note guard, ONCE, before ANY transition ----
    if (h.isDirty()) {
      const transition = await resolveDirtyNote();
      if (!transition.ok) {
        const code = boundedReason(transition.reason, BOUNDED.DIRTY_NOTE_CANCELED);
        logBatch(BATCH_PHASES.FAILED, { projects: projects.length, sources: groups.length, pending: projects.length }, code, sourceReady);
        return batchResult({ outcome: 'aborted', reason: code, reasonCode: code, pendingProjects: projects.length, sources: groups.length, diagnostics: transition.diagnostics || [] });
      }
    }

    for (let gi = 0; gi < groups.length; gi += 1) {
      const group = groups[gi];
      const groupProjects = Array.isArray(group.projects) ? group.projects : [];
      // 3. Content-proven fast path: when the live buffer already holds every
      // target projectId, the active document IS the target — no navigation is
      // needed. Re-resolution would manufacture an open the owner does not
      // need (and that fixtures legitimately do not provide). Otherwise the
      // group MUST pass through the accepted source-open owner and its
      // source-ready result before any verification.
      let live = h.getMarkdown();
      let allPresent = groupProjects.every((p) => projectIdPresentIn(live, String(p.projectId || '')) === 1);
      if (!allPresent) {
        logBatch(BATCH_PHASES.TRANSITION, counts(), '', false);
        const first = groupProjects[0] || {};
        const resolved = await resolveSourceDocument({
          sourcePath: group.sourcePath || first.sourcePath,
          sourceKind: group.sourceKind || first.sourceKind,
          sourceLine: first.sourceLine,
        });
        if (!resolved.ok) {
          failed += groupProjects.length;
          const code = boundedReason(resolved.reason, BOUNDED.SOURCE_OPEN_FAILED);
          logBatch(BATCH_PHASES.FAILED, counts(), code, false);
          return partialOutcome(code, appliedIds, appliedFields, failed, projects, groups, processed, { diagnostics: resolved.diagnostics || [] });
        }
        // The source-open owner completed its accepted activation sequence
        // (production: buffer installed during openTextDocument, then render()
        // completes with mm.setData/end). Only now is the live buffer read.
        sourceReady = resolved.ready === true;
        logBatch(BATCH_PHASES.SOURCE_READY, counts(), '', sourceReady);
        live = h.getMarkdown();
        // After the confirmed source-ready barrier the projectId MUST be
        // present in LIVE text. Presence (not uniqueness) is judged here: a
        // duplicate is reported precisely by the identity step below. Only a
        // GENUINELY absent id reaches 'project-not-found' — a readiness
        // refusal already returned above with 'source-not-ready'.
        const afterOpen = groupProjects.every((p) => projectIdPresentIn(live, String(p.projectId || '')) >= 1);
        if (!afterOpen) {
          failed += groupProjects.length;
          logBatch(BATCH_PHASES.FAILED, counts(), BOUNDED.PROJECT_NOT_FOUND, sourceReady);
          return partialOutcome(BOUNDED.PROJECT_NOT_FOUND, appliedIds, appliedFields, failed, projects, groups, processed);
        }
      } else {
        // The live buffer already IS the target document: content proof is the
        // readiness signal for this group — no navigation, no path inference,
        // no timeout.
        sourceReady = true;
        logBatch(BATCH_PHASES.SOURCE_READY, counts(), '', true);
      }

      // 4+5. verify identity and compose ALL mutations for this source
      logBatch(BATCH_PHASES.MUTATE, counts());
      let proposed = live;
      const groupOk = [];
      for (const p of groupProjects) {
        const id = String(p.projectId || '');
        if (!id) {
          failed += 1;
          logBatch(BATCH_PHASES.FAILED, counts(), BOUNDED.PROJECT_ID_MISSING, sourceReady);
          return partialOutcome(BOUNDED.PROJECT_ID_MISSING, appliedIds, appliedFields, failed, projects, groups, processed);
        }
        const hits = projectIdPresentIn(proposed, id);
        if (hits !== 1) {
          failed += 1;
          const code = hits === 0 ? BOUNDED.PROJECT_NOT_FOUND : BOUNDED.DUPLICATE_PROJECT_ID;
          logBatch(BATCH_PHASES.FAILED, counts(), code, sourceReady);
          return partialOutcome(code, appliedIds, appliedFields, failed, projects, groups, processed);
        }
        let refused = null;
        for (const op of (p.operations || [])) {
          // The pure owner receives its ACCEPTED request shape: { op, value, ... }.
          const request = op.op
            ? op
            : { op: op.operation, value: op.value, currency: op.currency, quarter: op.quarter };
          let mutation = null;
          try {
            mutation = m.mutateProject(proposed, { projectId: id }, request);
          } catch (e) {
            refused = { ok: false, reason: REASONS.PROJECT_NOT_FOUND, diagnostics: [{ code: 'owner-threw', detail: String(e && e.message ? e.message : e) }] };
            break;
          }
          if (!mutation || mutation.ok === false) {
            refused = mutation || { ok: false, reason: REASONS.PROJECT_NOT_FOUND, diagnostics: [] };
            break;
          }
          if (!mutation.changed) continue;
          proposed = mutation.proposedMarkdown;
        }
        if (refused) {
          failed += 1;
          const code = boundedReason(refused.reason, BOUNDED.MUTATION_FAILED);
          logBatch(BATCH_PHASES.FAILED, counts(), code, sourceReady);
          return partialOutcome(code, appliedIds, appliedFields, failed, projects, groups, processed, { diagnostics: refused.diagnostics || [] });
        }
        groupOk.push({ id, fields: Number(p.fieldCount) || fieldCountOf(p.operations) });
      }
      if (proposed === live) {
        // Nothing to persist for this group: processed, not failed.
        for (const g of groupOk) appliedIds.push(g.id);
        processed += groupProjects.length;
        continue;
      }

      // 6. ONE buffer update + ONE physical Save for this source
      let buffered = false;
      try { buffered = h.applyMarkdown(proposed) !== false; } catch { buffered = false; }
      if (!buffered) {
        failed += groupProjects.length;
        logBatch(BATCH_PHASES.FAILED, counts(), BOUNDED.BUFFER_UPDATE_FAILED, sourceReady);
        return partialOutcome(BOUNDED.BUFFER_UPDATE_FAILED, appliedIds, appliedFields, failed, projects, groups, processed);
      }
      logBatch(BATCH_PHASES.SAVE, counts());
      let saveResult = null;
      try { saveResult = await h.save(); } catch (e) { saveResult = { ok: false, error: String(e && e.message ? e.message : e) }; }
      if (!saveResult || saveResult.ok !== true) {
        failed += groupProjects.length;
        const code = saveResult && saveResult.reason === 'canceled' ? BOUNDED.SAVE_CANCELED : BOUNDED.SAVE_FAILED;
        logBatch(BATCH_PHASES.FAILED, counts(), code, sourceReady);
        // The reconciled buffer stays dirty and understandable; no Index rebuild,
        // no rollback of previously saved independent files, and the run stops.
        return partialOutcome(code, appliedIds, appliedFields, failed, projects, groups, processed, { saveResult });
      }

      for (const g of groupOk) { appliedIds.push(g.id); appliedFields += g.fields; }
      processed += groupProjects.length;

      // 7. Index rebuild only after Save success
      logBatch(BATCH_PHASES.REFRESH, counts());
      try { await h.rebuildIndex(); } catch { /* a failed rebuild never rolls back a real write */ }
    }

    // 10. Return to the Projects route through the accepted Host owner.
    let returned = true;
    try {
      const hostApi = globalThis.MME_WORKSPACE_HOST;
      if (hostApi && typeof hostApi.switchTo === 'function') {
        await hostApi.switchTo('projects', { reason: 'projects apply: return' });
      }
    } catch (e) { returned = false; }
    try {
      if (typeof globalThis.MME_PROJECTS_VIEW?.refreshRoute === 'function') globalThis.MME_PROJECTS_VIEW.refreshRoute();
    } catch {}

    if (!returned) {
      logBatch(BATCH_PHASES.FAILED, counts(), BOUNDED.RETURN_FAILED, sourceReady);
      return partialOutcome(BOUNDED.RETURN_FAILED, appliedIds, appliedFields, failed, projects, groups, processed);
    }
    logBatch(BATCH_PHASES.COMPLETE, counts());
    return batchResult({
      ok: failed === 0 && appliedIds.length > 0,
      outcome: failed ? 'partial' : 'complete',
      reason: failed ? BOUNDED.SAVE_FAILED : '',
      reasonCode: failed ? BOUNDED.SAVE_FAILED : '',
      appliedProjectIds: appliedIds.slice(),
      appliedProjects: appliedIds.length,
      appliedFields,
      failedProjects: failed,
      pendingProjects: 0,
      sources: groups.length,
    });
  }

  globalThis.MME_PROJECT_VISUAL_ADAPTER = Object.freeze({
    REASONS,
    PHASES,
    BATCH_PHASES,
    BOUNDED,
    boundedReason,
    applyProjectFieldChange,
    applyProjectBatch,
    resolveSourceDocument,
    resolveDirtyNote,
    projectIdPresentIn,
  });
})();
