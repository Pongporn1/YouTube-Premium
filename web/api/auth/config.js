export default function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const clientId = process.env.GOOGLE_CLIENT_ID;
  response.setHeader("Cache-Control", "private, no-store");
  if (!clientId) return response.status(503).json({ error: "Google Sign-In is not configured" });
  // Key COUNT only (never values) so the deployed runtime can be probed for
  // whether every configured YouTube API key actually reached the function.
  const configuredKeys = [
    process.env.YOUTUBE_API_KEY,
    String(process.env.YOUTUBE_API_KEYS || "").split(","),
    process.env.YOUTUBE_API_KEY_2,
    process.env.YOUTUBE_API_KEY_3,
  ].flat().map((key) => String(key || "").trim()).filter(Boolean);
  return response.status(200).json({
    clientId,
    // Public identifiers only; client IDs appear in page source by design.
    youtubeDataClientId: String(process.env.YOUTUBE_DATA_CLIENT_ID || ""),
    youtubeApiKeys: configuredKeys.length
  });
}
