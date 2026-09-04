import { formatVideo, normalizePageToken, normalizeQuery, sendError, youtubeRequest } from "./youtube-client.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }
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
      pageToken: normalizePageToken(request.query.pageToken)
    });
    const ids = (search.items || []).map((item) => item?.id?.videoId).filter(Boolean).join(",");
    const details = ids ? await youtubeRequest("videos", { part: "snippet,contentDetails,statistics", id: ids }) : { items: [] };
    response.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=1800");
    return response.status(200).json({
      items: (details.items || []).map(formatVideo).filter(Boolean),
      nextPageToken: String(search.nextPageToken || "")
    });
  } catch (error) {
    return sendError(response, error);
  }
}
