// @ts-nocheck
// Welcome screen overlay logic.
// Extracted from js/main.js into a standalone UI module.
// ================================
// Welcome Screen
// ================================

const WELCOME_STORAGE_KEY = 'markmap:welcomeDismissed';
const WELCOME_VERSION_KEY = 'mme:welcomeVersionSeen';
const WELCOME_CONTENT_VERSION = '2026-07-v1';

function shouldShowWelcome() {
  try {
    const storedVersion = localStorage.getItem(WELCOME_VERSION_KEY);
    if (storedVersion !== WELCOME_CONTENT_VERSION) {
      log?.(`Welcome: startup decision show=true reason=version-changed key=${WELCOME_VERSION_KEY} value=${storedVersion}`);
      return true;
    }
    const dismissed = localStorage.getItem(WELCOME_STORAGE_KEY);
    if (dismissed === '1') {
      log?.(`Welcome: startup decision show=false reason=explicitly-dismissed key=${WELCOME_STORAGE_KEY} value=${dismissed}`);
      return false;
    }
    log?.(`Welcome: startup decision show=false reason=already-seen key=${WELCOME_VERSION_KEY} value=${storedVersion}`);
    return false;
  } catch {
    log?.('Welcome: startup decision show=true reason=storage-error');
    return true;
  }
}

function showWelcomeOverlay() {
  const overlay = document.getElementById('welcomeOverlay');

  if (!overlay) {
    log?.('Welcome: overlay missing');
    return;
  }

  // Apply complete open state consistently.
  overlay.hidden = false;
  overlay.removeAttribute('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  overlay.classList.add('open');
  overlay.style.display = '';
  overlay.style.visibility = '';
  overlay.style.opacity = '';
  overlay.style.pointerEvents = '';

  try {
    overlay.focus?.();
  } catch {}

  log?.('Welcome: shown');
}

function hideWelcomeOverlay({ remember = true } = {}) {
  const overlay = document.getElementById('welcomeOverlay');

  if (overlay) {
    overlay.hidden = true;
    overlay.removeAttribute('aria-hidden');
    overlay.classList.remove('open');
  }

  if (remember) {
    try {
      localStorage.setItem(WELCOME_STORAGE_KEY, '1');
      localStorage.setItem(WELCOME_VERSION_KEY, WELCOME_CONTENT_VERSION);
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

  // Welcome reference shortcuts -> reuse Help modal for the requested context.
  document.querySelectorAll('.welcomeReferenceBtn').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const ctx = btn.dataset.helpContext || 'editor';

      // UX-MODE1.2: hide Welcome before showing Help to avoid overlap.
      // Use requestAnimationFrame to avoid click-through overlapping overlays.
      hideWelcomeOverlay({ remember: false });

      requestAnimationFrame(() => {
        try {
          globalThis.showHelpForContext?.(ctx, { origin: 'welcome' });
        } catch {}
      });

      log?.(`Welcome: reference requested context=${ctx}`);
    });
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
        localStorage.removeItem(WELCOME_VERSION_KEY);
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
