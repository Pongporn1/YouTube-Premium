<p align="center">
  <img src="docs/icon.png" width="160" alt="MyTube">
  <img src="docs/music-icon.png" width="160" alt="MyTube Music">
</p>

<h1 align="center">YouTube Premium</h1>

<p align="center">
  <strong>The real YouTube, tuned for Windows — with ads gone and music that never stops.</strong><br>
  A YouTube-focused desktop browser (WPF + WebView2) plus an ultra-light gaming music companion,
  backed by a mobile-first web portal. No accounts, no telemetry, no nonsense.
</p>

<p align="center">
  <a href="docs/INSTALL.md"><img alt="Install guide" src="https://img.shields.io/badge/install-guide-2ea44f?style=flat-square"></a>
  <a href="docs/INSTALL-TH.md"><img alt="Thai guide" src="https://img.shields.io/badge/guide-Thai%20version-2ea44f?style=flat-square"></a>
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows%2010%2F11-blue?style=flat-square">
  <img alt=".NET" src="https://img.shields.io/badge/.NET-8%20WPF-512BD4?style=flat-square">
  <img alt="Engine" src="https://img.shields.io/badge/render-WebView2%20Chromium-0078D7?style=flat-square">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-green?style=flat-square">
</p>

---

## Two apps, one repository

### Desktop update — 2026-09-09

- Updated both Windows and Desktop shortcut icons using the supplied artwork.
- YouTube fullscreen now hides the app toolbar and covers the taskbar; exiting restores the window.
- The music button launches the same MyTube Music companion as the Desktop shortcut. Reopening activates the existing player without restarting playback.
- The companion keeps its existing account/profile and owns its Windows media controls.
- Deployment layout: keep `win-x64` and `music-x64` side by side. Regenerate icons with `tools/import-icons.ps1`.

| | **MyTube** (`MyTube.exe`) | **MyTubeMusic** (`MyTubeMusic.exe`) |
|---|---|---|
| What it is | The real youtube.com inside a hardened WPF shell | An ultra-light music companion for gaming sessions |
| Ad blocking | ✔ full stack | ✔ full stack |
| Always-on-top mini player | ✔ draggable | ✔ the whole window floats |
| Separate Music window | ✔ | — |
| Windows media keys (SMTC) | ✔ | ✔ |
| GPU usage | on (video decode) | **off** — the game keeps the GPU |
| Process priority | normal | **below normal** — the game wins CPU |

## Highlights

- **Ad blocking, three layers** — cosmetic CSS hiding, in-player suppression (mute + instant skip + pruning the ad schedule before the player reads it), and network-level ad/tracker blocking. Zero configuration.
- **Always-on-top mini player** — `Ctrl+Shift+M` shrinks the whole window into a draggable, topmost rectangle; playback never stops.
- **MyTube Music window** — a separate WebView2 that keeps playing while the main window navigates anywhere, minimizes, or shrinks.
- **Windows media keys (SMTC)** — hardware keys, lock screen, and volume flyout control whichever source is actually playing, with real titles and thumbnails.
- **Private by design** — YouTube-only navigation, YouTube-only subdomains for Music, no telemetry, no database, per-app local profiles.

## Built with

| Layer | Technology |
|---|---|
| Shell & UI | C# / **.NET 8 — WPF** |
| Rendering | **Microsoft WebView2** (Chromium, Evergreen runtime) |
| Media keys | Windows **System Media Transport Controls** (WinRT) |
| Player integration | YouTube player JS API (`enablejsapi`) + ad-schedule pruning |
| Filtering | Local rule engine (`default-filters.txt`) compiled into allow/block indexes |
| Web portal (mobile) | Vercel serverless functions · YouTube Data API v3 · Google Identity |
| Tests | MSTest (desktop, 33 tests) · Node test runner (web, 49 tests) |
| Installer | Inno Setup 6 |

## Resource footprint (measured on Windows 11)

| Scenario | RAM (private) | CPU |
|---|---|---|
| Main window browsing | ~400 MB | ~0% idle |
| Main + Music window playing | ~760 MB | ~24% of one core |
| Minimized (auto-suspend + working-set trim) | ~300 MB | **0%** |
| MyTubeMusic.exe while gaming | ~250–350 MB | low-priority few % — the game wins |

## Quick start

Full walkthrough: **[docs/INSTALL.md](docs/INSTALL.md)** (English) · [docs/INSTALL-TH.md](docs/INSTALL-TH.md) (ภาษาไทย)

