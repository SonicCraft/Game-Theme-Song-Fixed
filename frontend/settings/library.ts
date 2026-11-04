import { warn } from '../core/log';
import { utf8ToBase64 } from '../core/base64';
import { setCustomMusicBegin, setCustomMusicChunk, setCustomMusicFinish, setFallbackBegin, setFallbackChunk, setFallbackFinish } from '../core/api';
import type { LibApp, CustomMap } from '../core/types';


export const ACCEPT_EXTS = '.mp3,.m4a,.aac,.ogg,.oga,.opus,.webm,.wav,.flac,audio/*';
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const MAX_CARDS = 200;

const UPLOAD_CHUNK = 512 * 1024;

export function decodeCustomItems(items: Record<string, { title?: string; name?: string }>): CustomMap {
  const out: CustomMap = {};
  for (const k in items) {
    const it = items[k] || {};
    out[k] = { title: it.title ?? '', name: it.name ?? '' };
  }
  return out;
}

export async function uploadFallbackMusic(fileName: string, data: string): Promise<{ ok: boolean; error?: string }> {
  const parse = (raw: unknown): { ok: boolean; error?: string } => {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed ?? { ok: false, error: 'empty_response' };
  };
  const begin = parse(await setFallbackBegin());
  if (!begin?.ok) return begin;
  for (let i = 0; i < data.length; i += UPLOAD_CHUNK) {
    const r = parse(await setFallbackChunk(data.slice(i, i + UPLOAD_CHUNK)));
    if (!r?.ok) return r;
  }
  const title = utf8ToBase64(fileName.replace(/\.[^.]+$/, ''));
  return parse(await setFallbackFinish(title));
}

function resolveCover(ov: any): string | undefined {
  const as: any = (window as any).appStore;
  for (const fn of ['GetVerticalCapsuleURLForApp', 'GetCachedVerticalCapsuleURL']) {
    try {
      const u = as && typeof as[fn] === 'function' ? as[fn].call(as, ov) : undefined;
      if (typeof u === 'string' && u && !u.endsWith('/')) return u;
    } catch (e) {}
  }
  for (const key of ['m_strVerticalCapsuleURL', 'm_strLocalCachedVerticalCapsuleURL', 'm_strSelectedLandscapeArtworkURL']) {
    const v = ov?.[key];
    if (typeof v === 'string' && v) return v;
  }
  return undefined;
}

// Live Steam overview state — v11.  The Library's app overviews contain
// *per-client* status, whereas their top-level display_status is often the
// status of the local client (9 = Ready to Install).  Remote installations
// must be evaluated using remote_per_client_data / selected_per_client_data /
// most_available_per_client_data, not the top-level status.
//
// These are internal Steam APIs. This deliberately favors verified remote
// client records over guessed property names and never treats ownership alone
// as evidence of playability.
export interface ReadyToPlayResult {
  ids: Set<number> | null;
  source: string;
  localCount: number;
  remoteCount: number;
}

type SteamClientRecord = {
  installed?: boolean;
  display_status?: number;
  is_available_on_current_platform?: boolean;
  [key: string]: any;
};

export function getReadyClientRecords(value: any): SteamClientRecord[] {
  const records: SteamClientRecord[] = [];
  const seen = new Set<object>();
  function visit(input: any, depth: number): void {
    if (!input || typeof input !== 'object' || seen.has(input) || depth > 3) return;
    seen.add(input);
    // Steam may represent per-client collections as an array, MobX map or object.
    if (Array.isArray(input)) {
      for (const item of input) visit(item, depth + 1);
      return;
    }
    if (input instanceof Map || (typeof input.values === 'function' && typeof input.get === 'function')) {
      try { for (const item of input.values()) visit(item, depth + 1); } catch { /* ignore */ }
      return;
    }
    if (typeof input.installed === 'boolean' || typeof input.display_status === 'number') {
      records.push(input as SteamClientRecord);
      return;
    }
    // A plain map of client IDs to records, not a generic game object.
    try { for (const item of Object.values(input).slice(0, 32)) visit(item, depth + 1); }
    catch { /* MobX observable may disallow enumeration. */ }
  }
  visit(value, 0);
  return records;
}

// Steam's EDisplayStatusReadyToLaunch is 11, Running is 4.
// 9 is ReadyToInstall and must never be considered playable on its own.
export function isReadyClientRecord(record: SteamClientRecord): boolean {
  return record.installed === true || record.display_status === 11 || record.display_status === 4;
}

