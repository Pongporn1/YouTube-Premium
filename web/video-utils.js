const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function extractVideoId(value) {
  const input = String(value ?? "").trim();
  if (VIDEO_ID_PATTERN.test(input)) {
    return input;
  }

  let url;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  let candidate = null;

  if (host === "youtu.be") {
    candidate = url.pathname.split("/").filter(Boolean)[0];
  } else if (host === "youtube.com" || host.endsWith(".youtube.com")) {
    if (url.pathname === "/watch") {
      candidate = url.searchParams.get("v");
    } else {
      const parts = url.pathname.split("/").filter(Boolean);
      if (["shorts", "embed", "live"].includes(parts[0])) {
        candidate = parts[1];
      }
    }
  }

  return candidate && VIDEO_ID_PATTERN.test(candidate) ? candidate : null;
}

export function canonicalWatchUrl(videoId) {
  if (!VIDEO_ID_PATTERN.test(videoId)) {
    throw new TypeError("Invalid YouTube video ID.");
  }
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function privacyEmbedUrl(videoId) {
  if (!VIDEO_ID_PATTERN.test(videoId)) {
    throw new TypeError("Invalid YouTube video ID.");
  }
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1`;
}

export function isSearchQuery(value) {
  const input = String(value ?? "").trim();
  return input.length > 0 && !extractVideoId(input);
}
