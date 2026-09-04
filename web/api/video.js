const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const videoId = String(request.query.id || "");
  if (!VIDEO_ID_PATTERN.test(videoId)) {
    return response.status(400).json({ error: "Invalid YouTube video ID" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
    const upstream = await fetch(oembedUrl, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    if (!upstream.ok) {
      return response.status(upstream.status === 404 ? 404 : 502).json({ error: "Video metadata unavailable" });
    }
    const data = await upstream.json();
    response.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return response.status(200).json({
      id: videoId,
      title: String(data.title || `YouTube video ${videoId}`).slice(0, 300),
      author: String(data.author_name || "YouTube").slice(0, 120),
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    });
  } catch (error) {
    const status = error?.name === "AbortError" ? 504 : 502;
    return response.status(status).json({ error: "Video metadata unavailable" });
  } finally {
    clearTimeout(timeout);
  }
}
