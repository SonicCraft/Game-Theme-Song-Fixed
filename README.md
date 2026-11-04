# Game Theme Song (Fixed)

A community-maintained fork of [BambooFury/Game-Theme-Song](https://github.com/BambooFury/Game-Theme-Song), modified for Steam Millennium.

**Current version: v3.0.0**. Based on original upstream v2.2.0.

## Features

- Automatically discovers game themes using YouTube; prioritizes soundtrack matches, including main themes and main-menu tracks.
- Lets you search YouTube manually, listen to 15-second local previews, then confirm the full download.
- Isolates preview, search, and full-download intermediates; cleans them after failed operations or interrupted Steam sessions.
- Assigns confirmed results as custom themes, alongside local files and pasted YouTube links.
- Manages downloaded and custom themes together, including per-game deletion and a confirmed bulk-clear operation.
- Supports global and per-game playback volume, looping, length limits, fades, and a default fallback theme.
- Shows the music-note manager button in desktop Steam only. Big Picture background playback remains available without an injected button.
- Protects automatically downloaded audio and its cache index using persistent copies outside Steam's UI directory.

## Requirements

- Steam on Windows with [Millennium](https://steambrew.app/).
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) for YouTube search and downloads.
- [FFmpeg](https://ffmpeg.org/) for 15-second audio previews and conversion.
- Node.js and npm **only to build from source**.

Ensure yt-dlp and ffmpeg are accessible to the plugin. Restart Steam after installing or updating them.

## Build from source

```powershell
npm install
npm run version:check
npm run build
```

The resulting `.star` should be in `dist/`. Install it as a Millennium plugin and fully restart Steam. Keep a backup of your existing `.star` and local music before upgrading.

## Versioning

The release version uses `MAJOR.MINOR.PATCH`; current version is `3.0.0`. This is the first public fork release, derived from the internally tested v21.4.2 baseline with pre-release cleanup hardening. To bump all metadata files, run:

```powershell
npm run version:set -- 3.0.1
npm run version:check
```

Use a matching GitHub release tag (starting with `v3.0.0`). The original upstream v2.2.0 and internal development v21.4.2 are historical references, not public release versions.

## Credits and license

Original plugin by **BambooFury**. Fork improvements and maintenance by **SonicCraft**. Licensed under the existing MIT license; see [LICENSE](LICENSE). Not affiliated with Valve, Steam, Millennium, YouTube or yt-dlp.
