// @ts-nocheck
// Welcome screen overlay logic.
// Extracted from js/main.js into a standalone UI module.
// ================================
// Welcome Screen
// ================================

const WELCOME_STORAGE_KEY = 'markmap:welcomeDismissed';

function shouldShowWelcome() {
  try {
    return localStorage.getItem(WELCOME_STORAGE_KEY) !== '1';
  } catch {
    return true;
  }
}

function showWelcomeOverlay() {
  const overlay = document.getElementById('welcomeOverlay');

  if (!overlay) {
    log?.('Welcome: overlay missing');
    return;
  }

  overlay.hidden = false;

  try {
    overlay.focus?.();
  } catch {}

  log?.('Welcome: shown');
}

function hideWelcomeOverlay({ remember = true } = {}) {
  const overlay = document.getElementById('welcomeOverlay');

  if (overlay) {
    overlay.hidden = true;
  }

  if (remember) {
    try {
      localStorage.setItem(WELCOME_STORAGE_KEY, '1');
    } catch {}
  }

  log?.('Welcome: hidden');
}

function wireWelcomeOverlay() {
  const overlay = document.getElementById('welcomeOverlay');
  const btnClose = document.getElementById('btnWelcomeClose');
  const btnContinue = document.getElementById('btnWelcomeContinue');

  if (!overlay) {
    log?.('Welcome: wire skipped; overlay missing');
    return;
  }

  if (overlay.__welcomeBound) {
    return;
  }

  function closeWelcome(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    hideWelcomeOverlay({ remember: true });
  }

  btnClose?.addEventListener('click', closeWelcome);
  btnContinue?.addEventListener('click', closeWelcome);

  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeWelcome(event);
    }
  });

  overlay.__welcomeBound = true;

  log?.('Welcome: wired');
}

function maybeShowWelcomeOverlay() {
  wireWelcomeOverlay();

  if (shouldShowWelcome()) {
    showWelcomeOverlay();
  }
}

(function () {
  try {
    window.shouldShowWelcome = shouldShowWelcome;
    window.showWelcomeOverlay = showWelcomeOverlay;
    window.hideWelcomeOverlay = hideWelcomeOverlay;
    window.wireWelcomeOverlay = wireWelcomeOverlay;
    window.maybeShowWelcomeOverlay = maybeShowWelcomeOverlay;
    window.resetWelcomeScreen = function resetWelcomeScreen() {
      try {
        localStorage.removeItem(WELCOME_STORAGE_KEY);
      } catch {}

      showWelcomeOverlay?.();
    };

    globalThis.shouldShowWelcome = shouldShowWelcome;
    globalThis.showWelcomeOverlay = showWelcomeOverlay;
    globalThis.hideWelcomeOverlay = hideWelcomeOverlay;
    globalThis.wireWelcomeOverlay = wireWelcomeOverlay;
    globalThis.maybeShowWelcomeOverlay = maybeShowWelcomeOverlay;
    globalThis.resetWelcomeScreen = window.resetWelcomeScreen;
  } catch {}
})();
