import { randomBytes } from "node:crypto";
import { requireSession } from "../lib/session-core.js";

// Silent YouTube reconnection via the offline-access (refresh-token) flow.
// The refresh token lives in an HttpOnly cookie scoped to this endpoint, so
// the browser can mint fresh access tokens without ever showing a popup
// again after the one-time consent. Everything else about the token stays
// in memory on the client.
const STATE_COOKIE = "mytube_yt_state";
const REFRESH_COOKIE = "mytube_yt_rt";
const SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // Google revokes unused refresh tokens after six months anyway.

function requestHost(request) {
  return String(request.headers["x-forwarded-host"] || request.headers.host || "mytube-private-web.vercel.app").split(",")[0].trim();
}

function cookieValue(request, name) {
  const header = String(request.headers.cookie || "");
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return "";
}

function secureCookie(name, value, maxAge) {
  return `${name}=${value}; Path=/api/youtube-auth; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function dataCredentials() {
  return {
    clientId: String(process.env.YOUTUBE_DATA_CLIENT_ID || ""),
    clientSecret: String(process.env.YOUTUBE_DATA_CLIENT_SECRET || ""),
  };
}

function redirectUri(request) {
  return `https://${requestHost(request)}/api/youtube-auth`;
}

async function exchangeGoogleToken(payload) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(payload),
  });
  return response.json().catch(() => ({}));
}

function redirectTo(response, location) {
  response.setHeader("Cache-Control", "private, no-store");
  response.writeHead(302, { Location: location });
  response.end();
}

function handleStart(request, response, session) {
  const { clientId, clientSecret } = dataCredentials();
  if (!clientId || !clientSecret) {
    return response.status(503).json({ error: "ยังไม่ได้ตั้งค่า OAuth client สำหรับข้อมูล YouTube" });
  }

  const state = randomBytes(16).toString("hex");
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri(request));
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPE);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);
  if (session.email) authUrl.searchParams.set("login_hint", session.email);

  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("Set-Cookie", secureCookie(STATE_COOKIE, state, 600));
  return redirectTo(response, authUrl.toString());
}

async function handleCallback(request, response, url) {
  const code = String(url.searchParams.get("code") || "");
  const state = String(url.searchParams.get("state") || "");
  const savedState = cookieValue(request, STATE_COOKIE);
  const back = (marker) => redirectTo(response, `https://${requestHost(request)}/?youtube=${marker}`);

  if (!code || !state || !savedState || savedState !== state) {
    return back("error");
  }

  const { clientId, clientSecret } = dataCredentials();
  if (!clientId || !clientSecret) {
    return back("error");
  }

  const data = await exchangeGoogleToken({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri(request),
    grant_type: "authorization_code",
  });
  const refreshToken = String(data.refresh_token || "");
  if (!refreshToken) {
    return back("error");
  }

  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("Set-Cookie", [
    secureCookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_MAX_AGE),
    secureCookie(STATE_COOKIE, "", 0),
  ]);
  return back("connected");
}

async function handleToken(request, response) {
  const refreshToken = cookieValue(request, REFRESH_COOKIE);
  if (!refreshToken) {
    return response.status(401).json({ error: "ยังไม่ได้เชื่อมข้อมูล YouTube" });
  }

  const { clientId, clientSecret } = dataCredentials();
  if (!clientId || !clientSecret) {
    return response.status(503).json({ error: "ยังไม่ได้ตั้งค่า OAuth client สำหรับข้อมูล YouTube" });
  }

  const data = await exchangeGoogleToken({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });
  const accessToken = String(data.access_token || "");
  if (!accessToken) {
    // Revoked or expired refresh token: drop the cookie so the next connect starts clean.
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("Set-Cookie", secureCookie(REFRESH_COOKIE, "", 0));
    return response.status(401).json({ error: "สิทธิ์ YouTube หมดอายุ กรุณากดเชื่อมอีกครั้ง" });
  }

  response.setHeader("Cache-Control", "private, no-store");
  return response.status(200).json({
    accessToken,
    expiresIn: Math.max(300, Number(data.expires_in) || 3600)
  });
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const url = new URL(request.url, `https://${requestHost(request)}`);

  if (url.searchParams.get("code") && url.searchParams.get("state")) {
    return handleCallback(request, response, url);
  }

  if (url.searchParams.get("action") === "token") {
    // The refresh-token cookie itself authorizes minting; the MyTube session
    // only proves the viewer belongs here.
    if (!requireSession(request, response)) return;
    return handleToken(request, response);
  }

  const session = requireSession(request, response);
  if (!session) return;
  return handleStart(request, response, session);
}
