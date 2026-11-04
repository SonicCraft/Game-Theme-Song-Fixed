import { Millennium, findModule } from 'millennium';
import { openManagerPopup } from '../settings/managerPopups';

/**
 * Game Theme Song v16.4 — Steam Library music-note entry point.
 *
 * Uses the same Millennium.AddWindowCreateHook(context) contract as the
 * working ProtonDB Status extension (context.m_strName / m_popup.document).
 * Unlike v12-v14, we do not guess Steam's popup ID or rely on popup.window.name.
 */
const NOTE_ID = 'gts-game-page-music-note-v16-4';
const SVG_NS = 'http://www.w3.org/2000/svg';

// Steam's Library DOM emits many mutations during updates. Keep one fast,
// coalesced response to changes, but cap full DOM synchronization under churn.
// The periodic fallback only recovers missed window hooks/DOM transitions.
const WINDOW_SCAN_INTERVAL_MS = 3000;
const MUTATION_COALESCE_MS = 100;
const MIN_DOM_SYNC_GAP_MS = 250;
// Briefly missing from popup enumeration does not mean a window has closed.
// Only prune documents previously seen in the popup manager after repeated misses.
const MISSING_POPUP_SCAN_GRACE = 3;
// Trigger a single prompt scan when the native action bar actually appears;
// unrelated Steam DOM churn still follows the 250ms coalescing path.
const NATIVE_HOST_SELECTOR = '[class*="AppButtonsContainer"], [class*="MenuButtonContainer"], [class*="GameStatsSection"]';

type DocumentState = {
  doc: Document;
  name: string;
  observer: MutationObserver | null;
  buttons: Map<HTMLElement, HTMLElement>;
  pendingSync: ReturnType<typeof setTimeout> | null;
  pendingUrgent: boolean;
  lastSyncedAt: number;
  observedInPopupManager: boolean;
  missingPopupScans: number;
  exitListener: { view: Window; handler: EventListener } | null;
  requestSync(urgent?: boolean): void;
  stop(): void;
  sync(): void;
};
const tracked = new Map<Document, DocumentState>();
let enabled = false;
let timer: ReturnType<typeof setInterval> | null = null;
let hookInstalled = false;
let previousDiagnostic = '';

function diagnostic(message: string): void {
  if (previousDiagnostic === message) return;
  previousDiagnostic = message;
  console.info('[Game Theme Song v16.4 button]', message);
}

/**
 * Desktop-only music-note entry point (v21.3.8).
 * Big Picture deliberately has no Game Theme Song button. Never attach an
 * observer, floating button, popup handler or controller listener to its UI.
 * Theme playback itself is independent of this frontend button.
 */
function isBigPictureDocument(doc: Document, name: string): boolean {
  if (/(?:^|[\s_-])(?:BPM|BigPicture|GamepadUI|SteamDeck)(?:[\s_-]|$)/i.test(name)) return true;
  try {
    const url = String(doc.defaultView?.location?.href ?? '');
    return /(?:bigpicture|gamepadui|steamdeck)/i.test(url);
  } catch { return false; }
}

