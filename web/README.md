# MyTube Private Web

A mobile-responsive, local-first YouTube viewing portal for Vercel. The home screen loads Thailand's public trending videos, supports category browsing and in-site search, and opens videos in a privacy-enhanced YouTube embed.

## Data sources

- Home/categories/search: public YouTube Data API results. MyTube mixes its own home feed; it cannot retrieve YouTube's private recommendation ranking.
- Channel links: in-app channel uploads, real titles and subscriber counts, with next-page loading.
- Subscriptions, liked videos and owned playlists: fresh read-only OAuth requests when opening the page. Lists paginate in batches of 50; playlist items retain their original order. The mobile account menu also exposes playlists.
- History/Watch Later: locally saved or explicitly imported membership. Opening these pages refreshes public video metadata without deleting unavailable entries or changing saved timestamps. These account lists are not available through YouTube Data API.
- Comments: YouTube comment threads and returned replies; disabled comments and API errors remain visible as errors.
- Shorts, notifications, upload and Google account management open their official pages. They do not display fabricated in-app account data.
- OAuth access tokens stay in memory. After expiry/reload, an explicit connect action may be required. Automatic refresh does not open OAuth popups.

## Privacy model

- Production access is gated by Google Sign-In and an allowed-email check on the server. `ALLOWED_GOOGLE_EMAIL` accepts a comma-separated list to allow multiple accounts (e.g. `you@gmail.com,second@gmail.com`).
- Google Sign-In authenticates the visitor only; it does not grant access to YouTube account data.
- MyTube history and Watch Later use Local Storage on the canonical production origin only.
- Existing YouTube history and Watch Later data can be imported from pasted links or Google Takeout JSON/CSV files.
- YouTube Data API does not permit apps to retrieve Watch History or Watch Later items directly.
- The app has no database or analytics, and imported library data is not uploaded to MyTube's server.
- Trending and search data comes from YouTube Data API v3 through server-only endpoints.
- `YOUTUBE_API_KEY` must be a Vercel Secret and should be restricted to YouTube Data API v3.
- Search runs only after form submission to avoid unnecessary quota usage.
- The free quota is 10,000 units/day per Google Cloud project (`search.list` costs 100 units per call) and resets at midnight Pacific Time. To stay within it, search and related-video responses (public, identical for every viewer) are cached at the CDN for a few minutes, and the client caches them per session.
- Video playback remains inside YouTube's cross-origin embed. A Vercel web app cannot inspect, modify, or guarantee ad blocking inside that player.

## Local checks

```powershell
npm.cmd run check
npm.cmd test
```

## Preview deployment

```powershell
vercel.cmd deploy . --target=preview --skip-domain -y
```

Preview URLs redirect to the canonical production origin unless `?preview=1` is present. Production requires `GOOGLE_CLIENT_ID`, `ALLOWED_GOOGLE_EMAIL`, `SESSION_SECRET`, and `YOUTUBE_API_KEY` in Vercel's Production environment.

Google Cloud's Web OAuth client must authorize `https://mytube-private-web.vercel.app` as a JavaScript origin and `https://mytube-private-web.vercel.app/api/auth/google` as a redirect URI. The redirect URI lets iOS and installed mobile apps complete Sign in with Google without relying on a popup.
