import React, { useEffect, useRef, useState } from 'react';
import { DialogBody, DialogBodyText, DialogButton, DialogButtonSecondary, DialogHeader, SliderField } from 'millennium';
import { MdMusicNote, MdSkipNext, MdStop, MdCheckCircle, MdSettings, MdLibraryMusic, MdSearch, MdSportsEsports, MdUploadFile, MdDeleteOutline, MdLink } from 'react-icons/md';
import { warn } from './log';
import { t, setLocalizationEnabled } from './i18n';
import { getBackendSettings, setBackendSetting, getCacheInfo, getCustomList, clearFallbackMusic, exportCollection, importCollection, setYouTubeCustomMusic, youtubeV20Search, youtubeV20Assign, youtubeV20Preview, youtubeV20PreviewClear, youtubeV20PreviewClearSession, setYouTubeFallbackMusic } from './api';
import { readFileBase64 } from './base64';
import { ACCEPT_EXTS, MAX_UPLOAD_BYTES, uploadCustomMusic, uploadFallbackMusic } from '../settings/library';
import {
  state, getAudioEl, setGlobalCustomCount, setGlobalCacheInfo,
  subscribeContext, getContext, subscribePlayback, isPlaying, reapplyForApp, isAppIgnored, setAppIgnored, getYoutubeV20Pending, clearYoutubeV20Pending,
  rerollCurrent, acceptCurrent, stopAudio, getPendingConfirmAppId,
} from './engine';
import { LibraryModalContent } from '../settings/LibraryModal';
import { getGameVolumeOverride, setGameVolumeOverride, applyCurrentThemeVolume } from './engine';
import { registerGtsReturnToNowPlaying } from '../settings/managerPopups';
import { MdArrowDropDown } from 'react-icons/md';
import type { ContextState } from './types';

const formatLimit = (sec: number) => {
  if (sec <= 0) return 'Off';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
};

type TabId = 'nowplaying' | 'settings' | 'library';

const TAB_CSS = `
.gts-row-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  align-self: stretch;
}
.gts-tab-count {
  font-size: 10px;
  font-weight: 600;
  opacity: 0.7;
  background: rgba(255,255,255,0.12);
  border-radius: 8px;
  padding: 1px 6px;
}
`;

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '9px 16px',
  fontWeight: active ? 700 : 400,
  opacity: active ? 1 : 0.62,
  whiteSpace: 'nowrap',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '7px',
  position: 'relative',
  zIndex: 2,
  WebkitAppRegion: 'no-drag',
} as React.CSSProperties);

