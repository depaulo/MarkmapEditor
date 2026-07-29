// @ts-nocheck
// Phase 3B — Journal Workspace Adapter
// Authority-transfer adapter. Calls WORKSPACE_API.initializeJournal() during activation.

(function initJournalWorkspace() {
  'use strict';

  const HOST_ID = 'journal';
  const HOST_TITLE = 'Journal';

  let journalWorkspaceRegistered = false;
  let phase3BDiagnosticReported = false;
  let activationAttempted = false;

  function safeLog(message) {
    try {
      if (typeof globalThis.MME_APP?.log === 'function') {
        globalThis.MME_APP.log(message);
      }
    } catch {}
  }

  function isJournalInitialized() {
    try {
      return typeof globalThis.WORKSPACE_API?.isJournalInitialized === 'function'
        ? Boolean(globalThis.WORKSPACE_API.isJournalInitialized())
        : false;
    } catch {
      return false;
    }
  }

  function getJournalInitializationState() {
    try {
      return typeof globalThis.WORKSPACE_API?.getJournalInitializationState === 'function'
        ? String(globalThis.WORKSPACE_API.getJournalInitializationState())
        : 'not-started';
    } catch {
      return 'not-started';
    }
  }

  function getJournalInitializationCount() {
    try {
      return typeof globalThis.WORKSPACE_API?.getJournalInitializationCount === 'function'
        ? Number(globalThis.WORKSPACE_API.getJournalInitializationCount())
        : 0;
    } catch {
      return 0;
    }
  }

  function buildDescriptor() {
    return Object.freeze({
      id: HOST_ID,
      title: HOST_TITLE,
      activate: activate,
      deactivate: deactivate,
      refresh: refresh,
      detach: detach,
      getState: getState,
      restoreState: restoreState,
    });
  }

  async function registerJournalWorkspace() {
    if (journalWorkspaceRegistered) return null;
    if (typeof globalThis.MME_WORKSPACE_HOST !== 'object') return null;

    const descriptor = buildDescriptor();

    try {
      const result = globalThis.MME_WORKSPACE_HOST.register(descriptor);
      journalWorkspaceRegistered = true;
      safeLog('WorkspaceHost Phase3B: journal workspace registered');
      return result;
    } catch (e) {
      safeLog(`WorkspaceHost Phase3B: registration failed: ${e?.message || e}`);
      return null;
    }
  }

  async function requestHostActivation() {
    if (activationAttempted) return;
    if (typeof globalThis.MME_WORKSPACE_HOST !== 'object') return;
    if (typeof globalThis.MME_APP !== 'object') return;
    if (typeof globalThis.WORKSPACE_API?.initializeJournal !== 'function') return;

    activationAttempted = true;

    try {
      const result = await globalThis.MME_WORKSPACE_HOST.activate(HOST_ID, {
        reason: 'legacy journal initialization acknowledged',
      });

      const activated =
        result &&
        typeof result === 'object' &&
        result.status === globalThis.MME_WORKSPACE_HOST.RESULT_STATUS.ACTIVATED;

      if (activated) {
        safeLog('WorkspaceHost Phase3B: journal workspace activated');
        reportPhase3BDiagnostic();
      } else {
        safeLog(`WorkspaceHost Phase3B: activation unexpected result: ${result?.status || 'unknown'}`);
      }
    } catch (e) {
      safeLog(`WorkspaceHost Phase3B: activation failed state=${getJournalInitializationState()} count=${getJournalInitializationCount()} error=${e?.message || e}`);
    }
  }

  async function activate(context) {
    const nextId = context?.nextWorkspaceId;
    if (nextId !== HOST_ID) {
      throw new Error(`JournalWorkspace.activate: unexpected nextWorkspaceId=${nextId}`);
    }

    if (typeof globalThis.WORKSPACE_API?.initializeJournal !== 'function') {
      throw new Error('JournalWorkspace.activate: WORKSPACE_API.initializeJournal not available');
    }

    const result = globalThis.WORKSPACE_API.initializeJournal();

    if (result.status === 'failed') {
      const error =
        result.error instanceof Error
          ? result.error
          : new Error(`Journal initialization failed: ${String(result.error || 'unknown')}`);
      throw error;
    }

    if (result.status === 'busy') {
      throw new Error('JournalWorkspace.activate: initialization already in progress');
    }

    if (result.status !== 'initialized' && result.status !== 'noop') {
      throw new Error(`JournalWorkspace.activate: unexpected status ${result.status}`);
    }

    if (!result.initialized) {
      throw new Error('JournalWorkspace.activate: Journal not initialized');
    }

    if (result.initializationState !== 'initialized') {
      throw new Error(`JournalWorkspace.activate: unexpected initializationState ${result.initializationState}`);
    }

    if (result.initializationCount !== 1) {
      throw new Error(`JournalWorkspace.activate: unexpected initializationCount ${result.initializationCount}`);
    }

    return Object.freeze({
      acknowledged: true,
      adapterCalledInit: true,
      initializationState: result.initializationState,
      initializationCount: result.initializationCount,
    });
  }

  function deactivate() {
    // Phase 3B safe no-op.
    return Object.freeze({ status: 'noop' });
  }

  function refresh() {
    // Phase 3B safe no-op.
    return Object.freeze({ status: 'noop' });
  }

  function detach() {
    // Phase 3B unsupported/no-op.
    return Object.freeze({ status: 'unsupported' });
  }

  function getState() {
    return Object.freeze({
      initialized: isJournalInitialized(),
      initializationState: getJournalInitializationState(),
      initializationCount: getJournalInitializationCount(),
    });
  }

  function restoreState() {
    // Phase 3B safe no-op.
  }

  function reportPhase3BDiagnostic() {
    if (phase3BDiagnosticReported) return;
    if (typeof globalThis.MME_APP?.log !== 'function') return;
    if (typeof globalThis.MME_WORKSPACE_HOST !== 'object') return;

    const activeId = globalThis.MME_WORKSPACE_HOST.getActiveId();
    const registered = globalThis.MME_WORKSPACE_HOST.list();
    const transitionInProgress = globalThis.MME_WORKSPACE_HOST.isTransitionInProgress();

    const activeLabel = activeId ? String(activeId) : '(none)';
    const registeredLabel = String(registered.length);
    const transitionLabel = transitionInProgress ? 'true' : 'false';
    const journalInitializedLabel = isJournalInitialized() ? 'true' : 'false';
    const initializationStateLabel = getJournalInitializationState();
    const initializationCountLabel = String(getJournalInitializationCount());
    const hostCalledAdapterLabel = 'true';
    const adapterCalledInitializeLabel = 'true';
    const legacyAutoInitLabel = 'false';

    globalThis.MME_APP.log(
      `WorkspaceHost Phase3B: ready=true active=${activeLabel} registered=${registeredLabel} transition=${transitionLabel} journalInitialized=${journalInitializedLabel} initializationState=${initializationStateLabel} initializationCount=${initializationCountLabel} hostCalledAdapter=${hostCalledAdapterLabel} adapterCalledInitialize=${adapterCalledInitializeLabel} legacyAutoInit=${legacyAutoInitLabel}`
    );

    phase3BDiagnosticReported = true;
  }

  // Orchestrate registration and readiness-aware activation.
  const registrationResult = registerJournalWorkspace();
  if (registrationResult) {
    if (typeof globalThis.MME_APP === 'object' && typeof globalThis.WORKSPACE_API?.initializeJournal === 'function') {
      requestHostActivation();
    } else {
      window.addEventListener('mme-main-ready', requestHostActivation, { once: true });
    }
  }
})();