function currentGameId(doc: Document): number | null {
  // Same route source as working ProtonDB Status's desktop detection.
  const w = window as any;
  const route = w.MainWindowBrowserManager?.m_lastLocation?.pathname ??
    (typeof w.MainWindowBrowserManager?.m_lastLocation === 'string'
      ? w.MainWindowBrowserManager.m_lastLocation : null) ??
    (doc.defaultView as any)?.MainWindowBrowserManager?.m_lastLocation?.pathname;
  const match = typeof route === 'string' ? route.match(/\/library\/app\/(\d+)(?:\b|\/|$)/) : null;
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function findSteamClasses(predicate: (module: any) => boolean): Record<string, string> | null {
  try {
    const module = findModule(predicate);
    if (module) return module as Record<string, string>;
  } catch { /* Steam's webpack runtime may not expose this module yet */ }
  try {
    const api = (window as any).MILLENNIUM_API;
    return typeof api?.findClassModule === 'function'
      ? api.findClassModule(predicate) ?? null : null;
  } catch { return null; }
}

type ButtonHost = { parent: HTMLElement; floating: boolean; stats: boolean };

/**
 * Steam renders two action bars on game pages: the expanded play bar and its
 * compact/sticky counterpart. Earlier versions called .item(0), so only one
 * bar got a music note. Return every matching bar, keyed by DOM element.
 */
function findHosts(doc: Document): ButtonHost[] {
  const hosts = new Map<HTMLElement, ButtonHost>();
  const add = (element: Element | null | undefined, stats = false): void => {
    if (!(element instanceof (doc.defaultView?.HTMLElement ?? HTMLElement)) || !element.isConnected) return;
    const parent = element as HTMLElement;
    if (!hosts.has(parent)) hosts.set(parent, { parent, floating: false, stats });
  };

  const actions = findSteamClasses((m: any) => Boolean(m?.AppButtonsContainer));
  if (typeof actions?.AppButtonsContainer === 'string') {
    for (const element of Array.from(doc.getElementsByClassName(actions.AppButtonsContainer))) add(element);
  }

  // Some Steam versions style compact action buttons using a separate menu
  // container. Find the rows containing at least two native menu buttons.
  // This is intentionally restricted to Steam's discovered CSS module rather
  // than scanning arbitrary game-page buttons.
  const menus = hosts.size < 2
    ? findSteamClasses((m: any) => Boolean(m?.MenuButtonContainer && m?.MenuButton))
    : null;
  if (typeof menus?.MenuButtonContainer === 'string') {
    for (const item of Array.from(doc.getElementsByClassName(menus.MenuButtonContainer))) {
      const row = item.parentElement;
      if (!row?.isConnected || row.children.length < 2) continue;
      const siblings = Array.from(row.children).filter(child =>
        child.classList.contains(menus.MenuButtonContainer));
      if (siblings.length < 2) continue;
      add(row);
    }
  }

  if (hosts.size === 0) {
    // Original fallback remains available if both Steam button rows change.
    const stats = findSteamClasses((m: any) => Boolean(m?.GameStat && m?.PlayBarLabel));
    if (typeof stats?.GameStatsSection === 'string') {
      for (const element of Array.from(doc.getElementsByClassName(stats.GameStatsSection))) add(element, true);
    }
  }
  if (hosts.size === 0) {
    const icon = doc.querySelector('[class*="SVGIcon_PlayTime"], .SVGIcon_PlayTime');
    const row = icon?.parentElement?.parentElement?.parentElement;
    if (row) add(row, true);
  }
  if (hosts.size === 0 && doc.body) {
    return [{ parent: doc.body, floating: true, stats: false }];
  }
  return [...hosts.values()];
}

/**
 * Steam's Library utility icons are generally NOT HTML <button> elements.
 * The original upstream MusicButtonHook uses:
 *   <div className={MenuButtonContainer}>
 *     <div className={MenuButton} role="button">...</div>
 *   </div>
 * The v16.3 DOM clone missed these because it queried for <button> only.
 */
type NativeReference = { wrapper: HTMLElement; inner: HTMLElement };
let nativeClasses: Record<string, string> | null = null;

function getNativeClasses(): Record<string, string> | null {
  if (nativeClasses) return nativeClasses;
  nativeClasses = findSteamClasses((m: any) =>
    Boolean(m?.MenuButtonContainer && m?.MenuButton));
  return nativeClasses;
}

function getNativeReference(parent: HTMLElement): NativeReference | null {
  const module = getNativeClasses();
  const doc = parent.ownerDocument;
  const HTMLElementCtor = doc.defaultView?.HTMLElement ?? HTMLElement;
  // Check the real Steam menu buttons before generic role=button elements.
  let buttons: Element[] = [];
  if (module?.MenuButton && module?.MenuButtonContainer) {
    buttons = Array.from(parent.getElementsByClassName(module.MenuButton));
  }
  if (buttons.length === 0) {
    buttons = Array.from(parent.querySelectorAll('[role="button"]')).filter(el =>
      el.querySelector('svg') !== null || el.getAttribute('title') !== null || el.getAttribute('aria-label') !== null);
  }
  for (const candidate of buttons.reverse()) {
    if (!(candidate instanceof HTMLElementCtor) || !candidate.isConnected ||
      candidate.closest('[data-gts-music-note]') || candidate.getClientRects().length === 0) continue;
    let wrapper: Element | null = candidate.parentElement;
    if (module?.MenuButtonContainer) {
      wrapper = candidate.closest('.' + module.MenuButtonContainer);
    }
    if (!(wrapper instanceof HTMLElementCtor) || wrapper === parent ||
      !parent.contains(wrapper)) continue;
    return { wrapper: wrapper as HTMLElement, inner: candidate as HTMLElement };
  }
  return null;
}

function createNoteSvg(doc: Document): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  // Follow the upstream React component's 1.2em, so themes control sizing.
  svg.style.width = '1.2em';
  svg.style.height = '1.2em';
  const path = doc.createElementNS(SVG_NS, 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', 'M18.622 3.217A1 1 0 0 1 19 4v11.667q0 .06-.007.121q.007.105.007.212a3 3 0 1 1-2-2.83V9.26l-8 1.867v6.876a3 3 0 1 1-2-2.832V6.333a1 1 0 0 1 .773-.974l10-2.333a1 1 0 0 1 .842.186z');
  svg.appendChild(path);
  return svg;
}

function attachPopupClick(element: HTMLElement): void {
  element.addEventListener('mousedown', event => event.stopPropagation());
  element.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    try { openManagerPopup('main'); }
    catch (error) { console.error('[Game Theme Song v16.4 button] Popup failed:', error); }
  });
  element.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      try { openManagerPopup('main'); }
      catch (error) { console.error('[Game Theme Song v16.4 button] Popup failed:', error); }
    }
  });
}

