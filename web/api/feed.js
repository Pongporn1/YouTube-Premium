import { addChannelThumbnails, formatVideo, isStrictMusicVideo, normalizeCategory, normalizePageToken, sendError, youtubeRequest } from "../lib/youtube-client.js";
import { requireSession } from "../lib/session-core.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }
  if (!requireSession(request, response)) return;
  try {
    const category = normalizeCategory(request.query.category);
    const isMusicCategory = category === "10";
    const data = await youtubeRequest("videos", {
      part: "snippet,contentDetails,statistics",
      chart: "mostPopular",
      regionCode: "TH",
      maxResults: isMusicCategory ? 50 : 24,
      videoCategoryId: category,
      pageToken: normalizePageToken(request.query.pageToken)
    });
    response.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
    let rawItems = data.items || [];
    if (isMusicCategory) {
      rawItems = rawItems.filter(isStrictMusicVideo);
    }
    const formatted = rawItems.map(formatVideo).filter(Boolean);
    const selected = isMusicCategory ? formatted.slice(0, 24) : formatted;
    const items = await addChannelThumbnails(selected);
    return response.status(200).json({
      items,
      nextPageToken: String(data.nextPageToken || "")
    });
  } catch (error) {
    return sendError(response, error);
  }
}
