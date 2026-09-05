const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3";
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const CATEGORY_PATTERN = /^\d{1,3}$/;

export { isStrictMusicVideo, NON_MUSIC_PATTERNS } from "../video-utils.js";


export function parseDuration(value) {
  const match = String(value || "").match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
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
  return /^[A-Za-z0-9._~+/=-]{1,2048}$/.test(token) ? token : "";
}

export function normalizeVideoId(value) {
  const id = String(value || "").trim();
  return VIDEO_ID_PATTERN.test(id) ? id : "";
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
    categoryId: String(snippet.categoryId || "").slice(0, 10),
    publishedAt: String(snippet.publishedAt || ""),
    thumbnail: String(thumbnails.maxres?.url || thumbnails.high?.url || thumbnails.medium?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`),
    duration: parseDuration(item.contentDetails?.duration),
    views: String(item.statistics?.viewCount || "0"),
    comments: String(item.statistics?.commentCount || "0")
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

function formatComment(comment) {
  const snippet = comment?.snippet || {};
  const authorChannelId = String(snippet.authorChannelId?.value || "").slice(0, 80);
  return {
    id: String(comment?.id || "").slice(0, 200),
    author: String(snippet.authorDisplayName || "ผู้ใช้ YouTube").slice(0, 160),
    authorImage: String(snippet.authorProfileImageUrl || "").slice(0, 1000),
    authorChannelId,
    text: String(snippet.textOriginal || snippet.textDisplay || "").slice(0, 10000),
    likes: Math.max(0, Number(snippet.likeCount) || 0),
    publishedAt: String(snippet.publishedAt || ""),
    updatedAt: String(snippet.updatedAt || "")
  };
}

export function formatCommentThread(thread) {
  const topLevel = formatComment(thread?.snippet?.topLevelComment);
  if (!topLevel.id || !topLevel.text) return null;
  const replies = (thread?.replies?.comments || []).map(formatComment).filter((reply) => reply.id && reply.text);
  return {
    ...topLevel,
    replyCount: Math.max(0, Number(thread?.snippet?.totalReplyCount) || 0),
    replies
  };
}

// Channel avatars change rarely, so warm serverless instances reuse them for
// six hours instead of spending one channels.list unit on every response.
const channelThumbnailCache = new Map();
const CHANNEL_THUMBNAIL_TTL = 6 * 60 * 60 * 1000;

export async function addChannelThumbnails(videos, now = Date.now()) {
  const ids = [...new Set((videos || []).map((video) => video.channelId).filter(Boolean))].slice(0, 50);
  if (ids.length === 0) return videos;
  const missing = ids.filter((id) => {
    const cached = channelThumbnailCache.get(id);
    return !cached || now - cached.at > CHANNEL_THUMBNAIL_TTL;
  });
  if (missing.length) {
    try {
      const data = await youtubeRequest("channels", { part: "snippet", id: missing.join(","), maxResults: 50 });
      for (const channel of data.items || []) {
        const source = channel?.snippet?.thumbnails || {};
        channelThumbnailCache.set(String(channel?.id || ""), {
          at: now,
          url: String(source.high?.url || source.medium?.url || source.default?.url || "")
        });
      }
    } catch {
      // Videos remain usable without avatars when the lookup fails.
    }
    if (channelThumbnailCache.size > 500) {
      for (const [id, entry] of channelThumbnailCache) {
        if (now - entry.at > CHANNEL_THUMBNAIL_TTL) channelThumbnailCache.delete(id);
      }
    }
  }
  return (videos || []).map((video) => ({
    ...video,
    channelThumbnail: channelThumbnailCache.get(video.channelId)?.url || video.channelThumbnail || ""
  }));
}

// Each Google Cloud project carries its own daily 10k-unit YouTube quota.
// Keys are read from YOUTUBE_API_KEY plus the comma-separated YOUTUBE_API_KEYS
// (and YOUTUBE_API_KEY_2/_3 for convenience). When one project reports its
// quota as spent the next key takes over; warm instances remember which key
// is currently alive so a spent key costs no extra calls.
const KEY_ENV_NAMES = ["YOUTUBE_API_KEY", "YOUTUBE_API_KEY_2", "YOUTUBE_API_KEY_3", "YOUTUBE_API_KEYS"];
let activeKeyIndex = 0;

function apiKeys() {
  const values = KEY_ENV_NAMES
    .flatMap((name) => String(process.env[name] || "").split(","))
    .map((key) => key.trim().replace(/^["'`]+|["'`]+$/g, ""))
    .filter(Boolean);
  return [...new Set(values)];
}

export async function youtubeRequest(resource, parameters) {
  const keys = apiKeys();
  if (!keys.length) {
    const error = new Error("เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า YouTube API key");
    error.statusCode = 503;
    throw error;
  }
  const startIndex = Math.min(activeKeyIndex, keys.length - 1);
  for (let attempt = 0; attempt < keys.length; attempt += 1) {
    const keyIndex = (startIndex + attempt) % keys.length;
    try {
      const data = await fetchFromYouTube(keys[keyIndex], resource, parameters);
      activeKeyIndex = keyIndex;
      return data;
    } catch (error) {
      const quotaSpent = ["quotaExceeded", "dailyLimitExceeded"].includes(error.reason);
      if (!quotaSpent || attempt === keys.length - 1) throw error;
    }
  }
}

async function fetchFromYouTube(key, resource, parameters) {
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
      const reason = String(data?.error?.errors?.[0]?.reason || "");
      const error = new Error(reason === "commentsDisabled"
        ? "วิดีโอนี้ปิดความคิดเห็นไว้"
        : ["quotaExceeded", "dailyLimitExceeded"].includes(reason)
          ? "โควตา YouTube API เต็ม ยังดึงข้อมูลใหม่ไม่ได้"
          : response.status === 403
            ? "YouTube ปฏิเสธสิทธิ์เรียกข้อมูล กรุณาตรวจการตั้งค่า API"
          : "YouTube API ตอบกลับไม่สำเร็จ");
      error.statusCode = response.status === 429 ? 429 : reason === "commentsDisabled" ? 403 : 502;
      error.reason = reason;
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

// Lets endpoints that already fetched a channel warm the avatar cache for free.
export function seedChannelThumbnail(channelId, thumbnails, now = Date.now()) {
  const id = String(channelId || "");
  if (!id || !thumbnails) return;
  const source = thumbnails || {};
  const url = String(source.high?.url || source.medium?.url || source.default?.url || "");
  if (url) channelThumbnailCache.set(id, { at: now, url });
}

export function sendError(response, error) {
  const status = Number(error?.statusCode) || 500;
  return response.status(status).json({
    error: String(error?.message || "เกิดข้อผิดพลาดชั่วคราว"),
    ...(error?.reason ? { reason: error.reason } : {})
  });
}
