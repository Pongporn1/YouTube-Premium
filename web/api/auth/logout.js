import { clearSessionCookie } from "./session-core.js";

export default function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }
  clearSessionCookie(response);
  response.setHeader("Cache-Control", "private, no-store");
  return response.status(200).json({ ok: true });
}
