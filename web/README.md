# MyTube Private Web

A mobile-responsive, local-first YouTube viewing portal for Vercel. The home screen loads Thailand's public trending videos, supports category browsing and in-site search, and opens videos in a privacy-enhanced YouTube embed.

## Privacy model

- Protect the Preview deployment with Vercel Authentication.
- Viewing history and favorites use browser Local Storage only.
- The app has no database, analytics, Google sign-in, or MyTube account.
- Trending and search data comes from YouTube Data API v3 through server-only endpoints.
- `YOUTUBE_API_KEY` must be a Vercel Secret and should be restricted to YouTube Data API v3.
- Search runs only after form submission to avoid unnecessary quota usage.
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

Do not deploy this portal as an unprotected production site if it is intended for personal use. Vercel Authentication with Standard Protection is available for Preview deployments on Hobby accounts.
