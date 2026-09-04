import { addChannelThumbnails, formatVideo, normalizeCategory, normalizePageToken, sendError, youtubeRequest } from "./youtube-client.js";
import { requireSession } from "./auth/session-core.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }
  if (!requireSession(request, response)) return;
  try {
    const data = await youtubeRequest("videos", {
      part: "snippet,contentDetails,statistics",
      chart: "mostPopular",
      regionCode: "TH",
      maxResults: 24,
      videoCategoryId: normalizeCategory(request.query.category),
      pageToken: normalizePageToken(request.query.pageToken)
    });
    response.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
    const items = await addChannelThumbnails((data.items || []).map(formatVideo).filter(Boolean));
    return response.status(200).json({
      items,
      nextPageToken: String(data.nextPageToken || "")
    });
  } catch (error) {
    return sendError(response, error);
  }
}
