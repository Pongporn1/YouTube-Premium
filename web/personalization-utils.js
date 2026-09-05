const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const WATCH_CHANNEL_WEIGHT = 5;
const WATCH_CATEGORY_WEIGHT = 2;
const RECENCY_BONUS = [[14, 6], [45, 4], [120, 2], [365, 0]];
const UNKNOWN_AGE_SCORE = -2;
const OLD_VIDEO_SCORE = -10;
const MAX_AFFINITY_COUNT = 12;
// Real YouTube's home feed is dominated by uploads from channels the viewer
// actually follows; trending only appears as light seasoning.
const PERSONAL_PER_TRENDING = 4;

function durationLabel(value) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(value || ""));
  if (!match) return "";
  const minutes = Number(match[1] || 0) * 60 + Number(match[2] || 0);
  return `${minutes}:${String(Number(match[3] || 0)).padStart(2, "0")}`;
}

function uniqueVideos(items) {
  const seen = new Set();
  return (items || []).filter((video) => {
    if (!VIDEO_ID_PATTERN.test(String(video?.id || "")) || seen.has(video.id)) return false;
    seen.add(video.id);
    return true;
  });
}

export function playlistVideoIds(response) {
  return (response?.items || [])
    .map((item) => String(item?.contentDetails?.videoId || item?.snippet?.resourceId?.videoId || ""))
    .filter((id) => VIDEO_ID_PATTERN.test(id));
}

export function formatAuthorizedVideo(item, channelThumbnails = new Map()) {
  const id = String(item?.id || "");
  if (!VIDEO_ID_PATTERN.test(id)) return null;
  const snippet = item?.snippet || {};
  const thumbnails = snippet.thumbnails || {};
  const channelId = String(snippet.channelId || "").slice(0, 80);
  return {
    id,
    title: String(snippet.title || `YouTube video ${id}`).slice(0, 300),
    channel: String(snippet.channelTitle || "YouTube").slice(0, 120),
    channelId,
    categoryId: String(snippet.categoryId || "").slice(0, 10),
    channelThumbnail: String(channelThumbnails.get(channelId) || ""),
    publishedAt: String(snippet.publishedAt || ""),
    thumbnail: String(thumbnails.maxres?.url || thumbnails.high?.url || thumbnails.medium?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`),
    duration: durationLabel(item?.contentDetails?.duration),
    views: String(item?.statistics?.viewCount || "0"),
    comments: String(item?.statistics?.commentCount || "0")
  };
}

function affinityCounts(history, key) {
  const counts = new Map();
  for (const entry of (history || []).slice(0, 150)) {
    const value = String(entry?.[key] || "");
    if (value) counts.set(value, Math.min((counts.get(value) || 0) + 1, MAX_AFFINITY_COUNT));
  }
  return counts;
}

function recencyScore(publishedAt, now) {
  const published = Date.parse(String(publishedAt || ""));
  if (!Number.isFinite(published)) return UNKNOWN_AGE_SCORE;
  const ageDays = Math.max(0, (now - published) / 86400000);
  for (const [maxDays, bonus] of RECENCY_BONUS) {
    if (ageDays <= maxDays) return bonus;
  }
  return OLD_VIDEO_SCORE;
}

// Feed v2 ranks by the viewer's own watch signals instead of shuffling:
// frequently watched channels and categories come first, newly published
// videos outrank years-old ones, and recently watched items stay out.
export function mixPersonalizedFeed(personalized, trending, { history = [], limit = 24, random = Math.random, now = Date.now() } = {}) {
  const watched = new Set((history || []).slice(0, 150).map((video) => video?.id).filter(Boolean));
  const watchChannels = affinityCounts(history, "channelId");
  const watchCategories = affinityCounts(history, "categoryId");
  const personal = uniqueVideos(personalized);
  const publicFeed = uniqueVideos(trending);
  const personalIds = new Set(personal.map((video) => video.id));
  const jitter = () => random() * 0.5;

  const personalScore = (video) => (watchChannels.get(String(video?.channelId || "")) || 0) * WATCH_CHANNEL_WEIGHT
    + (watchCategories.get(String(video?.categoryId || "")) || 0) * WATCH_CATEGORY_WEIGHT
    + recencyScore(video?.publishedAt, now)
    + jitter();
  const publicScore = (video) => (watchCategories.get(String(video?.categoryId || "")) || 0) * WATCH_CATEGORY_WEIGHT
    + jitter();

  const rankedPersonal = personal
    .filter((video) => !watched.has(video.id))
    .map((video) => ({ video, score: personalScore(video) }))
    .sort((a, b) => b.score - a.score);
  const rankedPublic = publicFeed
    .filter((video) => !watched.has(video.id) && !personalIds.has(video.id))
    .map((video) => ({ video, score: publicScore(video) }))
    .sort((a, b) => b.score - a.score);

  const result = [];
  while (result.length < limit && (rankedPersonal.length || rankedPublic.length)) {
    for (let count = 0; count < PERSONAL_PER_TRENDING && rankedPersonal.length && result.length < limit; count += 1) {
      result.push(rankedPersonal.shift().video);
    }
    if (rankedPublic.length && result.length < limit) result.push(rankedPublic.shift().video);
  }

  const selected = new Set(result.map((video) => video.id));
  const fallback = [...rankedPersonal, ...rankedPublic]
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.video)
    .filter((video) => !selected.has(video.id));
  while (result.length < limit && fallback.length) result.push(fallback.shift());
  return result;
}
