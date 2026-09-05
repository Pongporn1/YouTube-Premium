import { createHmac, timingSafeEqual } from "node:crypto";
import { isApproved } from "./family-policy.js";

const COOKIE_NAME = "mytube_session";
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function encode(value) {
  return Buffer.from(value).toString("base64url");
}

function sign(value) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET is not configured");
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function cookieValue(request) {
  const header = String(request?.headers?.cookie || "");
  for (const part of header.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === COOKIE_NAME) return value.join("=");
  }
  return "";
}

export function createSession(user, now = Date.now()) {
  const payload = encode(JSON.stringify({
    sub: String(user.sub || ""),
    email: String(user.email || "").toLowerCase(),
    name: String(user.name || "MyTube"),
    picture: String(user.picture || ""),
    exp: Math.floor(now / 1000) + MAX_AGE_SECONDS
  }));
  return `${payload}.${sign(payload)}`;
}

export function readSession(request, now = Date.now()) {
  try {
    const token = cookieValue(request);
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;
    const expected = Buffer.from(sign(payload));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
    const user = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!user.sub || !user.email || Number(user.exp) <= Math.floor(now / 1000)) return null;
    if (!isApproved(user.email)) return null;
    return user;
  } catch {
    return null;
  }
}

export function requireSession(request, response) {
  const session = readSession(request);
  if (session) return session;
  response.status(401).json({ error: "กรุณาเข้าสู่ระบบด้วย Google" });
  return null;
}

export function setSessionCookie(response, token) {
  response.setHeader("Set-Cookie", `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`);
}

export function clearSessionCookie(response) {
  response.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}
