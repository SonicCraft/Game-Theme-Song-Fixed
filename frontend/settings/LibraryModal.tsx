import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DialogButton, DialogButtonSecondary, DialogCheckbox, TextField } from 'millennium';
import { MdCloudOff, MdDeleteOutline, MdHourglassEmpty, MdSearchOff, MdSportsEsports, MdUploadFile, MdLink, MdArrowDropDown } from 'react-icons/md';
import { warn } from '../core/log';
import { base64ToUtf8 } from '../core/base64';
import { t } from '../core/i18n';
import { readFileBase64 } from '../core/base64';
import { clearCustomMusic, getCustomList, getIgnoredList, setYouTubeCustomMusic, getCacheList, clearCacheFor, clearAllManagedThemeSongs, getCustomStorageInfo } from '../core/api';
import { reapplyForApp, setAppIgnored, getCurrentAppId, subscribeContext, getPendingConfirmAppId, resetPlayback, stopAudio, setGlobalCacheInfo, subscribeCacheList } from '../core/engine';
import type { CustomMap, LibApp } from '../core/types';
import { ACCEPT_EXTS, MAX_CARDS, MAX_UPLOAD_BYTES, decodeCustomItems, getLibraryApps, getReadyToPlayAppIds, getHiddenAppIds, uploadCustomMusic } from './library';

const LIST_SCROLL: React.CSSProperties = { flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' };

const ICON_STYLE: React.CSSProperties = { width: 44, height: 44, objectFit: 'cover', borderRadius: 4, flexShrink: 0 };

const AppIcon: React.FC<{ app: LibApp }> = ({ app }) => {
  const src = app.icon ?? app.cover ?? `https://cdn.cloudflare.steamstatic.com/steam/apps/${app.appid}/capsule_236x69.jpg`;
  return <img src={src} alt="" style={ICON_STYLE} loading="lazy" onError={(e) => { (e.currentTarget.style.display = 'none'); }} />;
};

const EmptyState: React.FC<{ icon: React.ReactNode; title: string; body?: string }> = ({ icon, title, body }) => (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '40px 24px', textAlign: 'center' }}>
    <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(103,193,245,0.1)', border: '1px solid rgba(103,193,245,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {icon}
    </div>
    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--main-text-color, #ffffff)' }}>{title}</div>
    {body && <div style={{ fontSize: '12.5px', lineHeight: 1.6, color: 'var(--secondary-text-color, rgba(255,255,255,0.5))', maxWidth: '320px' }}>{body}</div>}
  </div>
);

