export default function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const clientId = process.env.GOOGLE_CLIENT_ID;
  response.setHeader("Cache-Control", "private, no-store");
  if (!clientId) return response.status(503).json({ error: "Google Sign-In is not configured" });
  return response.status(200).json({ clientId });
}
