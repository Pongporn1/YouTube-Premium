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

export function privacyEmbedUrl(videoId, origin = globalThis.location?.origin ?? "") {
  if (!VIDEO_ID_PATTERN.test(videoId)) {
    throw new TypeError("Invalid YouTube video ID.");
  }
  const params = new URLSearchParams({ autoplay: "1", rel: "0", playsinline: "1" });
  // enablejsapi + origin let the page send play/pause/seek commands and
  // receive player state, which powers the tap controls over the iframe.
  if (origin) {
    params.set("enablejsapi", "1");
    params.set("origin", origin);
  }
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params}`;
}

export function isSearchQuery(value) {
  const input = String(value ?? "").trim();
  return input.length > 0 && !extractVideoId(input);
}

export const NON_MUSIC_PATTERNS = [
  // Interviews & Talk shows
  /สัมภาษณ์/i,
  /\binterview\b/i,
  /คุยกับ/i,
  /คุยแซ่บ/i,
  /เปิดใจ/i,
  /\btalk\s*show\b/i,
  /\bpodcast\b/i,
  /พอดแคสต์/i,

  // Variety, Auditions, Shows & Reality
  /วาไรตี้/i,
  /\bvariety\b/i,
  /เกมโชว์/i,
  /\bgame\s*show\b/i,
  /เรียลลิตี้/i,
  /\breality\b/i,
  /\baudition\b/i,
  /ออดิชั่น/i,
  /\bjudges['’]?\s*callbacks\b/i,
  /\bfootage\b/i,
  /\bhighlight(s)?\b/i,
  /ไฮไลท์/i,

  // Documentary, News & Scoops
  /สารคดี/i,
  /\bdocumentary\b/i,
  /แถลงข่าว/i,
  /เจาะลึก/i,
  /รายงานพิเศษ/i,
  /\bscoop\b/i,
  /สกู๊ป/i,

  // Behind the Scenes, Reactions & Vlogs
  /เบื้องหลัง/i,
  /\bbehind\s+the\s+scenes\b/i,
  /\bmaking\s+of\b/i,
  /\breaction\b/i,
  /รีแอคชั่น/i,
  /รีแอค/i,
  /\bvlog\b/i,
  /วีล็อก/i,
  /วล็อก/i,
  /\bunboxing\b/i,
  /แกะกล่อง/i,

  // Episodes & Drama (e.g. EP.1, ตอนที่ 2)
  /\bep[\s.]*\d+/i,
  /ตอนที่\s*\d+/i,
  /ละคร/i,
  /ซีรีส์/i,

  // Spoilers & Reviews
  /\bspoil(er)?\b/i,
  /สปอย/i,
  /สปอยล์/i,
  /\breview\b/i,
  /รีวิว/i
];

export function isStrictMusicVideo(item) {
  const categoryId = item?.snippet?.categoryId ?? item?.categoryId;
  if (categoryId !== undefined && categoryId !== null && categoryId !== "" && String(categoryId) !== "10") {
    return false;
  }
  const title = String(item?.snippet?.title ?? item?.title ?? "");
  for (const pattern of NON_MUSIC_PATTERNS) {
    if (pattern.test(title)) return false;
  }
  return true;
}