type ManagedDownloadedTrack = { title: string; name: string; bytes: number };
interface GameRowProps {
  app: LibApp;
  customTitle?: string;
  downloaded?: ManagedDownloadedTrack;
  busy: boolean;
  ignored: boolean;
  current: boolean;
  youtubeOpen: boolean;
  youtubeUrl: string;
  youtubeError: string | null;
  onSet: (app: LibApp) => void;
  onYouTube: (app: LibApp) => void;
  onYouTubeUrlChange: (value: string) => void;
  onAssignYouTube: (app: LibApp) => void;
  onClear: (app: LibApp) => void;
  onClearDownloaded: (app: LibApp) => void;
  onToggleIgnore: (app: LibApp) => void; // retained for compatibility with the existing parent state
}
const GameRow: React.FC<GameRowProps> = ({ app, customTitle, downloaded, busy, ignored, current, youtubeOpen, youtubeUrl, youtubeError, onSet, onYouTube, onYouTubeUrlChange, onAssignYouTube, onClear, onClearDownloaded }) => {
  const [replaceMenuOpen, setReplaceMenuOpen] = React.useState(false);
  const replaceMenuRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!replaceMenuOpen) return;
    const dismissOnOutsideClick = (event: MouseEvent) => {
      if (replaceMenuRef.current && !replaceMenuRef.current.contains(event.target as Node)) {
        setReplaceMenuOpen(false);
      }
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setReplaceMenuOpen(false);
    };
    document.addEventListener('pointerdown', dismissOnOutsideClick);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOnOutsideClick);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [replaceMenuOpen]);
  const notes: string[] = [];
  if (customTitle) notes.push(t('Custom track: {title}', { title: customTitle }));
  if (downloaded) notes.push(`Downloaded track: ${downloaded.title || 'Theme music'} (${(downloaded.bytes / 1048576).toFixed(1)} MB)${customTitle ? ' · inactive while custom track is set' : ''}`);
  if (ignored) notes.push(t('Automatic search is off for this game.'));
  if (!notes.length) notes.push(t('Uses automatic theme search.'));
  if (current) notes.push(t('currently open'));
  const buttonStyle: React.CSSProperties = {
    boxSizing: 'border-box', width: 'auto', maxWidth: '100%', minWidth: 0,
    padding: '8px 12px', whiteSpace: 'nowrap',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
    flex: '0 0 auto',
  };
  return (
    <div style={{
      boxSizing: 'border-box', flexShrink: 0, minWidth: 0,
      margin: '0 16px 6px', padding: '12px 14px',
      background: 'rgba(128,128,128,0.09)', borderRadius: 6,
      display: 'flex', flexDirection: 'column', gap: '10px',
    }}>
      <div style={{
        boxSizing: 'border-box', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px 18px', minWidth: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', flex: '1 1 220px', gap: 12, minWidth: 0 }}>
          <AppIcon app={app} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, overflowWrap: 'anywhere' }}>{app.name}</div>
            <div style={{ marginTop: 5, fontSize: 11, opacity: 0.7, overflowWrap: 'anywhere' }}>{notes.join(' · ')}</div>
          </div>
        </div>
        <div style={{
          boxSizing: 'border-box', display: 'flex', alignItems: 'center',
          justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8,
          flex: '0 1 auto', minWidth: 0, maxWidth: '100%',
        }}>
          {customTitle && (
            <DialogButtonSecondary
              style={{ ...buttonStyle, padding: '8px 10px' }}
              disabled={busy}
              title="Delete the manually assigned theme for this game"
              onClick={() => onClear(app)}
            >
              <MdDeleteOutline size={15} /> Delete Downloaded
            </DialogButtonSecondary>
          )}
          {downloaded && (
            <DialogButtonSecondary
              style={{ ...buttonStyle, padding: '8px 10px' }}
              disabled={busy}
              title="Delete the automatically downloaded theme for this game"
              onClick={() => onClearDownloaded(app)}
            >
              <MdDeleteOutline size={15} /> Delete Downloaded
            </DialogButtonSecondary>
          )}
          <div ref={replaceMenuRef} style={{ position: 'relative', flex: '0 0 auto', minWidth: 0 }}>
            <DialogButtonSecondary
              style={buttonStyle}
              disabled={busy}
              aria-expanded={replaceMenuOpen}
              aria-haspopup="menu"
              onClick={() => setReplaceMenuOpen(open => !open)}
            >
              <MdUploadFile size={15} /> Replace Theme <MdArrowDropDown size={18} />
            </DialogButtonSecondary>
            {replaceMenuOpen && !busy && (
              <div role="menu" aria-label={`Replace theme for ${app.name}`} style={{
                boxSizing: 'border-box', position: 'absolute', right: 0, top: 'calc(100% + 5px)',
                zIndex: 40, minWidth: 208, padding: '6px',
                background: '#303844', border: '1px solid rgba(255,255,255,0.24)',
                borderRadius: 6, boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
                display: 'flex', flexDirection: 'column', gap: 5,
              }}>
                <DialogButtonSecondary
                  style={{ ...buttonStyle, width: '100%', justifyContent: 'flex-start' }}
                  onClick={() => {
                    setReplaceMenuOpen(false);
                    if (!youtubeOpen) onYouTube(app);
                  }}
                >
                  <MdLink size={16} /> Paste YouTube link
                </DialogButtonSecondary>
                <DialogButtonSecondary
                  style={{ ...buttonStyle, width: '100%', justifyContent: 'flex-start' }}
                  onClick={() => {
                    setReplaceMenuOpen(false);
                    if (youtubeOpen) onYouTube(app);
                    onSet(app);
                  }}
                >
                  <MdUploadFile size={15} /> Find local file
                </DialogButtonSecondary>
              </div>
            )}
          </div>
        </div>
      </div>
      {youtubeOpen && (
        <div style={{ boxSizing: 'border-box', minWidth: 0, width: '100%', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6 }}>
          <label htmlFor={`gts-youtube-${app.appid}`} style={{ display: 'block', fontSize: 12, marginBottom: 7 }}>
            YouTube URL for {app.name} (use audio you are permitted to download)
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <input
              id={`gts-youtube-${app.appid}`}
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={youtubeUrl}
              disabled={busy}
              onChange={(e) => onYouTubeUrlChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !busy) { e.preventDefault(); onAssignYouTube(app); } }}
              style={{ boxSizing: 'border-box', flex: '1 1 250px', minWidth: 0, maxWidth: '100%', padding: '8px', background: 'rgba(0,0,0,0.22)', color: 'inherit', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            />
            <DialogButton
              style={{ ...buttonStyle }}
              disabled={busy || !youtubeUrl.trim()}
              onClick={() => onAssignYouTube(app)}
            >
              {busy ? 'Downloading…' : 'Download & assign'}
            </DialogButton>
            <DialogButtonSecondary
              style={buttonStyle}
              disabled={busy}
              onClick={() => onYouTube(app)}
            >
              Cancel
            </DialogButtonSecondary>
          </div>
          {youtubeError && <div role="alert" style={{ color: '#f48b8b', marginTop: 8, fontSize: 12 }}>{youtubeError}</div>}
        </div>
      )}
    </div>
  );
};
interface LibraryModalProps {
  onChanged: (map: CustomMap) => void;
}