function NowPlayingTab(): React.JSX.Element {
  const [ctx, setCtx] = useState<ContextState>(getContext());
  const [playing, setPlaying] = useState(isPlaying());
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [pending, setPending] = useState(getPendingConfirmAppId());
  const [savingCustom, setSavingCustom] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const [v20Open, setV20Open] = useState(() => getYoutubeV20Pending()?.appId === getContext().appId);
  const [v20Candidates, setV20Candidates] = useState(() => getYoutubeV20Pending()?.items ?? []);
  const [v20CustomQuery, setV20CustomQuery] = useState('');
  const [v20Busy, setV20Busy] = useState(false);
  const [v20Error, setV20Error] = useState<string | null>(null);
  const [replaceThemeMenuOpen, setReplaceThemeMenuOpen] = useState(false);
  const replaceThemeMenuRef = useRef<HTMLDivElement | null>(null);
  const [v20SelectedId, setV20SelectedId] = useState<string | null>(null);
  const [v20PreviewBusy, setV20PreviewBusy] = useState(false);
  const [v20PreviewMessage, setV20PreviewMessage] = useState<string | null>(null);
  const v20AudioRef = useRef<HTMLAudioElement | null>(null);
  const v20PreviewQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const v20PreviewRequest = useRef(0);
  const v20PausedTheme = useRef(false);
  const [noTheme, setNoTheme] = useState(() => {
    const appId = getContext().appId;
    return appId != null && isAppIgnored(appId);
  });
  const [savingNoTheme, setSavingNoTheme] = useState(false);
  const [noThemeError, setNoThemeError] = useState<string | null>(null);
  const [showYouTubeInput, setShowYouTubeInput] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [savingYouTube, setSavingYouTube] = useState(false);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [youtubeSuccess, setYoutubeSuccess] = useState<string | null>(null);
  const customFileRef = useRef<HTMLInputElement | null>(null);
  const [savingFallback, setSavingFallback] = useState(false);
  const fallbackFileRef = useRef<HTMLInputElement | null>(null);
  const onFallbackPicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    const appId = ctx.appId;
    if (!file || appId == null) return;
    setSavingFallback(true);
    try {
      const response = await uploadFallbackMusic(file.name, await readFileBase64(file));
      if (response?.ok) void reapplyForApp(appId);
    } catch (e) {
      warn('set fallback failed', e);
    } finally {
      setSavingFallback(false);
    }
  };

  useEffect(() => subscribeContext(setCtx), []);
  const [gameVolumePercent, setGameVolumePercent] = useState<number | null>(null);
  useEffect(() => {
    const level = getGameVolumeOverride(ctx.appId);
    setGameVolumePercent(level === null ? null : Math.round(level * 100));
  }, [ctx.appId]);
  const onGameVolumeChange = (percent: number) => {
    const id = ctx.appId;
    if (id == null) return;
    const adjusted = Math.max(0, Math.min(100, Math.round(percent)));
    setGameVolumePercent(adjusted);
    setGameVolumeOverride(id, adjusted / 100);
  };
  const onGameVolumeReset = () => {
    const id = ctx.appId;
    if (id == null) return;
    setGameVolumePercent(null);
    setGameVolumeOverride(id, null);
  };
  useEffect(() => subscribeContext(snapshot => {
    const pending = getYoutubeV20Pending();
    if (pending && pending.appId === snapshot.appId) {
      setV20SelectedId(null);
      setV20Candidates(pending.items);
      setV20Open(true);
    } else if (snapshot.appId !== ctx.appId) {
      setV20Open(false);
      setV20Candidates([]);
      setV20CustomQuery('');
    }
  }), [ctx.appId]);
  useEffect(() => {
    setNoTheme(ctx.appId != null && isAppIgnored(ctx.appId));
    setNoThemeError(null);
  }, [ctx.appId, ctx.mode]);
  useEffect(() => subscribePlayback(() => setPlaying(isPlaying())), []);

  useEffect(() => {
    const id = setInterval(() => {
      const a = getAudioEl();
      if (a && !a.paused) {
        setProgress(a.currentTime);
        setDuration(a.duration || 0);
      }
      setPending(getPendingConfirmAppId());
    }, 500);
    return () => clearInterval(id);
  }, []);

  const onCustomFilePicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    const appId = ctx.appId;
    const gameName = ctx.gameName;
    if (!file || appId == null || !gameName) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setCustomError(`"${file.name}" is too large (maximum 50 MB).`);
      return;
    }
    setSavingCustom(true);
    setCustomError(null);
    try {
      const response = await uploadCustomMusic(appId, gameName, file.name, await readFileBase64(file));
      if (!response?.ok) {
        setCustomError(`Couldn't set music: ${response?.error ?? 'unknown error'}.`);
        return;
      }
      try {
        const raw = await getCustomList();
        const info = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (info?.ok && info.items) setGlobalCustomCount(Object.keys(info.items).length);
      } catch (e) { warn('getCustomList failed', e); }
      if (isAppIgnored(appId)) {
        if (await setAppIgnored(appId, false)) setNoTheme(false);
      } else void reapplyForApp(appId);
    } catch (e) {
      warn('set custom failed', e);
      setCustomError('Something went wrong while saving the file.');
    } finally {
      setSavingCustom(false);
    }
  };

  const onYouTubeAssign = async () => {
    const appId = ctx.appId;
    const gameName = ctx.gameName;
    if (appId == null || !gameName) return;
    const url = youtubeUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      setYoutubeError('Paste a complete YouTube video URL beginning with https://.');
      return;
    }
    setSavingYouTube(true);
    setYoutubeError(null);
    setYoutubeSuccess(null);
    try {
      const raw = await setYouTubeCustomMusic(appId, gameName, url);
      const response = (typeof raw === 'string' ? JSON.parse(raw) : raw) as {ok?: boolean; title?: string; error?: string};
      if (!response?.ok) {
        const reasons: Record<string, string> = {
          yt_dlp_missing: 'yt-dlp is missing. Install it with winget install yt-dlp.yt-dlp, then restart Steam.',
          invalid_youtube_url: 'Please use a direct YouTube video, Shorts, or youtu.be link.',
          windows_only: 'This build currently supports YouTube downloads on Windows only.',
          download_failed: 'Download failed. Check that the video is public and playable, and update yt-dlp.',
          file_size_invalid: 'The resulting audio must be between 1 KB and 50 MB.',
          exec_unsupported: 'This version of Millennium does not support command execution.',
        };
        setYoutubeError(reasons[response?.error ?? ''] ?? `Could not assign YouTube song: ${response?.error ?? 'unknown error'}`);
        return;
      }
      try {
        const rawList = await getCustomList();
        const info = typeof rawList === 'string' ? JSON.parse(rawList) : rawList;
        if (info?.ok && info.items) setGlobalCustomCount(Object.keys(info.items).length);
      } catch (e) { warn('getCustomList after YouTube assignment failed', e); }
      setYoutubeSuccess(`Assigned: ${response.title || 'YouTube audio'}`);
      setYoutubeUrl('');
      if (isAppIgnored(appId)) {
        if (await setAppIgnored(appId, false)) setNoTheme(false);
      } else void reapplyForApp(appId);
    } catch (e) {
      warn('YouTube assignment failed', e);
      setYoutubeError('Could not download and assign this song. See Millennium logs for details.');
    } finally {
      setSavingYouTube(false);
    }
  };
  const onToggleNoTheme = async () => {
    const appId = ctx.appId;
    if (appId == null || savingNoTheme) return;
    const next = !isAppIgnored(appId);
    setSavingNoTheme(true);
    setNoThemeError(null);
    try {
      if (!await setAppIgnored(appId, next)) {
        setNoThemeError('Could not save the theme preference.');
        return;
      }
      setNoTheme(next);
    } catch (error) {
      warn('set no theme failed', error);
      setNoThemeError('Could not save the theme preference.');
    } finally { setSavingNoTheme(false); }
  };
  // A single queue makes it impossible to clear while a cancelled preview
  // still writes its MP3, even if the user closes/reopens the picker rapidly.
  const finishV20PreviewSession = (appId: number | string) => {
    const cleanup = v20PreviewQueueRef.current.catch(() => undefined)
      .then(() => youtubeV20PreviewClearSession(appId))
      .then(raw => {
        const result = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!result?.ok) warn('Preview-session cleanup incomplete', result?.error);
      })
      .catch(error => warn('Preview-session cleanup failed', error));
    v20PreviewQueueRef.current = cleanup;
  };
  const stopV20Preview = () => {
    v20PreviewRequest.current++;
    const audio = v20AudioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    setV20PreviewBusy(false);
    setV20PreviewMessage(null);
  };
  const resumeV20Theme = () => {
    if (v20PausedTheme.current) {
      const original = getAudioEl();
      if (original?.paused) void original.play().catch(() => undefined);
    }
    v20PausedTheme.current = false;
  };
  const closeV20Results = () => {
    stopV20Preview();
    if (ctx.appId) finishV20PreviewSession(ctx.appId);
    resumeV20Theme();
    setV20SelectedId(null);
    clearYoutubeV20Pending();
    setV20Open(false);
    setV20Error(null);
  };
  const previewV20Candidate = async (videoId: string) => {
    if (v20Busy || !ctx.appId) return;
    stopV20Preview();
    const request = v20PreviewRequest.current;
    const appId = ctx.appId;
    setV20SelectedId(videoId);
    setV20PreviewBusy(true);
    setV20Error(null);
    setV20PreviewMessage('Downloading the first 15 seconds for preview…');
    const original = getAudioEl();
    if (original && !original.paused) {
      original.pause();
      v20PausedTheme.current = true;
    }
    try {
      // Downloads a temporary 15-second MP3, not the full theme song.
      // Requests run in order; closing a picker queues cleanup AFTER any
      // outstanding extraction. A newer picker waits for that cleanup.
      const promise = v20PreviewQueueRef.current.catch(() => undefined).then(() => {
        if (request !== v20PreviewRequest.current) return null;
        return youtubeV20Preview(appId, videoId);
      });
      v20PreviewQueueRef.current = promise;
      const raw = await promise;
      const result = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (request !== v20PreviewRequest.current) return;
      // A stale result belongs to this picker and is intentionally reusable.

      if (!result?.ok || typeof result.url !== 'string') {
        setV20PreviewMessage(null);
        const errorCode = String(result?.error ?? 'unknown error');
        setV20Error('Preview unavailable: ' + errorCode +
          (errorCode.includes('ffmpeg') ? '. Install FFmpeg and restart Steam.' : ''));
        return;
      }
      const audio = v20AudioRef.current;
      if (!audio) { setV20Error('Preview player not ready. Please click the result again.'); return; }
      audio.src = result.url;
      audio.volume = Math.max(0, Math.min(1, state.settings.volume ?? 0.35));
      audio.load();
      try {
        await audio.play();
        if (request === v20PreviewRequest.current) setV20PreviewMessage('Playing a temporary 15-second clip. Confirm to download the full song.');
      } catch {
        if (request === v20PreviewRequest.current) setV20PreviewMessage('Press Play in the preview controls to listen.');
      }
    } catch (error) {
      warn('v20.3 local preview failed', error);
      if (request === v20PreviewRequest.current) setV20Error('Unable to prepare the 15-second clip. No full song was downloaded.');
    } finally {
      if (request === v20PreviewRequest.current) setV20PreviewBusy(false);
    }
  };
  // Stop previews on popup unmount or when the selected Steam game changes.
  useEffect(() => () => {
    v20PreviewRequest.current++;
    const audio = v20AudioRef.current;
    if (audio) { audio.pause(); audio.removeAttribute('src'); }
    if (ctx.appId) finishV20PreviewSession(ctx.appId);
    if (v20PausedTheme.current) {
      const original = getAudioEl();
      if (original?.paused) void original.play().catch(() => undefined);
      v20PausedTheme.current = false;
    }
  }, [ctx.appId]);
  const searchMoreYoutube = async (customQuery = '') => {
    if (ctx.appId == null || !ctx.gameName || v20Busy) return;
    stopV20Preview();
    resumeV20Theme();
    setV20SelectedId(null);
    setV20Open(true);
    setV20Busy(true);
    setV20Error(null);
    try {
      const raw = await youtubeV20Search(ctx.appId, ctx.gameName, customQuery.trim());
      const result = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!result?.ok || !Array.isArray(result.candidates)) {
        setV20Error('YouTube search failed: ' + String(result?.error ?? 'unknown error'));
        return;
      }
      setV20Candidates(result.candidates);
    } catch (error) { warn('v20 YouTube results failed', error); setV20Error('Unable to search YouTube right now.'); }
    finally { setV20Busy(false); }
  };
  const confirmYoutubeResult = async () => {
    const videoId = v20SelectedId;
    if (!videoId) return;
    const appId = ctx.appId;
    const gameName = ctx.gameName;
    if (appId == null || !gameName || v20Busy) return;
    stopV20Preview();
    v20PausedTheme.current = false;
    setV20Busy(true); setV20Error(null);
    try {
      await v20PreviewQueueRef.current.catch(() => undefined);
      const raw = await youtubeV20Assign(appId, gameName, videoId);
      const result = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!result?.ok) { setV20Error('Could not download the selected song: ' + String(result?.error ?? 'unknown error')); return; }
      clearYoutubeV20Pending();
      setV20Open(false);
      setV20SelectedId(null);
      finishV20PreviewSession(appId);
      void reapplyForApp(appId);
    } catch (error) { warn('v20 YouTube selection failed', error); setV20Error('Could not download the selected YouTube audio.'); }
    finally { setV20Busy(false); }
  };
  useEffect(() => {
    if (!replaceThemeMenuOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (replaceThemeMenuRef.current && !replaceThemeMenuRef.current.contains(event.target as Node)) {
        setReplaceThemeMenuOpen(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setReplaceThemeMenuOpen(false);
    };
    const popupDocument = replaceThemeMenuRef.current?.ownerDocument ?? document;
    popupDocument.addEventListener('pointerdown', dismiss);
    popupDocument.addEventListener('keydown', escape);
    return () => {
      popupDocument.removeEventListener('pointerdown', dismiss);
      popupDocument.removeEventListener('keydown', escape);
    };
  }, [replaceThemeMenuOpen]);
  useEffect(() => { setReplaceThemeMenuOpen(false); }, [ctx.appId]);
  const mode = ctx.mode;
  const hasGame = ctx.appId != null && ctx.gameName != null;
  const showProgress = playing && duration > 0;
  const searching = mode === 'searching';

  const statusText = v20Open && v20Candidates.length > 0 ? 'Choose a YouTube theme for this game.' : noTheme ? 'No theme selected for this game.' : searching
    ? t('Searching for theme music…')
    : playing
      ? t('Playing: {title}', { title: ctx.title ?? t('theme music') })
      : mode === 'ready'
        ? t('Ready: {title}', { title: ctx.title ?? t('theme music') })
        : ctx.title
          ? t('Stopped: {title}', { title: ctx.title })
          : t('No theme found for this game');

  const pct = showProgress && duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;
  const timeLabel = showProgress && duration > 0
    ? `${Math.floor(progress / 60)}:${String(Math.floor(progress % 60)).padStart(2, '0')} / ${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}`
    : null;

  const gtsReplaceThemeControl = (
    <div ref={replaceThemeMenuRef} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%' }}>
      {noTheme && (
        <DialogButtonSecondary disabled={savingNoTheme} onClick={() => {
          if (v20Open) closeV20Results();
          void onToggleNoTheme();
        }}>
          Restore theme music for this game
        </DialogButtonSecondary>
      )}
      <DialogButtonSecondary disabled={savingCustom || savingYouTube || savingNoTheme || v20Busy}
        aria-expanded={replaceThemeMenuOpen} aria-haspopup="menu"
        onClick={() => setReplaceThemeMenuOpen(open => !open)}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <MdUploadFile size={16} /> Replace Theme <MdArrowDropDown size={18} />
        </span>
      </DialogButtonSecondary>
      {replaceThemeMenuOpen && (
        <div role="menu" aria-label="Replace this game's theme" style={{
          position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: 'calc(100% + 4px)', zIndex: 80,
          boxSizing: 'border-box', minWidth: 260, maxWidth: '100%', padding: 6,
          display: 'flex', flexDirection: 'column', gap: 5,
          background: '#303844', border: '1px solid rgba(255,255,255,.24)',
          borderRadius: 6, boxShadow: '0 8px 20px rgba(0,0,0,.42)',
          WebkitAppRegion: 'no-drag'
        } as React.CSSProperties}>
          <DialogButtonSecondary disabled={v20Busy || noTheme || searching} onClick={() => {
            setReplaceThemeMenuOpen(false);
            void searchMoreYoutube();
          }}>Choose another YouTube result</DialogButtonSecondary>
          {!noTheme && (
            <DialogButtonSecondary disabled={savingNoTheme} onClick={() => {
              setReplaceThemeMenuOpen(false);
              if (v20Open) closeV20Results();
              void onToggleNoTheme();
            }}>Set theme to nothing</DialogButtonSecondary>
          )}
          <DialogButtonSecondary disabled={savingYouTube || searching} onClick={() => {
            setReplaceThemeMenuOpen(false);
            if (v20Open) closeV20Results();
            setShowYouTubeInput(true);
            setYoutubeError(null);
            setYoutubeSuccess(null);
          }}>Paste YouTube link</DialogButtonSecondary>
          <DialogButtonSecondary disabled={savingCustom || searching} onClick={() => {
            setReplaceThemeMenuOpen(false);
            if (v20Open) closeV20Results();
            customFileRef.current?.click();
          }}>Find local audio file</DialogButtonSecondary>
        </div>
      )}
      {noThemeError && <span role="alert" style={{ color: 'var(--color-offline, #e05252)', fontSize: 12 }}>{noThemeError}</span>}
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '16px', minHeight: 0, flex: 1 }}>
      {hasGame && (
        <DialogHeader>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <MdMusicNote size={18} />
            {ctx.gameName}
          </span>
        </DialogHeader>
      )}
      {hasGame && (
        <div style={{ margin: '8px 0 12px', padding: '10px 12px', borderRadius: 4, background: 'rgba(130,150,170,0.1)' }}>
          <SliderField
            label="Theme volume for this game"
            description={gameVolumePercent === null
              ? `Using global volume: ${Math.round(state.settings.volume * 100)}%`
              : `Game-specific theme volume: ${gameVolumePercent}%`}
            value={gameVolumePercent ?? Math.round(state.settings.volume * 100)}
            min={0} max={100} step={1} valueSuffix="%"
            onChange={onGameVolumeChange}
          />
          {gameVolumePercent !== null && (
            <DialogButtonSecondary onClick={onGameVolumeReset}>
              Use global volume
            </DialogButtonSecondary>
          )}
        </div>
      )}
      {!hasGame ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', flex: 1, padding: '24px', textAlign: 'center' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(103,193,245,0.1)', border: '1px solid rgba(103,193,245,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MdSportsEsports size={36} style={{ color: '#67c1f5', opacity: 0.7 }} />
          </div>
          <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--main-text-color, #ffffff)' }}>{t('No game open')}</div>
          <div style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--secondary-text-color, rgba(255,255,255,0.5))', maxWidth: '320px' }}>{t('Open a game page in your library to hear its theme music here.')}</div>
        </div>
      ) : searching ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', flex: 1, padding: '40px 0' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(103,193,245,0.1)', border: '1px solid rgba(103,193,245,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MdSearch size={28} style={{ color: '#67c1f5', opacity: 0.7 }} />
          </div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--main-text-color, #fff)' }}>{t('Searching for theme music…')}</div>
          <div style={{ fontSize: '12px', color: 'var(--secondary-text-color, rgba(255,255,255,0.5))' }}>{t('Looking for a track for this game…')}</div>
          <div style={{ width: '100%', maxWidth: 680 }}>{gtsReplaceThemeControl}</div>
        </div>
      ) : (
        <DialogBody>
          <DialogBodyText>{statusText}</DialogBodyText>
          {showProgress && (
            <>
              <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', margin: '8px 0 4px' }}>
                <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: 'var(--color-online, #5dc26a)', transition: 'width 0.5s linear' }} />
              </div>
              {timeLabel && <DialogBodyText>{timeLabel}</DialogBodyText>}
            </>
          )}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: 0, alignItems: 'center' }}>
            {pending != null ? (
              <>
                {state.settings.manual_search && (mode === 'ready' || playing) && (
                  <DialogButtonSecondary disabled={false} onClick={() => void rerollCurrent()}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <MdSkipNext size={16} />
                      {t('Find another')}
                    </span>
                  </DialogButtonSecondary>
                )}
                {playing && (
                  <DialogButtonSecondary onClick={() => stopAudio(0.5)}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <MdStop size={16} />
                      {t('Stop')}
                    </span>
                  </DialogButtonSecondary>
                )}
                <DialogButton onClick={() => acceptCurrent()}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <MdCheckCircle size={16} />
                    {t('Keep this theme')}
                  </span>
                </DialogButton>
              </>
            ) : playing && mode === 'ready' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--color-online, #5dc26a)' }}>
                <MdCheckCircle size={18} />
                <span style={{ fontSize: '13px' }}>{t('Theme saved')}</span>
              </span>
            ) : !playing && !searching ? (
              <>
                {state.settings.manual_search && (
                  <DialogButtonSecondary onClick={() => rerollCurrent()}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <MdSearch size={16} />
                      {t('Search again')}
                    </span>
                  </DialogButtonSecondary>
                )}
                <input ref={fallbackFileRef} type="file" accept={ACCEPT_EXTS} hidden onChange={(e) => void onFallbackPicked(e)} />
              </>
            ) : null}
            {hasGame && (
              <div style={{ width: '100%', flex: '0 0 100%', boxSizing: 'border-box' }}>
                {gtsReplaceThemeControl}
              </div>
            )}


          </div>
           {showYouTubeInput && hasGame && (
             <div style={{ marginTop: 10, padding: 12, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6 }}>
               <div style={{ marginBottom: 8, fontSize: 12 }}>Paste a YouTube video URL to assign its audio to {ctx.gameName}. Use only audio you are allowed to download.</div>
               <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                 <input
                   type="url"
                   value={youtubeUrl}
                   onChange={e => setYoutubeUrl(e.target.value)}
                   onKeyDown={e => { if (e.key === 'Enter' && !savingYouTube && youtubeUrl.trim()) void onYouTubeAssign(); }}
                   placeholder="https://www.youtube.com/watch?v=..."
                   disabled={savingYouTube}
                   style={{ flex: 1, minWidth: 220, padding: 8, borderRadius: 4, background: '#1b2838', color: 'white', border: '1px solid rgba(255,255,255,0.3)', WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                 />
                 <DialogButton disabled={savingYouTube || !youtubeUrl.trim()} onClick={() => void onYouTubeAssign()}>
                   {savingYouTube ? 'Downloading…' : 'Download & assign'}
                 </DialogButton>
                 <DialogButtonSecondary disabled={savingYouTube} onClick={() => { setShowYouTubeInput(false); setYoutubeUrl(''); setYoutubeError(null); setYoutubeSuccess(null); }}>
                   Cancel
                 </DialogButtonSecondary>
               </div>
               {youtubeError && <div style={{ color: '#f48b8b', marginTop: 8, fontSize: 12 }}>{youtubeError}</div>}
               {youtubeSuccess && <div style={{ color: '#7edb95', marginTop: 8, fontSize: 12 }}>{youtubeSuccess}</div>}
             </div>
           )}
          {customError && (
            <div style={{ color: 'var(--color-offline, #e05252)', fontSize: '12px', marginTop: 8 }}>{customError}</div>
          )}
            {hasGame && !noTheme && v20Open && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {v20Open && (
                <div style={{ padding: 12, borderRadius: 6, background: 'var(--main-background-color, rgba(0,0,0,.2))', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 12, opacity: .85 }}>
                    Preview a YouTube result, then confirm to replace this game's theme. Your selection is saved as a custom song.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label htmlFor="gts-v20-custom-query" style={{ fontSize: 12, opacity: .9 }}>Custom YouTube search</label>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'stretch', width: '100%', minWidth: 0 }}>
                      <div style={{ flex: '1 1 0%', minWidth: 0 }}>
                        <input id="gts-v20-custom-query" type="text" maxLength={120}
                          value={v20CustomQuery} disabled={v20Busy}
                          placeholder="e.g. Terraria main menu OST"
                          onChange={event => setV20CustomQuery(event.currentTarget.value)}
                          onKeyDown={event => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              if (v20CustomQuery.trim()) void searchMoreYoutube(v20CustomQuery);
                            }
                          }}
                          style={{ width: '100%', boxSizing: 'border-box', minWidth: 0, padding: '8px 10px', borderRadius: 4,
                            border: '1px solid rgba(170,180,195,.4)', background: 'rgba(0,0,0,.24)',
                            color: 'var(--main-text-color, #e6e6e6)' }} />
                      </div>
                      <div style={{ flex: '0 0 154px', width: 154, maxWidth: '35%' }}>
                        <DialogButtonSecondary disabled={v20Busy || !v20CustomQuery.trim()}
                          onClick={() => void searchMoreYoutube(v20CustomQuery)}>Search</DialogButtonSecondary>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, opacity: .7 }}>Search uses your words instead of the game's default queries. Preview a result before confirming.</span>
                  </div>
                  {v20Candidates.length === 0 && !v20Busy && <div style={{ fontSize: 12 }}>No results available.</div>}
                  {v20Candidates.slice(0, 8).map(item => {
                    const selected = v20SelectedId === item.id;
                    const other = v20SelectedId != null && !selected;
                    return (
                      <button key={item.id} type="button" disabled={v20Busy}
                        aria-pressed={selected}
                        title="Play a temporary 15-second audio preview"
                        onClick={() => void previewV20Candidate(item.id)}
                        style={{
                          boxSizing: 'border-box', width: '100%', minHeight: 64,
                          padding: '11px 18px', borderRadius: 9, cursor: v20Busy ? 'wait' : 'pointer',
                          border: selected ? '2px solid var(--color-accent, #90b7f0)' : '1px solid rgba(170,180,195,.26)',
                          background: selected ? 'rgba(120,168,230,.28)' : 'rgba(135,145,158,.16)',
                          color: 'var(--main-text-color, #e6e6e6)',
                          opacity: other ? 0.48 : 1,
                          transition: 'opacity 120ms ease, background 120ms ease',
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          justifyContent: 'center', textAlign: 'center', gap: 4,
                          whiteSpace: 'normal', overflowWrap: 'anywhere'
                        }}>
                        <span style={{ fontSize: 14, fontWeight: selected ? 700 : 500, lineHeight: 1.35 }}>
                          {selected ? '♫ ' : ''}{item.title}
                        </span>
                        <span style={{ fontSize: 11, opacity: .75 }}>
                          {item.uploader || 'YouTube'} · {Math.floor((item.duration || 0) / 60)}:{String(Math.floor((item.duration || 0) % 60)).padStart(2, '0')}
                        </span>
                      </button>
                    );
                  })}
                  {v20SelectedId && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '5px 0' }}>
                      <audio ref={v20AudioRef} controls preload="none" style={{ width: '100%', maxWidth: '100%' }}
                        onError={(event) => { if (event.currentTarget.getAttribute('src')) setV20Error('Local clip playback failed. You can still confirm the selection.'); }} />
                      {v20PreviewBusy && <span style={{ fontSize: 12, textAlign: 'center' }}>Preparing 15-second clip…</span>}
                      {v20PreviewMessage && <span style={{ fontSize: 12, textAlign: 'center', opacity: .75 }}>{v20PreviewMessage}</span>}
                    </div>
                  )}
                  {v20SelectedId ? (
                    <>
                      <DialogButtonSecondary disabled={v20Busy} onClick={() => void confirmYoutubeResult()}>
                        Confirm selection{v20Busy ? ' — downloading…' : ''}
                      </DialogButtonSecondary>
                      <DialogButtonSecondary disabled={v20Busy} onClick={() => closeV20Results()}>Cancel</DialogButtonSecondary>
                    </>
                  ) : (
                    <DialogButtonSecondary disabled={v20Busy} onClick={() => closeV20Results()}>Close results</DialogButtonSecondary>
                  )}
                </div>
              )}
              {v20Error && <div role="alert" style={{ fontSize: 12, color: 'var(--color-offline, #e05252)' }}>{v20Error}</div>}
            </div>
          )}
          <input ref={customFileRef} type="file" accept={ACCEPT_EXTS} hidden onChange={(e) => void onCustomFilePicked(e)} />
        </DialogBody>
      )}
    </div>
  );
}