function createNativeButton(doc: Document, reference: NativeReference | null): HTMLElement | null {
  const classes = getNativeClasses();
  const containerClass = classes?.MenuButtonContainer || reference?.wrapper.className;
  const menuClass = classes?.MenuButton || reference?.inner.className;
  if (!containerClass || !menuClass) return null;

  // Reproduce upstream Steam markup with the same class names on both levels.
  // No hardcoded color/background/border; Millennium theme CSS targets these.
  const container = doc.createElement('div');
  container.className = containerClass;
  container.setAttribute('data-gts-music-note', 'true');
  const inner = doc.createElement('div');
  inner.className = menuClass;
  inner.setAttribute('data-gts-music-note', 'true');
  inner.setAttribute('role', 'button');
  inner.tabIndex = 0;
  inner.title = 'Game Theme Song';
  inner.setAttribute('aria-label', 'Open Game Theme Song');
  const icon = doc.createElement('div');
  icon.style.display = 'flex';
  icon.style.alignItems = 'center';
  icon.style.justifyContent = 'center';
  icon.style.height = '100%';
  icon.appendChild(createNoteSvg(doc));
  inner.appendChild(icon);
  attachPopupClick(inner);
  container.appendChild(inner);
  return container;
}

function createFallbackButton(doc: Document, floating: boolean): HTMLElement {
  const button = doc.createElement('button');
  button.type = 'button';
  button.title = 'Game Theme Song';
  button.setAttribute('aria-label', 'Open Game Theme Song');
  button.setAttribute('data-gts-music-note', 'true');
  // Keep the original v16.2 fallback in case Steam changes its native classes.
  if (floating) {
    button.style.cssText = [
      'display:inline-flex', 'align-items:center', 'justify-content:center',
      'box-sizing:border-box', 'width:40px', 'height:34px', 'min-width:40px',
      'padding:6px', 'background:#334a62', 'color:#ffffff',
      'border:1px solid rgba(255,255,255,.3)', 'border-radius:4px',
      'cursor:pointer', 'flex:0 0 auto', 'vertical-align:middle',
      'pointer-events:auto'
    ].join(';');
  }
  button.appendChild(createNoteSvg(doc));
  attachPopupClick(button);
  return button;
}

