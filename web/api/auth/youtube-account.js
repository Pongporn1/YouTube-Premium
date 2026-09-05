import { requireSession } from "../../lib/session-core.js";
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  const user = requireSession(request, response);
  if (!user) return;
  const token = request.body?.accessToken;
  if (typeof token !== "string" || token.length > 4096 || token.length < 20) return response.status(400).json({ error: "Invalid token" });
  try {
    const result = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000)
    });
    const identity = await result.json();
    if (!result.ok || identity.email_verified !== true || identity.sub !== user.sub ||
        String(identity.email || "").toLowerCase() !== user.email) return response.status(403).json({ error: "Account mismatch" });
    return response.status(200).json({ verified: true });
  } catch { return response.status(502).json({ error: "Unable to verify account" }); }
}