// v18: A mutually exclusive two-button switch, retaining Steam theme variables.
function GTSBinarySetting({label, description, checked, onChange}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}): React.JSX.Element {
  const optionStyle = (selected: boolean): React.CSSProperties => ({
    flex: '1 1 64px',
    minWidth: '56px',
    padding: '7px 12px',
    border: selected ? '1px solid var(--color-accent, #94bcf6)' : '1px solid transparent',
    borderRadius: '3px',
    background: selected ? 'var(--color-accent, #94bcf6)' : 'rgba(130, 150, 170, 0.13)',
    color: selected ? 'var(--text-on-accent, #142439)' : 'var(--main-text-color, #e6e8eb)',
    fontWeight: selected ? 700 : 400,
    opacity: selected ? 1 : 0.85,
    cursor: 'pointer',
    WebkitAppRegion: 'no-drag',
  } as React.CSSProperties);
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '9px 12px', borderRadius: 3, background: 'rgba(130,150,170,0.1)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 3 }}>{description}</div>
      </div>
      <div role="group" aria-label={label} style={{ display: 'flex', gap: 3, width: 142, flexShrink: 0 }}>
        <button type="button" aria-pressed={!checked} style={optionStyle(!checked)} onClick={() => onChange(false)}>OFF</button>
        <button type="button" aria-pressed={checked} style={optionStyle(checked)} onClick={() => onChange(true)}>ON</button>
      </div>
    </div>
  );
}
const GTS_FADE_STEPS = [0, 0.1, 0.25, 0.5, 0.75, 1, 2, 3, 4, 5] as const;
function gtsFadeIndex(seconds: number): number {
  return GTS_FADE_STEPS.reduce((best, value, index) =>
    Math.abs(value - seconds) < Math.abs(GTS_FADE_STEPS[best] - seconds) ? index : best, 0);
}
function SettingsTab({ onUiRefresh }: { onUiRefresh: () => void }): React.JSX.Element {
  const [percent, setPercent] = useState(Math.round(state.settings.volume * 100));
  const [loop, setLoop] = useState(state.settings.loop);
  const [maxSec, setMaxSec] = useState(state.settings.max_seconds);
  const [stopOnLaunch, setStopOnLaunch] = useState(state.settings.stop_on_launch);
  const [fadeSec, setFadeSec] = useState(state.settings.fade_seconds);
  const [fallbackTitle, setFallbackTitle] = useState(typeof state.settings.fallback_title === 'string' ? state.settings.fallback_title : '');
  const [fallbackSet, setFallbackSet] = useState(Boolean(state.settings.fallback_file));
  const [savingFallback, setSavingFallback] = useState(false);
  const [fallbackYouTubeOpen, setFallbackYouTubeOpen] = useState(false);
  const [fallbackYouTubeUrl, setFallbackYouTubeUrl] = useState('');
  const [savingFallbackYouTube, setSavingFallbackYouTube] = useState(false);
  const [fallbackYouTubeError, setFallbackYouTubeError] = useState<string | null>(null);
  const [fallbackYouTubeSuccess, setFallbackYouTubeSuccess] = useState<string | null>(null);
  const fallbackFileRef = useRef<HTMLInputElement | null>(null);
  const [collectionBusy, setCollectionBusy] = useState(false);
  const [collectionInfo, setCollectionInfo] = useState<string | null>(null);
  const [localizedUi, setLocalizedUi] = useState(state.settings.localized !== false);

  const onLocalizedToggle = (checked: boolean) => {
    setLocalizedUi(checked);
    state.settings.localized = checked;
    setLocalizationEnabled(checked);
    void setBackendSetting('localized', checked).catch(e => warn('save localized failed', e));
    onUiRefresh();
  };

  const onExportCollection = async () => {
    setCollectionBusy(true);
    try {
      const parse = (raw: unknown) => (typeof raw === 'string' ? JSON.parse(raw) : raw) as { ok?: boolean; path?: string; files?: number; error?: string };
      const r = parse(await exportCollection());
      if (r?.ok) setCollectionInfo(t('Saved {files} files to {path}', { files: r.files ?? 0, path: r.path ?? '' }));
      else if (r?.error === 'nothing_to_export') setCollectionInfo(t('Nothing to export yet.'));
      else setCollectionInfo(t('Export failed: {error}', { error: r?.error ?? 'unknown' }));
    } catch (e) {
      warn('export collection failed', e);
      setCollectionInfo(t('Export failed.'));
    } finally {
      setCollectionBusy(false);
    }
  };

  const onImportCollection = async () => {
    setCollectionBusy(true);
    try {
      const parse = (raw: unknown) => (typeof raw === 'string' ? JSON.parse(raw) : raw) as { ok?: boolean; files?: number; error?: string };
      const r = parse(await importCollection());
      if (r?.ok) {
        setCollectionInfo(t('Imported {files} files.', { files: r.files ?? 0 }));
        const raw = await getBackendSettings();
        const st = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (st && typeof st === 'object') {
          state.settings = { ...state.settings, ...st };
          setFallbackTitle(typeof state.settings.fallback_title === 'string' ? state.settings.fallback_title : '');
          setFallbackSet(Boolean(state.settings.fallback_file));
        }
      } else if (r?.error === 'no_collection_file') {
        setCollectionInfo(t('Put game-theme-song-collection.gtscollection into the backup folder first.'));
      } else {
        setCollectionInfo(t('Import failed: {error}', { error: r?.error ?? 'unknown' }));
      }
    } catch (e) {
      warn('import collection failed', e);
      setCollectionInfo('Import failed.');
    } finally {
      setCollectionBusy(false);
    }
  };

  const onFallbackPicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setSavingFallback(true);
    try {
      const response = await uploadFallbackMusic(file.name, await readFileBase64(file));
      if (!response?.ok) {
        warn('set fallback failed: ' + (response?.error ?? 'unknown'));
        return;
      }
      state.settings.fallback_file = 'fallback.mp3';
      state.settings.fallback_title = file.name.replace(/\.[^.]+$/, '');
      setFallbackTitle(state.settings.fallback_title);
      setFallbackSet(true);
    } catch (e) {
      warn('set fallback failed', e);
    } finally {
      setSavingFallback(false);
    }
  };

  const onFallbackYouTubeAssign = async () => {
    const url = fallbackYouTubeUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      setFallbackYouTubeError('Paste a complete YouTube video URL.');
      return;
    }
    setSavingFallbackYouTube(true);
    setFallbackYouTubeError(null);
    setFallbackYouTubeSuccess(null);
    try {
      const raw = await setYouTubeFallbackMusic(url);
      const result = (typeof raw === 'string' ? JSON.parse(raw) : raw) as { ok?: boolean; error?: string; title?: string; file?: string };
      if (!result?.ok) {
        const reasons: Record<string, string> = {
          yt_dlp_missing: 'yt-dlp is missing. Install yt-dlp and restart Steam.',
          invalid_youtube_url: 'Please paste a valid YouTube video link.',
          download_failed: 'Download failed. Check the video and try updating yt-dlp.',
          file_size_invalid: 'Audio must be between 1 KB and 50 MB.',
          windows_only: 'YouTube downloads are supported on Windows in this build.',
          exec_unsupported: 'Millennium cannot run the downloader.',
        };
        setFallbackYouTubeError(reasons[result?.error ?? ''] ?? `Could not set default song: ${result?.error ?? 'unknown error'}`);
        return;
      }
      const title = result.title || 'YouTube audio';
      state.settings.fallback_file = result.file || 'fallback.m4a';
      state.settings.fallback_title = title;
      setFallbackTitle(title);
      setFallbackSet(true);
      setFallbackYouTubeSuccess(`Default song set: ${title}`);
      setFallbackYouTubeUrl('');
      const current = getContext();
      if (current.appId != null) void reapplyForApp(current.appId);
    } catch (error) {
      warn('default YouTube assignment failed', error);
      setFallbackYouTubeError('Could not download this song. Check Millennium logs.');
    } finally {
      setSavingFallbackYouTube(false);
    }
  };
  const onFallbackClear = async () => {
    try {
      await clearFallbackMusic();
      state.settings.fallback_file = '';
      state.settings.fallback_title = '';
      setFallbackTitle('');
      setFallbackSet(false);
    } catch (e) {
      warn('clear fallback failed', e);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const raw = await getBackendSettings();
        const s = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (s && typeof s === 'object') {
          state.settings = { ...state.settings, ...s };
          setPercent(Math.round(state.settings.volume * 100));
          setLoop(state.settings.loop);
          setMaxSec(state.settings.max_seconds);
          setStopOnLaunch(state.settings.stop_on_launch);
          setFadeSec(state.settings.fade_seconds);
          setFallbackTitle(typeof state.settings.fallback_title === 'string' ? state.settings.fallback_title : '');
          setFallbackSet(Boolean(state.settings.fallback_file));
          setLocalizedUi(state.settings.localized !== false);
          setLocalizationEnabled(state.settings.localized !== false);
          const a = getAudioEl();
          if (a) applyCurrentThemeVolume();
        }
      } catch (e) { warn('failed to load settings', e); }
    })();
  }, []);

  const onSlider = (p: number) => {
    const vol = Math.max(0, Math.min(1, Math.round(p) / 100));
    setPercent(Math.round(vol * 100));
    state.settings.volume = vol;
    void setBackendSetting('volume', vol).catch(e => warn('save volume failed', e));
    const a = getAudioEl();
    if (a && !a.paused) applyCurrentThemeVolume();
  };

  const onFade = (stepIndex: number) => {
    const index = Math.min(GTS_FADE_STEPS.length - 1, Math.max(0, Math.round(stepIndex)));
    const v = GTS_FADE_STEPS[index];
    setFadeSec(v);
    state.settings.fade_seconds = v;
    void setBackendSetting('fade_seconds', v).catch(e => warn('save fade failed', e));
  };

  const onLoop = (checked: boolean) => {
    setLoop(checked);
    state.settings.loop = checked;
    void setBackendSetting('loop', checked).catch(e => warn('save loop failed', e));
    const a = getAudioEl();
    if (a) a.loop = checked;
  };

  const onLimit = (sec: number) => {
    const v = Math.max(0, Math.round(sec));
    setMaxSec(v);
    state.settings.max_seconds = v;
    void setBackendSetting('max_seconds', v).catch(e => warn('save max_seconds failed', e));
  };

  const onStopOnLaunch = (checked: boolean) => {
    setStopOnLaunch(checked);
    state.settings.stop_on_launch = checked;
    void setBackendSetting('stop_on_launch', checked).catch(e => warn('save stop_on_launch failed', e));
  };



  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '16px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
      <SliderField label={<span style={{ display: 'inline-block', padding: '10px 0 0 20px', boxSizing: 'border-box' }}>{t("Music volume")}</span>} description={t('Background theme music volume: {percent}%', { percent })} value={percent} min={0} max={100} step={1} valueSuffix="%" onChange={onSlider} />
      <SliderField label={<span style={{ display: 'inline-block', padding: '10px 0 0 20px', boxSizing: 'border-box' }}>{`${t('Fade duration')} (${fadeSec}s)`}</span>} description={fadeSec > 0 ? t('Music fades in and out over {sec}s when switching or leaving games.', { sec: fadeSec }) : t('Music switches instantly with no fade.')} value={gtsFadeIndex(fadeSec)} min={0} max={GTS_FADE_STEPS.length - 1} step={1} onChange={onFade} />
      <SliderField label={<span style={{ display: 'inline-block', padding: '10px 0 0 20px', boxSizing: 'border-box' }}>{t("Theme length limit")}</span>} description={maxSec <= 0 ? t('0s - The full theme plays.') : loop ? t('{sec}s - The theme restarts.', { sec: maxSec }) : t('{sec}s - The theme stops.', { sec: maxSec })} value={maxSec} min={0} max={300} step={5} valueSuffix="s" onChange={onLimit} />
      <GTSBinarySetting label={t("Loop theme")} description={loop ? t('The theme repeats while you stay on the game page.') : t('The theme plays once and stops.')} checked={loop} onChange={onLoop} />
      <GTSBinarySetting label={t("Stop on game launch")} description={stopOnLaunch ? t('Theme music stops when you launch a game.') : t('Theme music keeps playing when a game starts.')} checked={stopOnLaunch} onChange={onStopOnLaunch} />
      <GTSBinarySetting label={t('Interface language')} description={localizedUi ? t('The plugin uses your Steam language.') : t('The plugin interface stays in English.')} checked={localizedUi} onChange={onLocalizedToggle} />
      <div style={{ paddingTop: '8px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600 }}>{t('Default theme song')}</div>
        <div style={{ fontSize: '12px', color: 'var(--secondary-text-color, rgba(255,255,255,0.5))' }}>
          {fallbackSet
            ? t('Plays for games with no found theme. Current: {title}', { title: fallbackTitle })
            : t('Plays for games where no theme could be found.')}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
          <DialogButtonSecondary disabled={savingFallback} onClick={() => fallbackFileRef.current?.click()}>
            {savingFallback ? t('Saving…') : fallbackSet ? t('Replace') : t('Choose file')}
          </DialogButtonSecondary>
          {fallbackSet && (
            <DialogButtonSecondary disabled={savingFallback} onClick={() => void onFallbackClear()}>
              <MdDeleteOutline size={15} />
            </DialogButtonSecondary>
          )}
        </div>
        <input ref={fallbackFileRef} type="file" accept={ACCEPT_EXTS} hidden onChange={(e) => void onFallbackPicked(e)} />
        <div style={{ marginTop: 8 }}>
          <DialogButtonSecondary disabled={savingFallbackYouTube} onClick={() => setFallbackYouTubeOpen(open => !open)}>
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <MdLink size={16} /> {t('Set default theme from YouTube link')}
            </span>
          </DialogButtonSecondary>
        </div>
        {fallbackYouTubeOpen && (
          <div style={{ border: '1px solid rgba(150,165,180,0.25)', borderRadius: 4, padding: 12, marginTop: 8 }}>
            <div style={{ fontSize: 12, marginBottom: 6 }}>Paste a YouTube video URL (audio you are permitted to download).</div>
            <input
              type="url"
              aria-label="Default theme YouTube video URL"
              placeholder="https://www.youtube.com/watch?v=..."
              value={fallbackYouTubeUrl}
              onChange={event => setFallbackYouTubeUrl(event.target.value)}
              disabled={savingFallbackYouTube}
              style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: 8, color: 'var(--main-text-color, #fff)', background: 'rgba(130,150,170,0.13)', border: '1px solid rgba(130,150,170,0.4)', borderRadius: 4, marginBottom: 8 }}
            />
            <DialogButtonSecondary disabled={savingFallbackYouTube || !fallbackYouTubeUrl.trim()} onClick={() => void onFallbackYouTubeAssign()}>
              {savingFallbackYouTube ? 'Downloading…' : 'Download & set default'}
            </DialogButtonSecondary>
            {fallbackYouTubeError && <div role="alert" style={{ color: 'var(--color-offline, #e05252)', fontSize: 12, marginTop: 8 }}>{fallbackYouTubeError}</div>}
            {fallbackYouTubeSuccess && <div role="status" style={{ color: 'var(--color-online, #5dc26a)', fontSize: 12, marginTop: 8 }}>{fallbackYouTubeSuccess}</div>}
          </div>
        )}
      </div>
      <div style={{ paddingTop: '8px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600 }}>{t('Collection backup')}</div>
        <div style={{ fontSize: '12px', color: 'var(--secondary-text-color, rgba(255,255,255,0.5))' }}>
          {collectionInfo ?? t('Export custom themes, the default theme song, and settings into one file, or import them back.')}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
          <DialogButtonSecondary disabled={collectionBusy} onClick={() => void onExportCollection()}>{t('Export')}</DialogButtonSecondary>
          <DialogButtonSecondary disabled={collectionBusy} onClick={() => void onImportCollection()}>{t('Import')}</DialogButtonSecondary>
        </div>
      </div>
    </div>
  );
}

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'nowplaying', label: 'Now Playing', icon: <MdMusicNote size={15} /> },
  { id: 'settings', label: 'Settings', icon: <MdSettings size={14} /> },
  { id: 'library', label: 'Manage Theme Songs', icon: <MdLibraryMusic size={15} /> },
];

