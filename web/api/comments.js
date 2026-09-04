import { requireSession } from "./auth/session-core.js";
import { formatCommentThread, normalizePageToken, normalizeVideoId, sendError, youtubeRequest } from "./youtube-client.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }
  if (!requireSession(request, response)) return;

  const videoId = normalizeVideoId(request.query.videoId);
  if (!videoId) return response.status(400).json({ error: "Invalid YouTube video ID" });
  const order = request.query.order === "time" ? "time" : "relevance";

  try {
    const data = await youtubeRequest("commentThreads", {
      part: "snippet,replies",
      videoId,
      maxResults: 20,
      order,
      textFormat: "plainText",
      pageToken: normalizePageToken(request.query.pageToken)
    });
    response.setHeader("Cache-Control", "private, max-age=0, s-maxage=60, stale-while-revalidate=180");
    return response.status(200).json({
      items: (data.items || []).map(formatCommentThread).filter(Boolean),
      nextPageToken: String(data.nextPageToken || ""),
      totalResults: Math.max(0, Number(data.pageInfo?.totalResults) || 0),
      disabled: false
    });
  } catch (error) {
    if (error?.reason === "commentsDisabled") {
      return response.status(200).json({ items: [], nextPageToken: "", totalResults: 0, disabled: true });
    }
    return sendError(response, error);
  }
}
