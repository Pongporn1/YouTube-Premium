import { OAuth2Client } from "google-auth-library";
import { createSession, setSessionCookie } from "./session-core.js";

function requestBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string") return Object.fromEntries(new URLSearchParams(request.body));
  return {};
}

function cookieValue(request, name) {
  const header = String(request?.headers?.cookie || "");
  for (const part of header.split(";")) {
    const [cookieName, ...value] = part.trim().split("=");
    if (cookieName === name) {
      try {
        return decodeURIComponent(value.join("="));
      } catch {
        return "";
      }
    }
  }
  return "";
}

export function hasValidGoogleCsrf(request, body = requestBody(request)) {
  const cookieToken = cookieValue(request, "g_csrf_token");
  const bodyToken = String(body?.g_csrf_token || "");
  return Boolean(cookieToken && bodyToken && cookieToken === bodyToken);
}

function redirectHome(response, authError = "") {
  const location = authError ? `/?auth_error=${encodeURIComponent(authError)}` : "/";
  response.status(303);
  response.setHeader("Location", location);
  return response.end();
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const body = requestBody(request);
  const contentType = String(request.headers?.["content-type"] || "").toLowerCase();
  const isRedirectFlow = contentType.includes("application/x-www-form-urlencoded") || Boolean(body.g_csrf_token);
  if (isRedirectFlow && !hasValidGoogleCsrf(request, body)) {
    return response.status(403).json({ error: "คำขอเข้าสู่ระบบไม่ถูกต้อง" });
  }
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const allowedEmail = String(process.env.ALLOWED_GOOGLE_EMAIL || "").trim().toLowerCase();
  const credential = String(body.credential || "");
  if (!clientId || !allowedEmail || credential.length < 100 || credential.length > 5000) {
    return isRedirectFlow
      ? redirectHome(response, "failed")
      : response.status(400).json({ error: "การตั้งค่า Google Sign-In ไม่สมบูรณ์" });
  }
  try {
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    const payload = ticket.getPayload();
    const email = String(payload?.email || "").toLowerCase();
    if (!payload?.sub || payload.email_verified !== true || email !== allowedEmail) {
      return isRedirectFlow
        ? redirectHome(response, "not_allowed")
        : response.status(403).json({ error: "บัญชี Google นี้ไม่ได้รับอนุญาต" });
    }
    const user = {
      sub: payload.sub,
      email,
      name: String(payload.name || "MyTube"),
      picture: String(payload.picture || "")
    };
    setSessionCookie(response, createSession(user));
    response.setHeader("Cache-Control", "private, no-store");
    if (isRedirectFlow) return redirectHome(response);
    return response.status(200).json({ user: { name: user.name, email: user.email, picture: user.picture } });
  } catch {
    return isRedirectFlow
      ? redirectHome(response, "failed")
      : response.status(401).json({ error: "ยืนยันบัญชี Google ไม่สำเร็จ" });
  }
}