function isClientLocal(overview: any, record: SteamClientRecord): boolean | null {
  try {
    if (typeof overview.BIsPerClientDataLocal === 'function') {
      const result = overview.BIsPerClientDataLocal(record);
      if (typeof result === 'boolean') return result;
    }
  } catch { /* BIsPerClientDataLocal signatures differ across Steam builds */ }
  try {
    const localId = overview.local_per_client_data?.clientid;
    if (localId != null && record.clientid != null) return String(localId) === String(record.clientid);
  } catch { /* ignore */ }
  return null;
}

// Return true only for a *remote* record. The dedicated remote_per_client_data
// property is authoritative about location; selected/most-available data can
// be classified using Steam's own BIsPerClientDataLocal method.
export function hasAvailableRemoteClient(overview: any): boolean {
  if (!overview || typeof overview !== 'object') return false;
  const isReady = (record: SteamClientRecord) => isReadyClientRecord(record);
  try {
    const remote = getReadyClientRecords(overview.remote_per_client_data);
    if (remote.some(isReady)) return true;
  } catch { /* continue with selected/most available */ }

  // Steam can select a remote machine for a particular game even if its
  // remote_per_client_data property has not been populated in this renderer.
  for (const key of ['most_available_per_client_data', 'selected_per_client_data']) {
    try {
      const records = getReadyClientRecords(overview[key]);
      for (const record of records) {
        if (!isReady(record)) continue;
        if (isClientLocal(overview, record) === false) return true;
        if (key === 'selected_per_client_data' &&
            typeof overview.BIsSelectedClientLocal === 'function' &&
            overview.BIsSelectedClientLocal() === false) return true;
      }
    } catch { /* ignore unavailable client overview state */ }
  }
  try {
    // Some Steam versions expose selected client data only through a getter.
    if (typeof overview.GetRemotePerClientData === 'function' && overview.GetRemotePerClientData.length === 0) {
      const returned = overview.GetRemotePerClientData();
      if (getReadyClientRecords(returned).some(isReady)) return true;
    }
  } catch { /* getter may require a specific client ID */ }
  return false;
}

