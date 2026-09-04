# MyTube Focus fallback extension

This Manifest V3 extension is the safe fallback when Google declines sign-in inside WebView2. It runs only on `youtube.com`, uses the browser's normal Google session, and never touches `accounts.google.com`.

## Load unpacked

1. Open `chrome://extensions` in Chrome, `brave://extensions` in Brave, or `edge://extensions` in Edge.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this `fallback-extension` directory.
4. Open the extension's **Options** page to configure cosmetic filtering and Focus Mode.

The extension requests `storage`, `declarativeNetRequest`, and explicit YouTube host access. It does not request `<all_urls>`, read passwords, alter login pages, export cookies, download videos, bypass DRM, or bypass anti-adblock detection. The included network rules are small, conservative examples rather than a complete filter list.
