/**
 * Full screen: the Fullscreen API (with webkit prefixes) plus a landscape
 * orientation lock where supported. iPhone Safari cannot make a page full screen,
 * so there the button opens a short illustrated "Add to Home Screen" guide.
 */
export function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isIphone() {
  return /iPhone|iPod/.test(navigator.userAgent);
}

export function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    !!window.navigator.standalone
  );
}

export function canFullscreen() {
  if (isIphone()) return false; // iPhone Safari: element full screen is video-only
  const root = document.documentElement;
  const enabled = document.fullscreenEnabled ?? document.webkitFullscreenEnabled;
  return !!enabled && !!(root.requestFullscreen || root.webkitRequestFullscreen);
}

export function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

/** Toggle full screen. Returns 'enter' | 'exit' | 'help' | 'standalone'. */
export function toggleFullscreen() {
  if (isStandalone()) return 'standalone';
  if (!canFullscreen()) {
    showFsHelp();
    return 'help';
  }
  const root = document.documentElement;
  if (isFullscreen()) {
    try {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      const r = exit?.call(document);
      r?.catch?.(() => {});
    } catch (_) {
      /* ignore */
    }
    try {
      screen.orientation?.unlock?.();
    } catch (_) {
      /* ignore */
    }
    return 'exit';
  }
  try {
    const req = root.requestFullscreen || root.webkitRequestFullscreen;
    const r = req.call(root, { navigationUI: 'hide' });
    const lock = () => {
      try {
        const p = screen.orientation?.lock?.('landscape');
        p?.catch?.(() => {});
      } catch (_) {
        /* desktop browsers refuse orientation locks */
      }
    };
    if (r && r.then) r.then(lock, () => showFsHelp());
    else lock();
  } catch (_) {
    showFsHelp();
    return 'help';
  }
  return 'enter';
}

export function showFsHelp() {
  const el = document.getElementById('ui-fs-help');
  if (!el) return;
  const ios = isIos();
  el.querySelectorAll('[data-fs-ios]').forEach((n) => (n.hidden = !ios));
  el.querySelectorAll('[data-fs-other]').forEach((n) => (n.hidden = ios));
  el.hidden = false;
  document.documentElement.classList.add('fs-help-open');
  el.querySelector('[data-fs-close]')?.focus?.();
}

export function hideFsHelp() {
  const el = document.getElementById('ui-fs-help');
  if (el) el.hidden = true;
  document.documentElement.classList.remove('fs-help-open');
}

export function fsHelpOpen() {
  const el = document.getElementById('ui-fs-help');
  return !!el && !el.hidden;
}

function syncLabels() {
  const on = isFullscreen();
  document.documentElement.classList.toggle('is-fullscreen', on);
  document.querySelectorAll('[data-ui-fs-label]').forEach((n) => {
    const t = n.querySelector('[data-ui-fs-text]') || n;
    t.textContent = on ? 'Exit full screen' : 'Full screen';
    n.setAttribute('aria-label', on ? 'Exit full screen' : 'Play full screen');
  });
  document.querySelectorAll('[data-ui-fs-icon]').forEach((n) => {
    n.setAttribute('aria-label', on ? 'Exit full screen' : 'Play full screen');
    n.classList.toggle('is-on', on);
  });
}

export function initFullscreen() {
  if (isStandalone()) document.documentElement.classList.add('is-standalone');
  document.addEventListener('fullscreenchange', syncLabels);
  document.addEventListener('webkitfullscreenchange', syncLabels);
  const el = document.getElementById('ui-fs-help');
  if (el) {
    const stop = (e) => e.stopPropagation();
    el.addEventListener('pointerdown', stop);
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.target === el || e.target.closest('[data-fs-close]')) hideFsHelp();
    });
  }
  window.addEventListener('keydown', (e) => {
    if (!fsHelpOpen()) return;
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      hideFsHelp();
    }
  }, true);
  syncLabels();
}
