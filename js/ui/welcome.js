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
    const dismissed = localStorage.getItem(WELCOME_STORAGE_KEY);

    // Existing policy preserved: a changed/unseen Welcome content version
    // wins over the dismissed flag; an acknowledged version respects it.
    let show;
    let reason;

    if (storedVersion !== WELCOME_CONTENT_VERSION) {
      show = true;
      reason = storedVersion == null ? 'first-run' : 'version-changed';
    } else if (dismissed === '1') {
      show = false;
      reason = 'explicitly-dismissed';
    } else {
      show = false;
      reason = 'already-seen';
    }

    log?.(
      `Welcome: startup decision show=${show} reason=${reason} contentVersion=${WELCOME_CONTENT_VERSION} seenVersion=${storedVersion ?? 'null'} dismissed=${dismissed ?? 'null'}`
    );

    return show;
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

  // Ensure no stale Help reference stays layered above/beside the hub
  // whenever Welcome is (re)presented, including the Back to Welcome flow.
  try {
    if (typeof globalThis.hideHelpOverlay === 'function') {
      globalThis.hideHelpOverlay();
    }
  } catch {}

  // Apply complete open state consistently.
  overlay.hidden = false;
  overlay.removeAttribute('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  overlay.classList.add('open');
  overlay.style.display = '';
  overlay.style.visibility = '';
  overlay.style.opacity = '';
  overlay.style.pointerEvents = '';

  // Present the hub at its initial scroll position on every re-presentation.
  try {
    overlay.querySelector('.welcomeBody')?.scrollTo?.(0, 0);
  } catch {}

  // Keyboard entry lands on a useful hub control (existing modal grammar).
  try {
    const first = document.getElementById('btnWelcomeContinue');
    if (first && typeof first.focus === 'function') {
      first.focus({ preventScroll: true });
    } else {
      overlay.focus?.();
    }
  } catch {}

  // One concise final-state diagnostic: proves whether the hub is actually
  // visible (not merely un-hidden) after presentation.
  try {
    const cs = globalThis.getComputedStyle?.(overlay);
    const helpEl = document.getElementById('helpOverlay');
    log?.(
      `Welcome: hub shown hidden=${overlay.hidden} ariaHidden=${overlay.getAttribute('aria-hidden')} display=${cs ? cs.display : '(n/a)'} visibility=${cs ? cs.visibility : '(n/a)'} opacity=${cs ? cs.opacity : '(n/a)'} open=${overlay.classList.contains('open')} helpHidden=${helpEl ? helpEl.hidden : '(missing)'}`
    );
  } catch {}

  log?.('Welcome: hub shown');
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
