import { addChannelThumbnails, formatVideo, normalizePageToken, normalizeQuery, sendError, youtubeRequest } from "../lib/youtube-client.js";
import { requireSession } from "../lib/session-core.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }
  if (!requireSession(request, response)) return;
  const query = normalizeQuery(request.query.q);
  if (!query) return response.status(400).json({ error: "กรุณาพิมพ์คำค้นหา" });
  try {
    const search = await youtubeRequest("search", {
      part: "snippet",
      type: "video",
      q: query,
      maxResults: 24,
      regionCode: "TH",
      relevanceLanguage: "th",
      safeSearch: "moderate",
      order: ["relevance", "date", "viewCount"].includes(request.query.order) ? request.query.order : "relevance",
      videoDuration: ["short", "medium", "long"].includes(request.query.duration) ? request.query.duration : "any",
      pageToken: normalizePageToken(request.query.pageToken)
    });
    const ids = (search.items || []).map((item) => item?.id?.videoId).filter(Boolean).join(",");
    const details = ids ? await youtubeRequest("videos", { part: "snippet,contentDetails,statistics", id: ids }) : { items: [] };
    // Public results identical for every viewer: brief CDN caching saves the
    // 10,000-unit daily quota without exposing any account data.
    response.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=1800");
    const byId = new Map((details.items || []).map(item => [item.id, item]));
    const ordered = ids.split(",").map(id => byId.get(id)).filter(Boolean);
    const items = await addChannelThumbnails(ordered.map(formatVideo).filter(Boolean));
    return response.status(200).json({
      items,
      nextPageToken: String(search.nextPageToken || "")
    });
  } catch (error) {
    return sendError(response, error);
  }
}
