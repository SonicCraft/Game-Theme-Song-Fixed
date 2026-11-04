import { ffi } from 'millennium';

// Bridge to the Lua backend. Each backend function is annotated with ---@ffi
// in backend/main.lua and is called with positional arguments. Every function
// returns the backend's JSON payload as a string; callers parse it.

export const getThemeAudio = ffi<[number | string, string, boolean], string>('get_theme_audio');
export const rerollTheme = ffi<[number | string, string, boolean, string], string>('reroll_theme');
export const youtubeV20Search = ffi<[number | string, string, string], string>('youtube_v20_search');
export const youtubeV20Assign = ffi<[number | string, string, string], string>('youtube_v20_assign');
export const youtubeV20Preview = ffi<[number | string, string], string>('youtube_v20_preview');
export const youtubeV20PreviewClear = ffi<[number | string, string], string>('youtube_v20_preview_clear');
export const youtubeV20PreviewClearSession = ffi<[number | string], string>('youtube_v20_preview_clear_session');
export const invalidateAudio = ffi<[number | string], string>('invalidate_audio');
export const getBackendSettings = ffi<[], string>('get_settings');
export const setBackendSetting = ffi<[string, string | number | boolean], string>('set_setting');
export const getCacheInfo = ffi<[], string>('get_cache_info');
export const clearAudioCache = ffi<[], string>('clear_audio_cache');
export const getCacheList = ffi<[], string>('get_cache_list');
export const clearCacheFor = ffi<[number | string], string>('clear_cache_for');
export const getCustomList = ffi<[], string>('get_custom_list');
export const setCustomMusicBegin = ffi<[number | string], string>('set_custom_music_begin');
export const setCustomMusicChunk = ffi<[number | string, string], string>('set_custom_music_chunk');
export const setCustomMusicFinish = ffi<[number | string, string, string, string], string>('set_custom_music_finish');
export const clearCustomMusic = ffi<[number | string], string>('clear_custom_music');
export const clearAllManagedThemeSongs = ffi<[], string>('clear_all_managed_theme_songs');
export const getCustomStorageInfo = ffi<[], string>('get_custom_storage_info');
export const setYouTubeCustomMusic = ffi<[number | string, string, string], string>('set_youtube_custom_music');
export const setYouTubeFallbackMusic = ffi<[string], string>('set_youtube_fallback_music');
export const getIgnoredList = ffi<[], string>('get_ignored_list');
export const setIgnoredBackend = ffi<[number | string, boolean], string>('set_ignored');
export const setFallbackBegin = ffi<[], string>('set_fallback_begin');
export const setFallbackChunk = ffi<[string], string>('set_fallback_chunk');
export const setFallbackFinish = ffi<[string], string>('set_fallback_finish');
export const clearFallbackMusic = ffi<[], string>('clear_fallback_music');
export const exportCollection = ffi<[], string>('export_collection');
export const importCollection = ffi<[], string>('import_collection');
