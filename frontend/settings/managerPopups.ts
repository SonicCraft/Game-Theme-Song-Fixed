import { setCacheWindowOpen, setLibWindowOpen, setMainWindowOpen } from '../core/engine';

export type ManagerPopup = 'library' | 'cache' | 'main';

let open: Record<ManagerPopup, boolean> = { library: false, cache: false, main: false };
let listeners: ((state: Record<ManagerPopup, boolean>) => void)[] = [];

function publish() {
  const snapshot = { ...open };
  for (const fn of listeners) fn(snapshot);
}

export function subscribeManagerPopups(fn: (state: Record<ManagerPopup, boolean>) => void): () => void {
  listeners.push(fn);
  return () => { listeners = listeners.filter((x) => x !== fn); };
}

export function openManagerPopup(kind: ManagerPopup): void {
  if (open[kind]) {
    if (kind === 'main') {
      try { gtsReturnToNowPlaying?.(); } catch (e) { console.warn('[Game Theme Song] Could not select Now Playing', e); }
      focusExistingMainManager();
    }
    return;
  }
  open = { ...open, [kind]: true };
  if (kind === 'library') setLibWindowOpen(true);
  if (kind === 'cache') setCacheWindowOpen(true);
  if (kind === 'main') setMainWindowOpen(true);
  publish();
}

export function closeManagerPopup(kind: ManagerPopup): void {
  if (!open[kind]) return;
  open = { ...open, [kind]: false };
  if (kind === 'library') setLibWindowOpen(false);
  if (kind === 'cache') setCacheWindowOpen(false);
  if (kind === 'main') setMainWindowOpen(false);
  publish();
}
// v17: Track the actual Steam dialog DOM so a second click raises it, without
// reopening it or changing the stable v16.4 game-page button integration.
let mainManagerElement: HTMLElement | null = null;
export function setMainManagerElement(element: HTMLElement | null): void {
  mainManagerElement = element;
}

function focusExistingMainManager(): void {
  let targetWindow: Window | null = null;
  try {
    const element = mainManagerElement;
    if (element?.isConnected) targetWindow = element.ownerDocument.defaultView;
    // Steam occasionally moves dialogs between documents. Re-find the tagged
    // popup if the original ref is no longer usable.
    const popups = (window as any).g_PopupManager?.GetPopups?.() ?? [];
    for (const popup of popups) {
      const doc: Document | undefined = popup?.m_popup?.document ?? popup?.window?.document;
      if (!doc?.querySelector?.('[data-gts-main-manager-v17]')) continue;
      targetWindow = doc.defaultView ?? popup?.window ?? targetWindow;
      break;
    }
    if (!targetWindow || targetWindow.closed) {
      console.info('[Game Theme Song v17] Manager window not yet available to focus');
      return;
    }
    // A user-initiated note click is permitted to request focus. Avoid
    // constructing a NEW window or changing the popup-open state.
    targetWindow.focus();
    try {
      const steamWindow = (targetWindow as any).SteamClient?.Window;
      if (typeof steamWindow?.SetKeyFocus === 'function') steamWindow.SetKeyFocus(true);
    } catch { /* native focus is optional across Steam versions */ }
    console.info('[Game Theme Song v17] Focused existing manager window');
  } catch (error) {
    console.warn('[Game Theme Song v17] Could not focus existing manager:', error);
  }
}

// v20.10: only the mounted main manager owns the tab state. Calling the note
// again requests its Now Playing tab and then focuses the existing window.
let gtsReturnToNowPlaying: (() => void) | null = null;
export function registerGtsReturnToNowPlaying(callback: (() => void) | null): void {
  gtsReturnToNowPlaying = callback;
}
