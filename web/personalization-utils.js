const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

function durationLabel(value) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(value || ""));
  if (!match) return "";
  const minutes = Number(match[1] || 0) * 60 + Number(match[2] || 0);
  return `${minutes}:${String(Number(match[3] || 0)).padStart(2, "0")}`;
}

function shuffled(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
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

export function mixPersonalizedFeed(personalized, trending, { history = [], limit = 24, random = Math.random } = {}) {
  const watched = new Set((history || []).slice(0, 150).map((video) => video?.id).filter(Boolean));
  const personal = uniqueVideos(personalized);
  const publicFeed = uniqueVideos(trending);
  const freshPersonal = shuffled(personal.filter((video) => !watched.has(video.id)), random);
  const personalIds = new Set(personal.map((video) => video.id));
  const freshPublic = shuffled(publicFeed.filter((video) => !watched.has(video.id) && !personalIds.has(video.id)), random);
  const result = [];

  while (result.length < limit && (freshPersonal.length || freshPublic.length)) {
    for (let count = 0; count < 3 && freshPersonal.length && result.length < limit; count += 1) {
      result.push(freshPersonal.shift());
    }
    if (freshPublic.length && result.length < limit) result.push(freshPublic.shift());
  }

  const selected = new Set(result.map((video) => video.id));
  const fallback = shuffled([...personal, ...publicFeed].filter((video) => !selected.has(video.id)), random);
  while (result.length < limit && fallback.length) result.push(fallback.shift());
  return result;
}
