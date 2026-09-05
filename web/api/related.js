import { requireSession } from "./auth/session-core.js";
import { addChannelThumbnails, formatVideo, normalizePageToken, normalizeVideoId, sendError, youtubeRequest } from "./youtube-client.js";

// YouTube retired relatedToVideoId, so "Up next" is derived from the source
// video title with a scoped search. The search quota cost applies only when a
// signed-in viewer opens a video, never on page load.
function relatedQuery(title) {
  return String(title || "")
    .replace(/[\[\](){}"'|#【】「」]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 10)
    .join(" ")
    .slice(0, 60)
    .trim();
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }
  if (!requireSession(request, response)) return;
  const id = normalizeVideoId(request.query.id);
  if (!id) return response.status(400).json({ error: "รหัสวิดีโอไม่ถูกต้อง" });
  try {
    const source = await youtubeRequest("videos", { part: "snippet", id, maxResults: 1 });
    const snippet = source.items?.[0]?.snippet;
    if (!snippet) return response.status(404).json({ error: "ไม่พบวิดีโอนี้บน YouTube" });
    const query = relatedQuery(snippet.title);
    if (!query) {
      response.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=3600");
      return response.status(200).json({ items: [], nextPageToken: "" });
    }
    const search = await youtubeRequest("search", {
      part: "snippet",
      type: "video",
      q: query,
      maxResults: 12,
      regionCode: "TH",
      relevanceLanguage: "th",
      safeSearch: "moderate",
      pageToken: normalizePageToken(request.query.pageToken)
    });
    const ids = [...new Set((search.items || []).map((item) => item?.id?.videoId).filter(Boolean))]
      .filter((videoId) => videoId !== id);
    const details = ids.length
      ? await youtubeRequest("videos", { part: "snippet,contentDetails,statistics", id: ids.join(",") })
      : { items: [] };
    const byId = new Map((details.items || []).map((item) => [item.id, item]));
    const ordered = ids.map((videoId) => byId.get(videoId)).filter(Boolean);
    const items = await addChannelThumbnails(ordered.map(formatVideo).filter(Boolean));
    // Recommendations are public and shared across viewers: CDN caching keeps
    // repeat views of the same video from spending 100 search units again.
    response.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=3600");
    return response.status(200).json({
      items,
      nextPageToken: String(search.nextPageToken || "")
    });
  } catch (error) {
    return sendError(response, error);
  }
}