function createButton(doc: Document, floating: boolean, reference: NativeReference | null): HTMLElement {
  return !floating ? (createNativeButton(doc, reference) ?? createFallbackButton(doc, false))
    : createFallbackButton(doc, true);
}

function insertStyledButton(parent: HTMLElement, button: HTMLElement, reference: NativeReference | null): void {
  // Native menu button is a DIV within a MenuButtonContainer DIV, not <button>.
  // Only insert/move when necessary — preserves the v16.1a freeze fix.
  const nativeWrapper = reference?.wrapper;
  const targetParent = nativeWrapper?.parentElement ?? parent;
  if (nativeWrapper?.parentElement === targetParent) {
    if (button.parentElement !== targetParent || button.nextElementSibling !== nativeWrapper)
      targetParent.insertBefore(button, nativeWrapper);
  } else if (button.parentElement !== targetParent) {
    targetParent.appendChild(button);
  }
}

function releaseDocument(doc: Document): void {
  const state = tracked.get(doc);
  if (!state) return;
  tracked.delete(doc);
  state.stop();
}

// The DOM observer receives unrelated updates frequently. Only a newly added
// native action bar (or an ancestor containing it) bypasses the normal throttle.
// Avoid expensive page-wide queries and do not react to the music note itself.
function containsNewNativeHost(mutations: MutationRecord[], ElementCtor: typeof Element): boolean {
  for (const mutation of mutations) {
    for (const node of Array.from(mutation.addedNodes)) {
      if (!(node instanceof ElementCtor) || node.hasAttribute('data-gts-music-note')) continue;
      try {
        if (node.matches(NATIVE_HOST_SELECTOR) || node.querySelector(NATIVE_HOST_SELECTOR)) return true;
      } catch { /* A Steam DOM realm may have a partial selector implementation */ }
    }
  }
  return false;
}

