import { OAuth2Client } from "google-auth-library";
import { createSession, setSessionCookie } from "./session-core.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const allowedEmail = String(process.env.ALLOWED_GOOGLE_EMAIL || "").trim().toLowerCase();
  const credential = String(request.body?.credential || "");
  if (!clientId || !allowedEmail || credential.length < 100 || credential.length > 5000) {
    return response.status(400).json({ error: "การตั้งค่า Google Sign-In ไม่สมบูรณ์" });
  }
  try {
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    const payload = ticket.getPayload();
    const email = String(payload?.email || "").toLowerCase();
    if (!payload?.sub || payload.email_verified !== true || email !== allowedEmail) {
      return response.status(403).json({ error: "บัญชี Google นี้ไม่ได้รับอนุญาต" });
    }
    const user = {
      sub: payload.sub,
      email,
      name: String(payload.name || "MyTube"),
      picture: String(payload.picture || "")
    };
    setSessionCookie(response, createSession(user));
    response.setHeader("Cache-Control", "private, no-store");
    return response.status(200).json({ user: { name: user.name, email: user.email, picture: user.picture } });
  } catch {
    return response.status(401).json({ error: "ยืนยันบัญชี Google ไม่สำเร็จ" });
  }
}
