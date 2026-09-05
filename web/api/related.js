import { requireSession } from "./auth/session-core.js";
import { addChannelThumbnails, formatVideo, normalizePageToken, normalizeVideoId, seedChannelThumbnail, sendError, youtubeRequest } from "./youtube-client.js";

const CHANNEL_ID_PATTERN = /^UC[A-Za-z0-9_-]{22}$/;

// YouTube retired relatedToVideoId and search.list costs 100 quota units, so
// "Up next" reuses the same channel uploads playlist: three cheap calls
// (channels, playlistItems, videos) instead of one expensive search. The client
// mixes in same-category items it already has from the feed.
export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }
  if (!requireSession(request, response)) return;
  const channelId = String(request.query.channelId || "").trim();
  const exclude = normalizeVideoId(request.query.exclude);
  if (!CHANNEL_ID_PATTERN.test(channelId)) return response.status(400).json({ error: "Invalid channel ID" });
  try {
    const channels = await youtubeRequest("channels", { part: "contentDetails,snippet", id: channelId });
    const channel = channels.items?.[0];
    const uploads = String(channel?.contentDetails?.relatedPlaylists?.uploads || "");
    if (!channel || !uploads) {
      response.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=3600");
      return response.status(200).json({ items: [], nextPageToken: "" });
    }
    seedChannelThumbnail(channel.id, channel.snippet?.thumbnails);
    const page = await youtubeRequest("playlistItems", {
      part: "contentDetails",
      playlistId: uploads,
      maxResults: 15,
      pageToken: normalizePageToken(request.query.pageToken)
    });
    const ids = [...new Set((page.items || []).map((item) => item?.contentDetails?.videoId).filter(Boolean))]
      .filter((videoId) => videoId !== exclude);
    const details = ids.length
      ? await youtubeRequest("videos", { part: "snippet,contentDetails,statistics", id: ids.join(",") })
      : { items: [] };
    const byId = new Map((details.items || []).map((item) => [item.id, item]));
    const ordered = ids.map((videoId) => byId.get(videoId)).filter(Boolean);
    const items = await addChannelThumbnails(ordered.map(formatVideo).filter(Boolean));
    // Recommendations are public and identical for every viewer: brief CDN
    // caching keeps repeat views from spending the same cheap calls again.
    response.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=3600");
    return response.status(200).json({
      items,
      nextPageToken: String(page.nextPageToken || "")
    });
  } catch (error) {
    return sendError(response, error);
  }
}