function registerDocument(doc: Document | null | undefined, name: string): void {
  if (!enabled || !name.startsWith('SP ') || !doc?.body || !doc.documentElement) return;
  // Big Picture is intentionally button-free, including after toggling modes.
  if (isBigPictureDocument(doc, name)) {
    const previous = tracked.get(doc);
    if (previous) releaseDocument(doc);
    return;
  }
  const existing = tracked.get(doc);
  if (existing) {
    // A slow fallback sync protects against DOM changes that did not produce
    // observable childList records, without doing a second immediate scan.
    existing.name = name;
    existing.requestSync();
    return;
  }

  const state: DocumentState = {
    doc, name, observer: null, buttons: new Map(), pendingSync: null,
    pendingUrgent: false, lastSyncedAt: 0, observedInPopupManager: false,
    missingPopupScans: 0, exitListener: null,
    requestSync(urgent = false) {
      if (!enabled || tracked.get(doc) !== state) return;
      if (state.pendingSync !== null) {
        // Upgrade an ordinary queued scan once when a native bar arrives.
        // Never keep rescheduling an already-urgent scan under mutation churn.
        if (!urgent || state.pendingUrgent) return;
        clearTimeout(state.pendingSync);
        state.pendingSync = null;
      }
      const elapsed = Date.now() - state.lastSyncedAt;
      const delay = urgent ? 0 : Math.max(MUTATION_COALESCE_MS, MIN_DOM_SYNC_GAP_MS - elapsed);
      state.pendingUrgent = urgent;
      state.pendingSync = setTimeout(() => {
        state.pendingSync = null;
        state.pendingUrgent = false;
        if (enabled && tracked.get(doc) === state) state.sync();
      }, delay);
    },
    stop() {
      if (state.pendingSync !== null) {
        clearTimeout(state.pendingSync);
        state.pendingSync = null;
      }
      state.pendingUrgent = false;
      state.observer?.disconnect();
      state.observer = null;
      if (state.exitListener) {
        const { view, handler } = state.exitListener;
        try { view.removeEventListener('pagehide', handler); } catch { /* window closed */ }
        try { view.removeEventListener('unload', handler); } catch { /* window closed */ }
        state.exitListener = null;
      }
      for (const button of state.buttons.values()) button.remove();
      state.buttons.clear();
    },
    sync() {
      state.lastSyncedAt = Date.now();
      // Also handle a desktop document that was repurposed for Big Picture.
      if (!enabled || isBigPictureDocument(doc, name) || currentGameId(doc) === null) {
        for (const button of state.buttons.values()) button.remove();
        state.buttons.clear();
        return;
      }
      try {
        // Don't mistake one of our two buttons for the original Steam hook.
        const originalHook = Array.from(doc.querySelectorAll<HTMLElement>('[title="Game Theme Song"]'))
          .find(element => !element.hasAttribute('data-gts-music-note') && element.getClientRects().length > 0);
        if (originalHook) {
          for (const button of state.buttons.values()) button.remove();
          state.buttons.clear();
          return;
        }
        const hosts = findHosts(doc).filter(spot =>
          !spot.floating || /^SP (?:Desktop|BPM)(?:_|\b)/.test(name));
        const live = new Set(hosts.map(spot => spot.parent));
        for (const [parent, oldButton] of state.buttons) {
          if (!live.has(parent) || !parent.isConnected) {
            oldButton.remove();
            state.buttons.delete(parent);
          }
        }
        for (const [index, spot] of hosts.entries()) {
          let button = state.buttons.get(spot.parent);
          if (button?.isConnected) continue;
          if (!button) {
            button = createButton(doc, spot.floating, getNativeReference(spot.parent));
            button.id = `${NOTE_ID}-${index}`;
            state.buttons.set(spot.parent, button);
          }
          if (spot.floating) {
            // Only write placement styles on creation or reattachment.
            spot.parent.appendChild(button);
            button.style.position = 'fixed';
            button.style.top = '190px';
            button.style.right = '30px';
            button.style.zIndex = '2147483000';
            button.style.margin = '0';
          } else {
            const ref = getNativeReference(spot.parent);
            insertStyledButton(spot.parent, button, ref);
            if (spot.stats && button.tagName === 'BUTTON') {
              button.style.marginLeft = '8px';
              button.style.height = '28px';
            }
          }
        }
        diagnostic(`Music note active in ${state.buttons.size} game header(s)`);
      } catch (error) {
        console.warn('[Game Theme Song v16.4 button] Update failed:', error);
      }
    }
  };
  tracked.set(doc, state);
  try {
    const ObserverType = doc.defaultView?.MutationObserver ?? MutationObserver;
    state.observer = new ObserverType((mutations: MutationRecord[]) => {
      // Steam popups can have a distinct JavaScript realm, so check nodes
      // against the document's Element constructor rather than global Element.
      const ElementCtor = doc.defaultView?.Element ?? Element;
      const selfOnly = mutations.length > 0 && mutations.every(record => {
        const nodes = [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)];
        return nodes.length > 0 && nodes.every(node =>
          node instanceof ElementCtor && node.hasAttribute('data-gts-music-note'));
      });
      // The plugin's insertions need no second scan. A removed note may have
      // been torn out by Steam's renderer, however, and must be reattached.
      const noteWasRemoved = mutations.some(record => Array.from(record.removedNodes).some(node =>
        node instanceof ElementCtor && node.hasAttribute('data-gts-music-note') && !node.isConnected));
      if (!selfOnly || noteWasRemoved) {
        state.requestSync(containsNewNativeHost(mutations, ElementCtor));
      }
    });
    state.observer.observe(doc.body, { childList: true, subtree: true });
  } catch (error) {
    console.warn('[Game Theme Song v16.4 button] DOM observer unavailable; using refresh', error);
  }
  // pagehide/unload are the strongest closure signals and release references
  // immediately. Some Steam contexts do not emit these; fallback scan prunes
  // only windows confirmed missing from the popup manager for several cycles.
  try {
    const view = doc.defaultView;
    if (view?.addEventListener) {
      const handler: EventListener = () => releaseDocument(doc);
      view.addEventListener('pagehide', handler);
      view.addEventListener('unload', handler);
      state.exitListener = { view, handler };
    }
  } catch { /* No window lifecycle hooks in this Steam context */ }
  diagnostic(`Discovered Steam window (${name})`);
  state.sync();
}