```powershell
dotnet publish src/MyTube/MyTube.csproj -c Release -r win-x64 --self-contained false -o artifacts/publish/win-x64
dotnet publish src/MyTubeMusic/MyTubeMusic.csproj -c Release -r win-x64 --self-contained false -o artifacts/publish/music-x64
```

---

MyTube is a minimal personal YouTube-focused browser for Windows 10/11. It opens the real `youtube.com` website in Microsoft WebView2; it is not a YouTube clone and has no MyTube account, cloud database, analytics, or telemetry.

> MyTube is an independent personal browser wrapper. Not affiliated with Google or YouTube.

## Status

The MVP includes:

- one persistent WebView2 profile at `%LOCALAPPDATA%\MyTube\UserData`
- the real YouTube and Google sign-in pages
- Back, Forward, Reload, Home, YouTube Music, Settings, application fullscreen, mini player, and keyboard shortcuts
- YouTube-only top-level navigation with an explicit external-browser prompt
- YouTube-only cosmetic filtering, player-ad suppression, and Focus Mode
- a precompiled local network-rule engine with allowlist precedence and fail-open media handling
- download confirmation, offline retry UI, crash handling, and local security-conscious logging
- a Manifest V3 fallback extension for Chrome, Brave, and Edge

## Requirements

- Windows 10 version 1809 or newer, or Windows 11, x64
- [.NET 8 Desktop Runtime](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Microsoft Edge WebView2 Evergreen Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)
- .NET 8 SDK to build from source

WebView2 Evergreen updates its browser engine through Microsoft. The framework-dependent publish deliberately does not bundle the .NET runtime or WebView2 runtime.

## Build and run

From the repository root:

```powershell
dotnet restore MyTube.sln
dotnet build MyTube.sln
dotnet test MyTube.sln
dotnet run --project src/MyTube/MyTube.csproj
```

Release publish:

```powershell
dotnet publish src/MyTube/MyTube.csproj `
  -c Release `
  -r win-x64 `
  --self-contained false `
  -o artifacts/publish/win-x64
```

Run `artifacts\publish\win-x64\MyTube.exe` after publishing.

## Settings

General settings control startup and session retention. **Suspend browser when minimized** freezes the WebView2 renderer while the window is minimized to save CPU and memory; audio pauses while suspended and resumes on restore. YouTube-only navigation is shown as a required, locked security setting. Content settings can hide Shorts, the Home feed, recommendations, comments, merch, sponsored cards, and selected promotional popups. Sponsored-card hiding is enabled by default. Focus Mode combines the distraction-reduction options without hiding Search, Subscriptions, Library, Watch Later, or playlists.

Privacy settings control local filtering and optional cache/cookie clearing. Enabling **Clear cookies on exit** signs the user out of YouTube. Telemetry is always off. DevTools can be enabled only in Debug builds; Release builds force it off.

Keyboard shortcuts:

- `Alt+Left` / `Alt+Right`: Back / Forward
- `Ctrl+R`: Reload
- `Ctrl+L`: intentionally does nothing (there is no address bar)
- `Ctrl+Shift+F`: toggle Focus Mode
- `Ctrl+Shift+M`: toggle the mini player — a small always-on-top window anchored to the bottom-right; video and audio keep playing in the same session while other apps are used. `Esc` or the floating button exits.
- The ♫ toolbar button opens a **separate MyTube Music window** (music.youtube.com, same account, same ad filtering) that keeps playing while the main window navigates anywhere, is minimized, or runs as the mini player. Pin/exit from its title bar.
- **Windows media keys and the system media surface** (lock screen, volume flyout) control whichever source is actually playing — main window or Music window — showing the real title, channel, and thumbnail. Pressing play also wakes a minimized (suspended) window.
- `F11`: application fullscreen
- `Esc`: exit application fullscreen
- `F12`: DevTools when enabled in a Debug build

YouTube's own single-key playback shortcuts such as `F`, `M`, `K`, `J`, and `L` are not intercepted.

## Security and privacy model

MyTube uses its own WebView2 user-data directory. It does not read or import Chrome, Brave, or Edge profiles. It never creates a Google login form, reads password fields, exports cookies, logs authorization headers, changes the WebView2 user-agent, bypasses TLS errors, disables browser security, bypasses DRM, decrypts media, or implements a YouTube anti-adblock bypass.

Only `youtube.com` and its subdomains are accepted as normal top-level destinations. The exact Google sign-in hosts `accounts.google.com` and `gds.google.com` are accepted only inside a sign-in flow that starts from YouTube. Hostnames are parsed with `System.Uri`; substring checks such as `url.Contains("youtube.com")` are not used. External links remain blocked inside MyTube until the user explicitly chooses **Open in Browser**.