export const LibraryModalContent: React.FC<LibraryModalProps> = ({ onChanged }) => {
  const [apps, setApps] = useState<LibApp[] | null>(null);
  const [customMap, setCustomMap] = useState<CustomMap>({});
  const [downloadedMap, setDownloadedMap] = useState<Record<string, ManagedDownloadedTrack>>({});
  const [downloadedError, setDownloadedError] = useState<string | null>(null);
  const [downloadedRefresh, setDownloadedRefresh] = useState(0);
  const [clearingDownloads, setClearingDownloads] = useState(false);
  const [confirmClearDownloads, setConfirmClearDownloads] = useState(false);
  const downloadedRetryCount = useRef(0);
  const [customBytes, setCustomBytes] = useState<number | null>(null);
  const [ignoredMap, setIgnoredMap] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
const [readyOnly, setReadyOnly] = useState(true);
const [includeHidden, setIncludeHidden] = useState(false);
  const [youtubeAppId, setYoutubeAppId] = useState<number | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentAppId, setCurrentAppId] = useState<number | null>(getCurrentAppId());
  const fileRef = useRef<HTMLInputElement | null>(null);
  const pendingApp = useRef<LibApp | null>(null);
  const downloadedMapRef = useRef(downloadedMap);
  const customMapRef = useRef(customMap);
  const ignoredRef = useRef(ignoredMap);
  customMapRef.current = customMap;
  downloadedMapRef.current = downloadedMap;
  ignoredRef.current = ignoredMap;

  useEffect(() => subscribeContext((ctx) => setCurrentAppId(ctx.appId)), []);

  useEffect(() => {
    setApps(getLibraryApps());
    void (async () => {
      try {
        const raw = await getCustomList();
        const info = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (info?.ok && info.items) setCustomMap(decodeCustomItems(info.items));
      } catch (e) { warn('getCustomList failed', e); }
      try {
        const raw = await getIgnoredList();
        const info = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (info?.ok && info.items) setIgnoredMap({ ...info.items });
      } catch (e) { warn('getIgnoredList failed', e); }
    })();
  }, []);

  // Refresh whenever the engine announces a cache change, or on user retry.
  useEffect(() => subscribeCacheList(() => { downloadedRetryCount.current = 0; setDownloadedRefresh(v => v + 1); }), []);
  useEffect(() => {
    let active = true;
    let downloadedRetryTimer: ReturnType<typeof setTimeout> | null = null;
    void (async () => {
      try {
        const raw = await getCacheList();
        const response = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!active) return;
        if (!response?.ok || !response.items) {
          // An in-flight download can make run_io return busy. Do NOT erase the
          // existing list or claim its files disappeared on a transient error.
          setDownloadedError(response?.error === 'busy'
            ? 'Music is being downloaded. Retry the list in a moment.'
            : 'Could not load downloaded tracks.');
          if (response?.error === 'busy' && downloadedRetryCount.current < 5) {
            downloadedRetryCount.current++;
            downloadedRetryTimer = setTimeout(() => { downloadedRetryTimer = null; if (active) setDownloadedRefresh(v => v + 1); }, 600);
          }
          return;
        }
        const next: Record<string, ManagedDownloadedTrack> = {};
        const pendingId = getPendingConfirmAppId();
        for (const [id, value] of Object.entries(response.items) as [string, any][]) {
          if (!/^\d+$/.test(id) || Number(id) === pendingId) continue;
          next[id] = {
            title: base64ToUtf8(value?.title_b64 ?? ''),
            name: base64ToUtf8(value?.name_b64 ?? ''),
            bytes: Number(value?.bytes ?? 0) || 0,
          };
        }
        downloadedRetryCount.current = 0;
        setDownloadedMap(next);
        downloadedMapRef.current = next;
        setGlobalCacheInfo({ count: Object.keys(next).length, bytes: Object.values(next).reduce((sum, track) => sum + track.bytes, 0) });
        setDownloadedError(null);
      } catch (error) {
        if (active) { warn('getCacheList failed in Manage Theme Songs', error); setDownloadedError('Could not load downloaded tracks.'); }
      }
    })();
    return () => { active = false; if (downloadedRetryTimer) clearTimeout(downloadedRetryTimer); };
  }, [downloadedRefresh]);
  // Recheck custom file sizes on first opening the tab and whenever custom
  // assignments are added, replaced, or removed. Retry if a concurrent
  // preview/download briefly has the backend IO lock.
  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    setCustomBytes(null);
    const refresh = async () => {
      try {
        const raw = await getCustomStorageInfo();
        const response = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!active) return;
        if (response?.ok && Number.isFinite(Number(response.bytes))) {
          setCustomBytes(Math.max(0, Number(response.bytes)));
          return;
        }
        if (response?.error === 'busy' && attempts++ < 8) {
          retryTimer = setTimeout(() => { if (active) void refresh(); }, 700);
          return;
        }
        setCustomBytes(null);
        warn('Could not read active custom music size', response?.error);
      } catch (error) {
        if (active) { setCustomBytes(null); warn('getCustomStorageInfo failed', error); }
      }
    };
    void refresh();
    return () => { active = false; if (retryTimer !== null) clearTimeout(retryTimer); };
  }, [customMap]);
  const updateDownloadedMap = (map: Record<string, ManagedDownloadedTrack>) => {
    downloadedMapRef.current = map;
    setDownloadedMap(map);
    setGlobalCacheInfo({ count: Object.keys(map).length, bytes: Object.values(map).reduce((sum, track) => sum + track.bytes, 0) });
  };
  const updateCustomMap = (map: CustomMap) => {
    setCustomMap(map);
    onChanged(map);
  };

  const onSet = useCallback((app: LibApp) => {
    setError(null);
    pendingApp.current = app;
    fileRef.current?.click();
  }, []);

  const onFilePicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    const app = pendingApp.current;
    pendingApp.current = null;
    if (!file || !app) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(t('“{file}” is too large (maximum 50 MB).', { file: file.name }));
      return;
    }
    setBusyId(app.appid);
    setError(null);
    try {
      const response = await uploadCustomMusic(app.appid, app.name, file.name, await readFileBase64(file));
      if (!response?.ok) {
        setError(t('Couldn’t set music: {error}.', { error: response?.error ?? 'unknown error' }));
        return;
      }
      const next = { ...customMapRef.current, [String(app.appid)]: { title: file.name.replace(/\.[^.]+$/, ''), name: app.name } };
      updateCustomMap(next);
      if (ignoredRef.current[String(app.appid)]) {
        if (await setAppIgnored(app.appid, false)) {
          setIgnoredMap(map => ({ ...map, [String(app.appid)]: false }));
        }
      } else void reapplyForApp(app.appid);
    } catch (e) {
      warn('set custom failed', e);
      const reason = e instanceof Error ? e.message : String(e);
      setError(t('Something went wrong while saving the file: {reason}', { reason }));
    } finally {
      setBusyId(null);
    }
  };

  const openYouTubeForApp = (app: LibApp) => {
    if (busyId !== null) return;
    setYoutubeAppId((current) => current === app.appid ? null : app.appid);
    setYoutubeUrl('');
    setYoutubeError(null);
    setError(null);
  };
  const assignYouTubeForApp = async (app: LibApp) => {
    if (busyId !== null) return;
    const url = youtubeUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      setYoutubeError('Paste a complete YouTube video URL starting with https://.');
      return;
    }
    setBusyId(app.appid);
    setYoutubeError(null);
    try {
      const raw = await setYouTubeCustomMusic(app.appid, app.name, url);
      const response = (typeof raw === 'string' ? JSON.parse(raw) : raw) as { ok?: boolean; title?: string; error?: string };
      if (!response?.ok) {
        const messages: Record<string, string> = {
          yt_dlp_missing: 'yt-dlp was not found. Install it with winget, then restart Steam.',
          invalid_youtube_url: 'Please use a YouTube video, Shorts, or youtu.be link.',
          windows_only: 'YouTube downloads currently require Windows.',
          download_failed: 'Download failed. Check that the video is available and update yt-dlp.',
          file_size_invalid: 'Downloaded audio must be between 1 KB and 50 MB.',
          exec_unsupported: 'Millennium could not execute the downloader.',
        };
        setYoutubeError(messages[response?.error ?? ''] ?? `Couldn't set music: ${response?.error ?? 'unknown error'}`);
        return;
      }
      const name = (typeof response.title === 'string' && response.title.trim()) || 'YouTube audio';
      const next = { ...customMapRef.current, [String(app.appid)]: { title: name, name: app.name } };
      updateCustomMap(next);
      if (ignoredRef.current[String(app.appid)]) {
        if (await setAppIgnored(app.appid, false)) {
          setIgnoredMap(map => ({ ...map, [String(app.appid)]: false }));
        }
      } else void reapplyForApp(app.appid);
      setYoutubeAppId(null);
      setYoutubeUrl('');
    } catch (e) {
      warn('set YouTube custom music failed', e);
      setYoutubeError('Could not download this track. See Millennium logs for details.');
    } finally {
      setBusyId(null);
    }
  };
  const onClearDownloaded = useCallback(async (app: LibApp) => {
    if (busyId !== null || clearingDownloads) return;
    setBusyId(app.appid);
    setError(null);
    try {
      const raw = await clearCacheFor(app.appid);
      const response = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!response?.ok) { setError('Could not remove the downloaded track.'); return; }
      const next = { ...downloadedMapRef.current };
      delete next[String(app.appid)];
      updateDownloadedMap(next);
      // Deleting a cached song must not interrupt an active custom override.
      if (getCurrentAppId() === app.appid && !customMapRef.current[String(app.appid)]) {
        stopAudio(0);
        resetPlayback();
      }
    } catch (e) {
      warn('clear downloaded theme failed', e);
      setError('Could not remove the downloaded track.');
    } finally { setBusyId(null); }
  }, [busyId, clearingDownloads]);
  const onClearAllThemes = useCallback(async () => {
    if (busyId !== null || clearingDownloads) return;
    setClearingDownloads(true);
    setConfirmClearDownloads(false);
    setError(null);
    try {
      // This operation clears cached and custom music for ALL games on the
      // backend, even when a game is hidden or not in the current filtered list.
      const raw = await clearAllManagedThemeSongs();
      const response = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!response?.ok) {
        setError('Could not completely clear theme songs. Some tracks may have been removed; check your files and retry.');
        setDownloadedRefresh(v => v + 1);
        return;
      }
      updateDownloadedMap({});
      updateCustomMap({});
      // Do not reapply the current game here: that could trigger another
      // automatic download immediately after clearing its song.
      stopAudio(0);
      resetPlayback();
    } catch (e) {
      warn('clear all theme songs failed', e);
      setError('Could not clear all theme songs. Please retry.');
      setDownloadedRefresh(v => v + 1);
    } finally { setClearingDownloads(false); }
  }, [busyId, clearingDownloads]);
  const onClear = useCallback(async (app: LibApp) => {
    setBusyId(app.appid);
    setError(null);
    try {
      const raw = await clearCustomMusic(app.appid);
      const response = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!response?.ok) { setError(t('Could not remove the custom track.')); return; }
      const next = { ...customMapRef.current };
      delete next[String(app.appid)];
      updateCustomMap(next);
      void reapplyForApp(app.appid);
    } catch (e) {
      warn('clear custom failed', e);
      setError(t('Could not remove the custom track.'));
    } finally {
      setBusyId(null);
    }
  }, []);

  const onToggleIgnore = useCallback(async (app: LibApp) => {
    const key = String(app.appid);
    const next = !ignoredRef.current[key];
    if (!await setAppIgnored(app.appid, next)) {
      setError(t('Could not update ignore state.'));
      return;
    }
    setIgnoredMap((map) => ({ ...map, [key]: next }));
  }, []);

  const managedCount = useMemo(() => new Set([...Object.keys(customMap), ...Object.keys(downloadedMap)]).size, [customMap, downloadedMap]);
  const downloadedCount = Object.keys(downloadedMap).length;
  const downloadedBytes = Object.values(downloadedMap).reduce((sum, track) => sum + track.bytes, 0);

  const [readyAppIds, setReadyAppIds] = useState<Set<number> | null>(null);
