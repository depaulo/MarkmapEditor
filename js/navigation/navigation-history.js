// MarmapEditorX3 — Navigation History V1
// Standalone state/transaction module. Repository wiring is intentionally external.
// This file does not read files, parse Markdown, or manipulate workspace panels.
(function initNavigationHistory(global) {
  'use strict';

  const TYPE_WORKSPACE_FILE = 'workspace-file';
  const VALID_MODES = new Set(['normal', 'restore', 'seed']);
  const listeners = new Set();

  let currentLocation = null;
  let backStack = [];
  let forwardStack = [];
  let navigationInProgress = false;
  let openLocation = null;
  let generation = 0;
  let activeOperation = null;
  let operationCounter = 0;

  function normalizePath(value) {
    return String(value || '')
      .trim()
      .replace(/\\/g, '/')
      .replace(/^\.\//, '')
      .replace(/\/{2,}/g, '/');
  }

  function normalizeLocation(input) {
    if (!input || typeof input !== 'object') return null;

    const type = String(input.type || TYPE_WORKSPACE_FILE).trim();
    const path = normalizePath(input.path || input.id || '');
    if (type !== TYPE_WORKSPACE_FILE || !path) return null;

    return Object.freeze({
      type,
      path,
      kind: String(input.kind || '').trim(),
      name: String(input.name || path.split('/').pop() || '').trim(),
      source: String(input.source || '').trim(),
    });
  }

  function sameLocation(a, b) {
    if (!a || !b) return false;
    return a.type === b.type && normalizePath(a.path) === normalizePath(b.path);
  }

  function cloneLocation(location) {
    return location ? { ...location } : null;
  }

  function snapshot() {
    return Object.freeze({
      current: cloneLocation(currentLocation),
      back: Object.freeze(backStack.map(cloneLocation)),
      forward: Object.freeze(forwardStack.map(cloneLocation)),
      canBack: backStack.length > 0 && !navigationInProgress,
      canForward: forwardStack.length > 0 && !navigationInProgress,
      navigationInProgress,
    });
  }

  function notify() {
    const state = snapshot();
    for (const listener of [...listeners]) {
      try {
        listener(state);
      } catch (error) {
        console.error('MME_NAVIGATION subscriber failed:', error);
      }
    }
  }

  function makeResult(status, location = null, error = null) {
    return Object.freeze({
      status,
      location: cloneLocation(location),
      error: error || null,
    });
  }

  function normalizeOpenResult(result, target) {
    if (result && ['opened', 'cancelled', 'failed', 'noop'].includes(result.status)) {
      return makeResult(result.status, result.location || target, result.error || null);
    }
    if (result === null || result === false) {
      return makeResult('cancelled', target);
    }
    if (result) {
      return makeResult('opened', target);
    }
    return makeResult('failed', target, new Error('Navigation opener returned no result'));
  }

  async function attemptOpen(target, mode) {
    if (typeof openLocation !== 'function') {
      return makeResult('failed', target, new Error('Navigation opener is not configured'));
    }

    try {
      const result = await openLocation(cloneLocation(target), {
        historyMode: mode,
      });
      return normalizeOpenResult(result, target);
    } catch (error) {
      return makeResult('failed', target, error);
    }
  }

  function setOpener(opener) {
    if (typeof opener !== 'function') {
      throw new TypeError('MME_NAVIGATION.setOpener expects a function');
    }
    openLocation = opener;
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('MME_NAVIGATION.subscribe expects a function');
    }
    listeners.add(listener);
    listener(snapshot());
    return function unsubscribe() {
      listeners.delete(listener);
    };
  }

  function clear() {
    generation++;
    currentLocation = null;
    backStack = [];
    forwardStack = [];
    navigationInProgress = false;
    activeOperation = null;
    notify();
    return snapshot();
  }

  function seed(location) {
    const target = normalizeLocation(location);
    if (!target) return makeResult('failed', null, new Error('Invalid seed location'));

    generation++;
    currentLocation = target;
    backStack = [];
    forwardStack = [];
    navigationInProgress = false;
    activeOperation = null;
    notify();
    return makeResult('opened', target);
  }

  function recordSuccessfulNavigation(location, options = {}) {
    const mode = VALID_MODES.has(options.historyMode) ? options.historyMode : 'normal';
    const target = normalizeLocation(location);
    if (!target) return makeResult('failed', null, new Error('Invalid navigation location'));

    if (mode === 'seed') return seed(target);
    if (mode === 'restore') {
      // Back/Forward own restore stack commits. External callers must not mutate them.
      currentLocation = target;
      notify();
      return makeResult('opened', target);
    }

    if (sameLocation(currentLocation, target)) {
      return makeResult('noop', currentLocation);
    }

    if (currentLocation) backStack.push(currentLocation);
    currentLocation = target;
    forwardStack = [];
    notify();
    return makeResult('opened', target);
  }

  async function restore(direction) {
    if (navigationInProgress) return makeResult('noop', currentLocation);

    const sourceStack = direction === 'back' ? backStack : forwardStack;
    if (!sourceStack.length) return makeResult('noop', currentLocation);

    const target = sourceStack[sourceStack.length - 1];
    const previousCurrent = currentLocation;
    const token = ++operationCounter;
    const capturedGeneration = generation;

    activeOperation = token;
    navigationInProgress = true;
    notify();

    try {
      const result = await attemptOpen(target, 'restore');
      if (activeOperation !== token) return makeResult('cancelled', target);
      if (capturedGeneration !== generation) return makeResult('cancelled', target);
      if (result.status !== 'opened') return result;

      sourceStack.pop();
      if (previousCurrent) {
        if (direction === 'back') forwardStack.push(previousCurrent);
        else backStack.push(previousCurrent);
      }
      currentLocation = target;
      return makeResult('opened', target);
    } finally {
      if (activeOperation === token) {
        navigationInProgress = false;
        activeOperation = null;
        notify();
      }
    }
  }

  function back() {
    return restore('back');
  }

  function forward() {
    return restore('forward');
  }

  const api = Object.freeze({
    TYPE_WORKSPACE_FILE,
    normalizeLocation,
    sameLocation,
    setOpener,
    subscribe,
    clear,
    seed,
    recordSuccessfulNavigation,
    back,
    forward,
    canBack: () => backStack.length > 0 && !navigationInProgress,
    canForward: () => forwardStack.length > 0 && !navigationInProgress,
    getCurrent: () => cloneLocation(currentLocation),
    getSnapshot: snapshot,
    isNavigationInProgress: () => navigationInProgress,
  });

  global.MME_NAVIGATION = api;
})(globalThis);