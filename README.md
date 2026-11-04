# Game Theme Song (Fixed)

A fork of [BambooFury/Game-Theme-Song](https://github.com/BambooFury/Game-Theme-Song), modified for use with Steam Millennium.

_**Disclaimer: I don't know how to make a plugin for millennium. I just had a free trial with ChatGPT and some time to burn. What I know is that it works. If you don't like AI, oh well.**_

**Current version: v3.0.0**. Based on original upstream v2.2.0.

## Features

- Shows the game-theme manager button in desktop Steam only. Big Picture background playback remains available. - This is the reason I made this fork, the original's button didn't show up ever.
- Automatically discovers game themes using YouTube; prioritizes soundtrack matches, including main themes and main-menu tracks. - I gutted the previous search logic in favor of YouTube for more accurate search results.
- Lets you search YouTube manually, listen to 15-second local previews, then confirm the full download.
- Assigns confirmed results as custom themes, alongside local files and pasted YouTube links.
- Manages downloaded and custom themes together, including per-game deletion and a confirmed bulk-clear operation. - I merged the two previous menus that handled these.
- Supports global and per-game playback volume, looping, length limits, fades, and a default fallback theme. - Added per game volume control and a more fine tuned audio fade slider.


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

The release version uses `MAJOR.MINOR.PATCH`; current version is `3.0.0`. This is the first public fork release.

## Credits and license

Original plugin by **BambooFury**. Fork improvements and maintenance by **SonicCraft**. Licensed under the existing MIT license; see [LICENSE](LICENSE). Not affiliated with Valve, Steam, Millennium, YouTube or yt-dlp.
