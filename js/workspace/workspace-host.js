// MarmapEditorX3 — Workspace Host Foundation
// Candidate whole-foundation skeleton.
//
// IMPORTANT:
// - This is proposed infrastructure, not automatically approved wiring.
// - It owns workspace lifecycle only.
// - It contains no Journal, editor, sidebar, navigation, or index logic.
// - Repository integration must follow Phase 1 review.

(function initWorkspaceHost(global) {
  'use strict';

  const RESULT_STATUS = Object.freeze({
    ACTIVATED: 'activated',
    DEACTIVATED: 'deactivated',
    REFRESHED: 'refreshed',
    DETACHED: 'detached',
    REGISTERED: 'registered',
    UNREGISTERED: 'unregistered',
    NOOP: 'noop',
    BUSY: 'busy',
    FAILED: 'failed',
  });

  const registry = new Map();
  const sessions = new Map();
  const listeners = new Set();

  let activeWorkspaceId = null;
  let activeTransition = null;
  let transitionCounter = 0;

  function normalizeId(value) {
    return String(value || '').trim();
  }

  function isFunction(value) {
    return typeof value === 'function';
  }

  function cloneSession(value) {
    if (value == null) return value;

    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(value);
      } catch {}
    }

    if (Array.isArray(value)) {
      return value.map(cloneSession);
    }

    if (typeof value === 'object') {
      const clone = {};
      for (const [key, item] of Object.entries(value)) {
        clone[key] = cloneSession(item);
      }
      return clone;
    }

    return value;
  }

  function immutableWorkspaceSummary(workspace) {
    if (!workspace) return null;

    return Object.freeze({
      id: workspace.id,
      title: workspace.title || workspace.id,
      capabilities: Object.freeze({
        refresh: isFunction(workspace.refresh),
        detach: isFunction(workspace.detach),
        session: isFunction(workspace.getState) || isFunction(workspace.restoreState),
      }),
    });
  }

  function snapshot() {
    return Object.freeze({
      activeWorkspaceId,
      activeWorkspace: immutableWorkspaceSummary(registry.get(activeWorkspaceId)),
      registeredWorkspaces: Object.freeze(
        Array.from(registry.values(), immutableWorkspaceSummary)
      ),
      transitionInProgress: Boolean(activeTransition),
      transition: activeTransition
        ? Object.freeze({
            token: activeTransition.token,
            from: activeTransition.from,
            to: activeTransition.to,
            reason: activeTransition.reason,
          })
        : null,
    });
  }

  function notify() {
    const state = snapshot();

    for (const listener of Array.from(listeners)) {
      try {
        listener(state);
      } catch (error) {
        console.error('MME_WORKSPACE_HOST subscriber failed:', error);
      }
    }
  }

  function result(status, details = {}) {
    return Object.freeze({
      status,
      workspaceId: details.workspaceId || null,
      previousWorkspaceId: details.previousWorkspaceId || null,
      error: details.error || null,
      value: details.value,
    });
  }

  function assertWorkspaceDescriptor(workspace) {
    if (!workspace || typeof workspace !== 'object') {
      throw new TypeError('Workspace descriptor must be an object');
    }

    const id = normalizeId(workspace.id);
    if (!id) {
      throw new Error('Workspace id is required');
    }

    if (!isFunction(workspace.activate)) {
      throw new Error(`Workspace "${id}" must implement activate(context)`);
    }

    return id;
  }

  function createContext(reason, previousWorkspaceId, nextWorkspaceId, extra = {}) {
    return Object.freeze({
      reason: String(reason || 'workspace lifecycle'),
      previousWorkspaceId: previousWorkspaceId || null,
      nextWorkspaceId: nextWorkspaceId || null,
      host: api,
      ...extra,
    });
  }

  async function captureSession(workspace) {
    if (!workspace || !isFunction(workspace.getState)) return undefined;

    const state = await workspace.getState();
    const safeState = cloneSession(state);
    sessions.set(workspace.id, safeState);
    return safeState;
  }

  async function restoreSession(workspace, context) {
    if (!workspace || !isFunction(workspace.restoreState)) return;
    if (!sessions.has(workspace.id)) return;

    await workspace.restoreState(cloneSession(sessions.get(workspace.id)), context);
  }

  function register(workspace, options = {}) {
    const id = assertWorkspaceDescriptor(workspace);
    const replace = options.replace === true;

    if (registry.has(id) && !replace) {
      throw new Error(`Workspace already registered: ${id}`);
    }

    if (activeWorkspaceId === id && replace) {
      throw new Error(`Cannot replace active workspace: ${id}`);
    }

    workspace.id = id;
    registry.set(id, workspace);
    notify();

    return result(RESULT_STATUS.REGISTERED, {
      workspaceId: id,
      value: immutableWorkspaceSummary(workspace),
    });
  }

  function unregister(workspaceId) {
    const id = normalizeId(workspaceId);

    if (!registry.has(id)) {
      return result(RESULT_STATUS.NOOP, { workspaceId: id || null });
    }

    if (activeWorkspaceId === id) {
      return result(RESULT_STATUS.FAILED, {
        workspaceId: id,
        error: new Error(`Cannot unregister active workspace: ${id}`),
      });
    }

    registry.delete(id);
    sessions.delete(id);
    notify();

    return result(RESULT_STATUS.UNREGISTERED, { workspaceId: id });
  }

  async function switchTo(workspaceId, options = {}) {
    const targetId = normalizeId(workspaceId);
    const target = registry.get(targetId);

    if (!target) {
      return result(RESULT_STATUS.FAILED, {
        workspaceId: targetId || null,
        previousWorkspaceId: activeWorkspaceId,
        error: new Error(`Workspace not found: ${targetId}`),
      });
    }

    if (activeTransition) {
      return result(RESULT_STATUS.BUSY, {
        workspaceId: targetId,
        previousWorkspaceId: activeWorkspaceId,
      });
    }

    if (activeWorkspaceId === targetId) {
      if (options.refreshCurrent === true && isFunction(target.refresh)) {
        return refresh({
          reason: options.reason || 'workspace reactivated',
          ...options.context,
        });
      }

      return result(RESULT_STATUS.NOOP, {
        workspaceId: targetId,
        previousWorkspaceId: activeWorkspaceId,
        value: target,
      });
    }

    const previousId = activeWorkspaceId;
    const previous = registry.get(previousId) || null;
    const token = ++transitionCounter;
    const reason = String(options.reason || 'workspace switch');

    activeTransition = {
      token,
      from: previousId,
      to: targetId,
      reason,
    };
    notify();

    const transitionContext = createContext(
      reason,
      previousId,
      targetId,
      options.context || {}
    );

    let previousDeactivated = false;

    try {
      if (previous) {
        await captureSession(previous);

        if (isFunction(previous.deactivate)) {
          await previous.deactivate(transitionContext);
        }

        previousDeactivated = true;
      }

      await restoreSession(target, transitionContext);
      await target.activate(transitionContext);

      if (!activeTransition || activeTransition.token !== token) {
        throw new Error('Workspace transition ownership was lost');
      }

      activeWorkspaceId = targetId;

      return result(RESULT_STATUS.ACTIVATED, {
        workspaceId: targetId,
        previousWorkspaceId: previousId,
        value: target,
      });
    } catch (error) {
      if (previous && previousDeactivated) {
        try {
          const rollbackContext = createContext(
            'workspace activation rollback',
            targetId,
            previousId,
            { cause: error }
          );

          await restoreSession(previous, rollbackContext);
          await previous.activate(rollbackContext);
          activeWorkspaceId = previousId;
        } catch (rollbackError) {
          console.error('MME_WORKSPACE_HOST rollback failed:', rollbackError);
        }
      }

      return result(RESULT_STATUS.FAILED, {
        workspaceId: targetId,
        previousWorkspaceId: previousId,
        error,
      });
    } finally {
      if (activeTransition && activeTransition.token === token) {
        activeTransition = null;
        notify();
      }
    }
  }

  async function deactivate(options = {}) {
    if (activeTransition) {
      return result(RESULT_STATUS.BUSY, {
        workspaceId: activeWorkspaceId,
      });
    }

    const currentId = activeWorkspaceId;
    const current = registry.get(currentId);

    if (!current) {
      return result(RESULT_STATUS.NOOP);
    }

    const token = ++transitionCounter;
    activeTransition = {
      token,
      from: currentId,
      to: null,
      reason: String(options.reason || 'workspace deactivate'),
    };
    notify();

    try {
      await captureSession(current);

      if (isFunction(current.deactivate)) {
        await current.deactivate(
          createContext(activeTransition.reason, currentId, null, options.context || {})
        );
      }

      activeWorkspaceId = null;
      return result(RESULT_STATUS.DEACTIVATED, {
        workspaceId: currentId,
        previousWorkspaceId: currentId,
      });
    } catch (error) {
      return result(RESULT_STATUS.FAILED, {
        workspaceId: currentId,
        previousWorkspaceId: currentId,
        error,
      });
    } finally {
      if (activeTransition && activeTransition.token === token) {
        activeTransition = null;
        notify();
      }
    }
  }

  async function refresh(context = {}) {
    const current = registry.get(activeWorkspaceId);

    if (!current) return result(RESULT_STATUS.NOOP);
    if (!isFunction(current.refresh)) {
      return result(RESULT_STATUS.NOOP, { workspaceId: current.id });
    }

    try {
      const value = await current.refresh(
        createContext(
          context.reason || 'workspace refresh',
          activeWorkspaceId,
          activeWorkspaceId,
          context
        )
      );

      return result(RESULT_STATUS.REFRESHED, {
        workspaceId: current.id,
        value,
      });
    } catch (error) {
      return result(RESULT_STATUS.FAILED, {
        workspaceId: current.id,
        error,
      });
    }
  }

  async function detach(context = {}) {
    const current = registry.get(activeWorkspaceId);

    if (!current) return result(RESULT_STATUS.NOOP);
    if (!isFunction(current.detach)) {
      return result(RESULT_STATUS.NOOP, { workspaceId: current.id });
    }

    try {
      const value = await current.detach(
        createContext(
          context.reason || 'workspace detach',
          activeWorkspaceId,
          activeWorkspaceId,
          context
        )
      );

      return result(RESULT_STATUS.DETACHED, {
        workspaceId: current.id,
        value,
      });
    } catch (error) {
      return result(RESULT_STATUS.FAILED, {
        workspaceId: current.id,
        error,
      });
    }
  }

  function subscribe(listener) {
    if (!isFunction(listener)) {
      throw new TypeError('MME_WORKSPACE_HOST.subscribe expects a function');
    }

    listeners.add(listener);

    try {
      listener(snapshot());
    } catch (error) {
      console.error('MME_WORKSPACE_HOST initial subscriber call failed:', error);
    }

    return function unsubscribe() {
      listeners.delete(listener);
    };
  }

  const api = Object.freeze({
    RESULT_STATUS,
    register,
    unregister,
    has: (id) => registry.has(normalizeId(id)),
    get: (id) => registry.get(normalizeId(id)) || null,
    list: () => Object.freeze(Array.from(registry.values(), immutableWorkspaceSummary)),
    getActive: () => registry.get(activeWorkspaceId) || null,
    getActiveId: () => activeWorkspaceId,
    getSession: (id) => cloneSession(sessions.get(normalizeId(id))),
    getSnapshot: snapshot,
    isTransitionInProgress: () => Boolean(activeTransition),
    subscribe,
    activate: switchTo,
    switchTo,
    deactivate,
    refresh,
    detach,
  });

  global.MME_WORKSPACE_HOST = api;
})(globalThis);
