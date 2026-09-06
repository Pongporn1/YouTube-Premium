# MyTube Installation Guide (Detailed)

MyTube ships **two apps** from one repository:

| App | File | Purpose |
|---|---|---|
| **MyTube** (`MyTube.exe`) | `artifacts/publish/win-x64/` | The real YouTube inside a Windows shell with ad blocking, a draggable always-on-top mini player, a separate MyTube Music window, and Windows media-key support |
| **MyTubeMusic** (`MyTubeMusic.exe`) | `artifacts/publish/music-x64/` | An ultra-light music companion for gaming sessions — GPU acceleration off, below-normal process priority (the game always wins the CPU), always-on-top, built-in media keys, full ad blocking |

Both apps are free, local-first, and contain no telemetry.

---

## 1) Prerequisites

1. **Windows 10 (version 1809+) or Windows 11**, 64-bit
2. **.NET 8 Desktop Runtime (x64)** — download from <https://dotnet.microsoft.com/download/dotnet/8.0> (choose "Desktop Runtime", x64)
3. **Microsoft Edge WebView2 Runtime** — preinstalled on Windows 11; if missing, get it from <https://developer.microsoft.com/microsoft-edge/webview2/> (Evergreen Standalone x64)
4. Internet access and a **Google account approved by the owner** (sign-in is gated by an allowlist)
5. Verify the runtimes: open PowerShell and run `dotnet --list-runtimes` — you should see `Microsoft.WindowsDesktop.App 8.x.x`

---

## 2) Installing from the ready-made build (easiest)

1. Copy the **whole folders** (never the bare .exe files — the apps load their ad-filter resources from the same folder):
   - `artifacts\publish\win-x64\` → for **MyTube.exe**
   - `artifacts\publish\music-x64\` → for **MyTubeMusic.exe**
   to a permanent location, e.g. `C:\Program Files\MyTube\` or `C:\Tools\MyTube\`
2. Right-click `MyTube.exe` → **Send to → Desktop (create shortcut)**; repeat for `MyTubeMusic.exe`
3. Launch through the shortcuts — continue with section 4 (first sign-in)

> Do not move or delete files next to the .exe (especially `Resources\` and `WebView2Loader.dll`) — the ad-filter engine loads them from the same folder.

---

## 3) Building from source

### Prepare the machine
1. Install the **.NET 8 SDK** (<https://dotnet.microsoft.com/download/dotnet/8.0> — the SDK, not just the runtime)
2. Open PowerShell in the repository folder

### Build and test
```powershell
dotnet restore MyTube.sln
dotnet build MyTube.sln
dotnet test MyTube.sln          # must pass 33/33
```

### Publish the main app (MyTube.exe)
```powershell
dotnet publish src/MyTube/MyTube.csproj -c Release -r win-x64 --self-contained false -o artifacts/publish/win-x64
```

### Publish the music app (MyTubeMusic.exe)
```powershell
dotnet publish src/MyTubeMusic/MyTubeMusic.csproj -c Release -r win-x64 --self-contained false -o artifacts/publish/music-x64
```

> On a machine without a system SDK, use a portable SDK: download `https://dot.net/v1/dotnet-install.ps1` and run it with `-Channel 8.0 -InstallDir artifacts/.dotnet-sdk`, then call `artifacts\.dotnet-sdk\dotnet.exe` instead of `dotnet`

### Updating later
```powershell
git pull
# close any running MyTube / MyTubeMusic first, then repeat the publish commands above
```

---

## 4) First sign-in (important — once per app)

### MyTube.exe (main window)
1. Launch the app → **sign in with Google** using an allowlisted account
2. Press **"เชื่อม YouTube"** (Connect YouTube) → Google's consent page appears → **Advanced → Go to MyTube Private (unsafe) → Allow**
   (the "unverified app" warning is normal for a personal app — it is safe because you built it)
3. You will see "เชื่อมข้อมูล YouTube แล้ว — ครั้งต่อไประบบจะต่อสิทธิ์ให้เอง" (connected — the app renews access automatically)
4. **Done** — the app silently re-mints access on every future launch

### MyTubeMusic.exe (music companion)
1. Launch the app → **sign in with Google once** (it keeps its own profile)
2. When the Music home page loads you are ready — pick any song or playlist
3. The first Google sign-in includes 2-step verification and a new-device review; this is a **one-time** Google security flow — afterwards the session persists

### Windows media keys
As soon as audio plays, the keyboard media keys, lock screen, and volume flyout control whichever source is actually playing (main window or music window) — title, channel, and thumbnail included.

---

## 5) Title bar buttons (both windows)

| Button | Action |
|---|---|
| ⚑ | Toggle always-on-top (keep the player floating over your game) |
| ─ | Fold to the taskbar (playback keeps running; restore from the taskbar) |
| ✕ | Close |
| Drag the title bar | Move the window anywhere, across monitors too |

---

## 6) Keyboard shortcuts (main app)

| Keys | Action |
|---|---|
| `Alt+←` / `Alt+→` | Back / Forward |
| `Ctrl+R` | Reload |
| `Ctrl+Shift+F` | Focus Mode |
| `Ctrl+Shift+M` | Toggle the always-on-top mini player |
| `F11` | Application fullscreen |
| `Esc` | Exit fullscreen / mini player |
| Media keys | play/pause/next/previous for the active source |

---

## 7) How ad blocking works (zero configuration)

- **Three automatic layers**: cosmetic CSS hiding, in-player ad suppression (mute + instant skip + pruning the ad schedule before the player reads it), and network-level ad/tracker blocking
- Ads stitched directly into a media stream (some live events, Music free tier audio) can only be partially removed — a limitation of every web-based tool
- The apps never bypass DRM, never download videos, and never upload your data

---

## 8) Troubleshooting

| Symptom | Fix |
|---|---|
| App won't start, mentions WebView2 | Install the WebView2 Runtime (section 1), relaunch |
| `dotnet` is not recognized | .NET 8 is not installed (runtime to run, SDK to build) |
| Sign-in says the account is not allowed | The account is not on the owner's allowlist — ask the owner to add it |
| Connect shows an unverified-app warning | Choose Advanced → Go to MyTube Private (unsafe) → Allow (normal for personal apps) |
| Music stutters during gaming | By design the player yields CPU to the game at below-normal priority; if the game saturates all cores the music may briefly stutter |
| Reset an app's data | Delete `%LOCALAPPDATA%\MyTube` (main) or `%LOCALAPPDATA%\MyTubeMusic` (music) |

---

## 9) Privacy

- The web portal's history and watch-later stay on your device; the Windows apps keep each YouTube session in separate local profiles
- No telemetry, no database; logs contain lifecycle events only (never cookies or passwords)
- The full source is in this repository for review