Logs are written to `%LOCALAPPDATA%\MyTube\Logs\mytube.log`. They contain lifecycle, safe host-level navigation decisions, rule counts, and errors. Cookies, passwords, tokens, authorization headers, and sensitive query strings are never logged.

## Google login limitation

Google controls whether an embedded browser may sign in. MyTube uses the real Google page, the default WebView2 identity, and its own persistent profile. If Google displays "This browser or app may not be secure" or otherwise blocks embedded sign-in, MyTube will not spoof headers, user-agent strings, credentials, or cookies to bypass that policy.

Use the browser extension in [`fallback-extension`](fallback-extension) with a normal Chrome, Brave, or Edge profile instead. Login then belongs to that browser.

## Filtering architecture

`IFilterListProvider` supplies text rules once during browser initialization. `FilterEngine` parses and compiles them into cached domain, exact-URL, contains, and wildcard indexes. Allow rules are checked before block rules. Disk files and regular expressions are not reparsed per request.

Starter syntax in `src/MyTube/Resources/Filters/default-filters.txt`:

```text
BLOCK DOMAIN tracker.example.com
BLOCK URL https://exact.example/pixel
BLOCK URL_CONTAINS /tracking/
BLOCK WILDCARD https://*.example.net/telemetry/*
ALLOW DOMAIN youtube.com
BLOCK DOMAIN tracker.example.com RESOURCE Script,Image,XmlHttpRequest
```

Basic `||domain^` and `@@||domain^` rules are also accepted. This is not a complete EasyList parser. Network filtering excludes WebView2 `Media` requests at runtime and fails open on errors, prioritizing playback stability. Remote filter updates are intentionally not implemented in the MVP; a future provider must fetch text rules only, never executable code.

Cosmetic selectors are centralized in `YouTubeSelectors.cs`, and injection is refused on non-YouTube pages, including `accounts.google.com`. MyTube installs its filter at document creation time and always suppresses YouTube player ads by hiding the ad frame, muting and advancing only while the player reports an active ad, and activating the skip control when available. The document-creation script also removes ad scheduling data (`adPlacements`, `adSlots`, `playerAds`) from YouTube player responses before the player reads them, so most ads never start at all; the in-player suppression remains as a backstop. The promoted-content setting separately controls sponsored cards in the feed. Player suppression is deliberately scoped to YouTube's ad-state classes so normal video playback is restored immediately afterward. YouTube can change its player at any time, so live behavior must be rechecked after layout updates.

## MyTubeMusic (gaming companion)

`src/MyTubeMusic` builds `MyTubeMusic.exe`, a separate always-on-top music companion for gaming sessions. It plays music.youtube.com with MyTube's full ad/tracker filtering but is tuned to stay out of a game's way: GPU acceleration off, below-normal process priority, a 128 MB disk cache, a single renderer, and built-in Windows media-key (SMTC) support. It uses its own profile folder (`%LOCALAPPDATA%\MyTubeMusic`) — sign in to Google once inside the app for liked videos and playlists. Expect roughly 250–350 MB of RAM and near-zero GPU; CPU stays below-normal priority so an FPS game always wins under load. Publish with `dotnet publish src/MyTubeMusic -c Release -r win-x64 --self-contained false -o artifacts/publish/music-x64`.

## Fallback extension

See [`fallback-extension/README.md`](fallback-extension/README.md). The extension requests only YouTube page access plus local storage/declarative filtering permissions; it never requests `<all_urls>` and never runs on Google Accounts pages.

## Installer

`installer/MyTube.iss` is an Inno Setup 6 script. Publish first, open the script in Inno Setup, and compile it to produce `MyTubeSetup.exe`. The installer creates a Start Menu shortcut, offers an optional Desktop shortcut, supports uninstall, and does not change the Windows default browser.

## Troubleshooting

### WebView2 cannot initialize

Install or repair the Microsoft Edge WebView2 Evergreen Runtime, then restart MyTube.

### Google login is blocked

MyTube will not bypass Google's embedded-browser security. Use the fallback browser extension instead.

### YouTube layout changed

Disable the affected cosmetic setting or update the selector group in `YouTubeSelectors.cs`. The rest of the browser and playback remain available.

### A filter breaks a resource

Disable **Block known trackers**, narrow the local rule, or add an allow rule. Media requests already fail open by design.

## Screenshots

Screenshots are intentionally left as a placeholder until interactive sign-in and visual QA can be performed without capturing private account data. See [`docs/screenshots/README.md`](docs/screenshots/README.md).