const [readyLoading, setReadyLoading] = useState(false);
useEffect(() => {
  if (!readyOnly || !apps) return;
  let active = true;
  setReadyLoading(true);
  setReadyAppIds(null);
  void getReadyToPlayAppIds(apps).then(result => {
    if (!active) return;
    setReadyAppIds(result.ids);
  }).catch(error => {
    if (!active) return;
    warn('Ready to Play filter failed', error);
    setReadyAppIds(null);
  }).finally(() => { if (active) setReadyLoading(false); });
  return () => { active = false; };
}, [apps, readyOnly]);

const hiddenAppIds = useMemo(
  () => (includeHidden ? null : getHiddenAppIds()),
  [apps, includeHidden]
);

const visible = useMemo(() => {
    const pool: LibApp[] = [...(apps ?? [])];
    const known = new Set(pool.map(app => app.appid));
    // The old Downloaded tab also listed cached games absent from Steam's
    // current library; keep them discoverable when Ready to Play is disabled.
    for (const [id, track] of Object.entries(downloadedMap)) {
      const appid = Number(id);
      if (!Number.isSafeInteger(appid) || appid <= 0 || known.has(appid)) continue;
      known.add(appid);
      pool.push({ appid, name: track.name || `App ${id}`, appType: 1 });
    }
    const byType = showAll ? pool : pool.filter((app) => (app.appType ?? 1) === 1);
const filtered = !readyOnly ? byType
  : (readyAppIds === null ? [] : byType.filter((app) => readyAppIds.has(app.appid)));
// No hidden status available? Fail closed: show no names by default.
const privacyFiltered = includeHidden ? filtered
  : (hiddenAppIds === null ? [] : filtered.filter((app) => !hiddenAppIds.has(app.appid)));
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return privacyFiltered
      .filter((app) => !normalizedQuery || app.name.toLocaleLowerCase().includes(normalizedQuery))
      .sort((a, b) => {
        if (a.appid === currentAppId) return -1;
        if (b.appid === currentAppId) return 1;
        return Number(Boolean(customMap[String(b.appid)] || downloadedMap[String(b.appid)])) - Number(Boolean(customMap[String(a.appid)] || downloadedMap[String(a.appid)])) || a.name.localeCompare(b.name);
      });
  }, [apps, customMap, downloadedMap, query, showAll, currentAppId, readyOnly, readyAppIds, includeHidden, hiddenAppIds]);

  const shown = visible.slice(0, MAX_CARDS);
  const isSearching = query.trim().length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '16px 16px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--main-text-color, #ffffff)' }}>Manage Theme Songs</span>
          {managedCount > 0 && <span className="gts-tab-count">{managedCount}</span>}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--secondary-text-color, rgba(255,255,255,0.5))' }}>Manage custom tracks and downloaded themes. Custom songs take priority. Disable Ready to Play to see uninstalled games.</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', padding: '0 16px 8px', gap: '4px', flexShrink: 0 }}>
        {readyOnly && apps && readyAppIds === null && (
  <div role="status" style={{ fontSize: '12px', color: '#f0b86b', padding: '4px 2px' }}>
    {readyLoading ? t('Checking Steam Ready to Play status…') : t('Steam Ready to Play status is unavailable. The list is withheld to avoid incorrect results.')}
  </div>
)}
{!includeHidden && apps && hiddenAppIds === null && (
  <div role="status" style={{ fontSize: '12px', color: '#f0b86b', padding: '4px 2px' }}>
    {t('Hidden game status is unavailable. The list is withheld to protect your privacy.')}
  </div>
)}
<TextField label={t("Search games")} value={query} onChange={(event) => setQuery(event.target.value)} />
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: '24px', rowGap: '4px' }}>
  <div style={{ flex: '0 0 auto' }}>
    <DialogCheckbox
      label={t('Show software and tools')}
      bottomSeparator="none"
      checked={showAll}
      onChange={setShowAll}
    />
  </div>
  <div style={{ flex: '0 0 auto' }}>
    <DialogCheckbox
      label={t('Show only ready to play')}
      bottomSeparator="none"
      checked={readyOnly}
      onChange={setReadyOnly}
    />
  </div>
  <div style={{ flex: '0 0 auto' }}>
    <DialogCheckbox
      label={t('Include hidden games')}
      bottomSeparator="none"
      checked={includeHidden}
      onChange={setIncludeHidden}
    />
  </div>
