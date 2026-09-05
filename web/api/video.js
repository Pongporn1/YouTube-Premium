const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
import { requireSession } from "../lib/session-core.js";
import { addChannelThumbnails, formatVideo, sendError, youtubeRequest } from "../lib/youtube-client.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }
  if (!requireSession(request, response)) return;

  const ids = String(request.query.ids || request.query.id || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index);
  if (ids.length === 0 || ids.length > 50 || ids.some((id) => !VIDEO_ID_PATTERN.test(id))) {
    return response.status(400).json({ error: "Invalid YouTube video ID" });
  }

  try {
    const data = await youtubeRequest("videos", {
      part: "snippet,contentDetails,statistics",
      id: ids.join(","),
      maxResults: ids.length
    });
    const items = await addChannelThumbnails((data.items || []).map(formatVideo).filter(Boolean));
    response.setHeader("Cache-Control", "private, no-store");
    if (request.query.ids) return response.status(200).json({ items });
    if (items.length === 0) return response.status(404).json({ error: "Video metadata unavailable" });
    return response.status(200).json(items[0]);
  } catch (error) {
    return sendError(response, error);
  }
}