export const MainPopupContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('nowplaying');
  useEffect(() => {
    const resetTab = () => setActiveTab('nowplaying');
    registerGtsReturnToNowPlaying(resetTab);
    return () => registerGtsReturnToNowPlaying(null);
  }, []);
  const [uiTick, setUiTick] = useState(0);


  useEffect(() => {
    void (async () => {
      try {
        const raw = await getCacheInfo();
        const info = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (info?.ok) setGlobalCacheInfo({ count: info.count, bytes: info.bytes });
      } catch (e) { warn('getCacheInfo failed', e); }
      try {
        const raw = await getCustomList();
        const info = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (info?.ok && info.items) setGlobalCustomCount(Object.keys(info.items).length);
      } catch (e) { warn('getCustomList failed', e); }
    })();
  }, []);

  useEffect(() => {
    const id = 'gts-popup-styles';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = TAB_CSS;
    document.head.appendChild(style);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div key={uiTick} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', gap: '4px', padding: '8px 16px 10px', flexShrink: 0, WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {TABS.map((tab) => (
          <DialogButton
            key={tab.id}
            style={tabStyle(activeTab === tab.id)}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            {t(tab.label)}
          </DialogButton>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {activeTab === 'nowplaying' && <NowPlayingTab />}
          {activeTab === 'settings' && <SettingsTab onUiRefresh={() => setUiTick((v) => v + 1)} />}
          {activeTab === 'library' && <LibraryModalContent onChanged={(map) => setGlobalCustomCount(Object.keys(map).length)} />}
        </div>
      </div>
      </div>
    </div>
  );
};