</div>

        {downloadedError && (
          <div role="status" style={{ fontSize: 12, color: '#f0b86b', padding: '4px 2px' }}>
            {downloadedError} <button type="button" onClick={() => { downloadedRetryCount.current = 0; setDownloadedRefresh(v => v + 1); }} style={{ cursor: 'pointer' }}>Retry</button>
          </div>
        )}
        {error && (
          <div style={{ fontSize: '12px', color: '#e05252', padding: '4px 2px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MdCloudOff size={14} />
            {error}
          </div>
        )}
      </div>

      <div style={LIST_SCROLL}>
        {apps === null ? (
          <EmptyState icon={<MdHourglassEmpty size={28} style={{ color: '#67c1f5', opacity: 0.7 }} />} title={t("Loading your library")} body={t("Reading your installed games and custom tracks…")} />
        ) : shown.length === 0 ? (
          isSearching ? (
            <EmptyState icon={<MdSearchOff size={28} style={{ color: '#67c1f5', opacity: 0.7 }} />} title={t('No games match “{query}”', { query: query.trim() })} body="Try a different name, or turn on software and tools." />
          ) : (
            <EmptyState icon={<MdSportsEsports size={28} style={{ color: '#67c1f5', opacity: 0.7 }} />} title={t("No games to show")} body={t("Install a game, or turn on software and tools to see more.")} />
          )
        ) : (
          shown.map((app) => (
            <GameRow
              key={app.appid}
              app={app}
              customTitle={customMap[String(app.appid)]?.title}
              downloaded={downloadedMap[String(app.appid)]}
              busy={busyId !== null || clearingDownloads}
              youtubeOpen={youtubeAppId === app.appid}
              youtubeUrl={youtubeUrl}
              youtubeError={youtubeAppId === app.appid ? youtubeError : null}
              onYouTube={openYouTubeForApp}
              onYouTubeUrlChange={setYoutubeUrl}
              onAssignYouTube={assignYouTubeForApp}
              ignored={Boolean(ignoredMap[String(app.appid)])}
              current={app.appid === currentAppId}
              onSet={onSet}
              onClear={onClear}
              onClearDownloaded={onClearDownloaded}
              onToggleIgnore={onToggleIgnore}
            />
          ))
        )}
        {visible.length > MAX_CARDS && (
          <div style={{ fontSize: '12px', color: 'var(--secondary-text-color, rgba(255,255,255,0.5))', padding: '10px 16px', textAlign: 'center' }}>
            Showing the first {MAX_CARDS} games. Use search to narrow the list.
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,.1)', padding: '10px 16px', flexShrink: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, opacity: .8 }}>
          Stored: {downloadedCount} downloaded ({(downloadedBytes / 1048576).toFixed(1)} MB)
          {' · '}{Object.keys(customMap).length} custom ({customBytes === null ? 'calculating…' : (customBytes / 1048576).toFixed(1) + ' MB'})
          {' · '}Total: {customBytes === null ? 'calculating…' : ((downloadedBytes + customBytes) / 1048576).toFixed(1) + ' MB'}
        </span>
        {(downloadedCount > 0 || Object.keys(customMap).length > 0) && (
          confirmClearDownloads ? (
            <div role="group" aria-label="Confirm deleting all game theme songs" style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
              <span style={{ fontSize: 12, color: '#ffcf96' }}>
                Delete ALL automatically downloaded AND custom theme songs for EVERY game, including hidden games?
                This cannot be undone. The default fallback song and other settings will be kept.
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                <DialogButton disabled={busyId !== null || clearingDownloads} onClick={() => void onClearAllThemes()}>Yes, delete all theme songs</DialogButton>
                <DialogButtonSecondary disabled={clearingDownloads} onClick={() => setConfirmClearDownloads(false)}>Cancel</DialogButtonSecondary>
              </div>
            </div>
          ) : (
            <DialogButtonSecondary disabled={busyId !== null || clearingDownloads} onClick={() => setConfirmClearDownloads(true)}>Clear all downloaded &amp; custom music</DialogButtonSecondary>
          )
        )}
      </div>
      <input ref={fileRef} type="file" accept={ACCEPT_EXTS} hidden onChange={onFilePicked} />
    </div>
  );
};