function scanExisting(): void {
  if (!enabled) return;
  const pm = (window as any).g_PopupManager;
  const seen = new Set<Document>();
  let popupEnumerationSucceeded = false;
  try {
    const popups = pm?.GetPopups?.();
    if (Array.isArray(popups)) {
      popupEnumerationSucceeded = true;
      for (const popup of popups) {
        const popWindow = popup?.window;
        const name = popup?.m_strName ?? popWindow?.name ?? '';
        try {
          const doc: Document | undefined = popup?.m_popup?.document ?? popWindow?.document;
          if (doc && !seen.has(doc)) {
            seen.add(doc);
            registerDocument(doc, name);
            const state = tracked.get(doc);
            if (state) {
              state.observedInPopupManager = true;
              state.missingPopupScans = 0;
            }
          }
        } catch { /* stale Steam window */ }
      }
    }
  } catch (error) {
    console.warn('[Game Theme Song v16.4 button] Existing popup scan failed:', error);
  }
  // The hosting script's document may not be listed in g_PopupManager.
  try {
    if (!seen.has(window.document)) {
      seen.add(window.document);
      registerDocument(window.document, window.name);
    }
  } catch { /* shared context */ }

  for (const [doc, state] of tracked) {
    if (seen.has(doc)) { state.missingPopupScans = 0; continue; }
    // A closed window is definitive even if enumeration is temporarily down.
    let closed = false;
    try { closed = doc.defaultView?.closed === true; } catch { /* Steam window unavailable */ }
    if (closed) { releaseDocument(doc); continue; }
    // Never prune a hook-only window that the popup manager has never listed,
    // nor prune anything when popup enumeration itself failed.
    if (!popupEnumerationSucceeded || !state.observedInPopupManager) continue;
    state.missingPopupScans++;
    if (state.missingPopupScans >= MISSING_POPUP_SCAN_GRACE) releaseDocument(doc);
  }
}

export function startGamePageMusicNote(): void {
  if (enabled) return;
  enabled = true;
  // Unlike v14, subscribe to the exact callback demonstrated by the supplied
  // working ProtonDB Status extension.
  if (!hookInstalled && typeof Millennium.AddWindowCreateHook === 'function') {
    hookInstalled = true;
    Millennium.AddWindowCreateHook((context: any) => {
      if (!enabled || !context?.m_strName?.startsWith('SP ')) return;
      registerDocument(context.m_popup?.document, context.m_strName);
    });
    diagnostic('Steam window creation hook registered');
  } else if (!hookInstalled) {
    diagnostic('Millennium window creation hook unavailable; polling existing windows');
  }
  scanExisting();
  timer = setInterval(scanExisting, WINDOW_SCAN_INTERVAL_MS);
}

export function stopGamePageMusicNote(): void {
  enabled = false;
  if (timer !== null) { clearInterval(timer); timer = null; }
  for (const doc of tracked.keys()) releaseDocument(doc);
  previousDiagnostic = '';
  // Millennium's legacy AddWindowCreateHook does not expose an unsubscribe
  // function. The installed callback checks `enabled` before doing any work.
}