export async function getReadyToPlayAppIds(libraryApps: LibApp[]): Promise<ReadyToPlayResult> {
  const ids = new Set<number>();
  const localIds = new Set<number>();
  const remoteIds = new Set<number>();
  const sources: string[] = [];
  let usedClientRecords = false;

  const idOf = (entry: any): number | null => {
    const item = Array.isArray(entry) && entry.length === 2 ? entry[0] : entry;
    const value = item && typeof item === 'object'
      ? (item.appid ?? item.m_unAppID ?? item.nAppID ?? item.unAppID)
      : item;
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  };
  try {
    const collections: any = (window as any).collectionStore;
    const local: any = collections?.GetCollection?.('local-install') ?? collections?.localGamesCollection;
    const entries: any = local?.allApps ?? local?.visibleApps ?? local?.apps;
    if (entries && typeof entries[Symbol.iterator] === 'function') {
      sources.push('local-install');
      for (const entry of entries) {
        const id = idOf(entry);
        if (id !== null) { ids.add(id); localIds.add(id); }
      }
    }
  } catch (error) { warn('Steam local-install collection unavailable', error); }

  const store: any = (window as any).appStore;
  if (typeof store?.GetAppOverviewByAppID === 'function' || store?.m_mapApps?.get) {
    sources.push('per-client Steam overview');
    for (const app of libraryApps) {
      try {
        const overview: any = typeof store.GetAppOverviewByAppID === 'function'
          ? store.GetAppOverviewByAppID(app.appid)
          : store.m_mapApps.get(app.appid);
        if (!overview || typeof overview.then === 'function') continue;
        // The explicitly local record is a useful supplement when the
        // local-install collection isn't loaded yet.
        const local = getReadyClientRecords(overview.local_per_client_data);
        if (local.length || overview.remote_per_client_data != null ||
            overview.most_available_per_client_data != null) usedClientRecords = true;
        if (local.some(isReadyClientRecord)) { ids.add(app.appid); localIds.add(app.appid); }
        if (hasAvailableRemoteClient(overview)) { ids.add(app.appid); remoteIds.add(app.appid); }
      } catch (error) { /* Some shortcuts have no overview. */ }
    }
  }

  if (!sources.length && !usedClientRecords) {
    return { ids: null, source: 'Steam local and per-client stores unavailable', localCount: 0, remoteCount: 0 };
  }
  return {
    ids,
    source: sources.join(' + ') + (usedClientRecords ? '' : ' (per-client data not exposed)'),
    localCount: localIds.size,
    remoteCount: [...remoteIds].filter(id => !localIds.has(id)).length,
  };
}
// Steam's hidden-games collection controls which app titles may be displayed.
// Fail CLOSED (null) if Steam has not exposed usable data: for stream safety,
// the UI must never display unverified titles when "Include hidden games" is off.
export function getHiddenAppIds(): Set<number> | null {
  try {
    const store: any = (window as any).collectionStore;
    const candidates: any[] = [
      store?.hiddenGamesCollection,
      store?.hiddenAppsCollection,
      store?.hiddenCollection,
      store?.GetCollection?.('hidden'),
      store?.GetCollection?.('hidden-games'),
    ];

    for (const collection of candidates) {
      if (!collection) continue;
      // Both array and Set/Map-backed Steam collections are used by the client.
      const entries: any = collection?.allApps ?? collection?.visibleApps
        ?? collection?.apps ?? collection?.m_rgApps;
      if (!entries || typeof entries[Symbol.iterator] !== 'function') continue;

      const ids = new Set<number>();
      for (const entry of entries) {
        const app: any = Array.isArray(entry) && entry.length === 2
          ? ((typeof entry[1] === 'boolean' || entry[1] == null) ? entry[0] : entry[1])
          : entry;
        const raw: any = (typeof app === 'number' || typeof app === 'string')
          ? app
          : app?.appid ?? app?.m_unAppID ?? app?.nAppID ?? app?.unAppID;
        const id = Number(raw);
        if (!Number.isSafeInteger(id) || id <= 0) {
          // Unknown collection shape: withhold rather than accidentally expose.
          return null;
        }
        ids.add(id);
      }
      return ids; // Empty is valid: Steam reports no hidden games.
    }
    return null;
  } catch (e) {
    warn('hidden game collection unavailable', e);
    return null;
  }
}
export function getLibraryApps(): LibApp[] {
  const out: LibApp[] = [];
  const seen = new Set<number>();
  const push = (ov: any, forcedType?: number) => {
	if (!ov) return;
	const appid = Number(ov.appid ?? ov.m_unAppID ?? ov.nAppID ?? ov.unAppID);
	if (!appid || Number.isNaN(appid) || seen.has(appid)) return;
	const name = ov.display_name ?? ov.appname ?? ov.strDisplayName ?? ov.name ?? `App ${appid}`;
	const hash = ov.icon_hash ?? ov.m_strIconHash;
	const icon = hash ? `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${appid}/${hash}.jpg` : undefined;
	seen.add(appid);
	out.push({ appid, name: String(name), cover: resolveCover(ov), icon, appType: Number(ov.app_type ?? 0) || forcedType || 1 });
};
  try {
    const cs: any = (window as any).collectionStore;
    const cols = [cs?.allGamesCollection, cs?.GetCollection?.('all-games'), cs?.GetCollection?.('local-install')];
    for (const col of cols) {
      const apps = col?.allApps ?? col?.visibleApps;
      if (apps && typeof apps[Symbol.iterator] === 'function') for (const a of apps) push(a, 1);
    }
  } catch (e) { warn('collectionStore read failed', e); }
const APP_TYPES = new Set([1, 2, 4, 8]);
const collectionsWorked = out.length > 0;
try {
	const m: any = (window as any).appStore?.m_mapApps;
	if (m && typeof m.values === 'function') {
		for (const ov of m.values()) {
			if (collectionsWorked && !APP_TYPES.has(Number(ov?.app_type ?? 0))) continue;
			push(ov);
		}
	}
} catch (e) { warn('appStore read failed', e); }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

function parseResult(raw: unknown): { ok: boolean; error?: string } {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return parsed ?? { ok: false, error: 'empty_response' };
}

export async function uploadCustomMusic(appid: number | string, gameName: string, fileName: string, data: string): Promise<{ ok: boolean; error?: string }> {
  const ext = (fileName.split('.').pop() ?? '').toLowerCase();
  const begin = parseResult(await setCustomMusicBegin(appid));
  if (!begin?.ok) return begin;
  for (let i = 0; i < data.length; i += UPLOAD_CHUNK) {
    const r = parseResult(await setCustomMusicChunk(appid, data.slice(i, i + UPLOAD_CHUNK)));
    if (!r?.ok) return r;
  }
  return parseResult(await setCustomMusicFinish(appid, ext, utf8ToBase64(fileName), utf8ToBase64(gameName)));
}
