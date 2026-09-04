const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3";
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const CATEGORY_PATTERN = /^\d{1,3}$/;

export function parseDuration(value) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(value || ""));
  if (!match) return "";
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  const totalMinutes = hours * 60 + minutes;
  return `${totalMinutes}:${String(seconds).padStart(2, "0")}`;
}

export function normalizeCategory(value) {
  const category = String(value || "").trim();
  return CATEGORY_PATTERN.test(category) ? category : "";
}

export function normalizeQuery(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 100);
}

export function normalizePageToken(value) {
  const token = String(value || "").trim();
  return /^[A-Za-z0-9_-]{1,200}$/.test(token) ? token : "";
}

export function formatVideo(item) {
  const id = typeof item?.id === "string" ? item.id : item?.id?.videoId;
  if (!VIDEO_ID_PATTERN.test(String(id || ""))) return null;
  const snippet = item.snippet || {};
  const thumbnails = snippet.thumbnails || {};
  return {
    id,
    title: String(snippet.title || `YouTube video ${id}`).slice(0, 300),
    channel: String(snippet.channelTitle || "YouTube").slice(0, 120),
    channelId: String(snippet.channelId || "").slice(0, 80),
    publishedAt: String(snippet.publishedAt || ""),
    thumbnail: String(thumbnails.maxres?.url || thumbnails.high?.url || thumbnails.medium?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`),
    duration: parseDuration(item.contentDetails?.duration),
    views: String(item.statistics?.viewCount || "0")
  };
}

export function mergeChannelThumbnails(videos, channels) {
  const thumbnails = new Map((channels || []).map((channel) => {
    const source = channel?.snippet?.thumbnails || {};
    return [String(channel?.id || ""), String(source.high?.url || source.medium?.url || source.default?.url || "")];
  }));
  return (videos || []).map((video) => ({
    ...video,
    channelThumbnail: thumbnails.get(video.channelId) || ""
  }));
}

export async function addChannelThumbnails(videos) {
  const ids = [...new Set((videos || []).map((video) => video.channelId).filter(Boolean))].slice(0, 50);
  if (ids.length === 0) return videos;
  try {
    const data = await youtubeRequest("channels", { part: "snippet", id: ids.join(","), maxResults: 50 });
    return mergeChannelThumbnails(videos, data.items || []);
  } catch {
    return videos;
  }
}

export async function youtubeRequest(resource, parameters) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    const error = new Error("เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า YouTube API key");
    error.statusCode = 503;
    throw error;
  }
  const url = new URL(`${YOUTUBE_API_URL}/${resource}`);
  Object.entries({ ...parameters, key }).forEach(([name, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(name, String(value));
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(response.status === 403 ? "โควต้า YouTube API ไม่พร้อมใช้งาน" : "YouTube API ตอบกลับไม่สำเร็จ");
      error.statusCode = response.status === 429 ? 429 : 502;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("YouTube API ใช้เวลาตอบกลับนานเกินไป");
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function sendError(response, error) {
  const status = Number(error?.statusCode) || 500;
  return response.status(status).json({ error: String(error?.message || "เกิดข้อผิดพลาดชั่วคราว") });
}
