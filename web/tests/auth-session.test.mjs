import test from "node:test";
import assert from "node:assert/strict";
import { createSession, readSession } from "../api/auth/session-core.js";
import sessionHandler from "../api/auth/session.js";

process.env.SESSION_SECRET = "test-only-secret-with-at-least-thirty-two-characters";

test("creates and verifies a signed private session", () => {
  const now = Date.UTC(2026, 8, 4);
  const token = createSession({ sub: "google-user", email: "owner@example.test", name: "Owner" }, now);
  const session = readSession({ headers: { cookie: `other=1; mytube_session=${token}` } }, now + 1000);
  assert.equal(session.sub, "google-user");
  assert.equal(session.name, "Owner");
  assert.equal(session.email, "owner@example.test");
});

test("rejects tampered and expired sessions", () => {
  const now = Date.UTC(2026, 8, 4);
  const token = createSession({ sub: "google-user", email: "owner@example.test", name: "Owner" }, now);
  assert.equal(readSession({ headers: { cookie: `mytube_session=${token}x` } }, now), null);
  assert.equal(readSession({ headers: { cookie: `mytube_session=${token}` } }, now + 8 * 24 * 60 * 60 * 1000), null);
});

test("returns only the signed-in account profile needed by the client", () => {
  const token = createSession({
    sub: "google-user",
    email: "owner@example.test",
    name: "Owner",
    picture: "https://lh3.googleusercontent.com/profile"
  });
  let payload;
  let statusCode;
  const response = {
    setHeader() {},
    status(code) { statusCode = code; return this; },
    json(value) { payload = value; return this; }
  };
  sessionHandler({ method: "GET", headers: { cookie: `mytube_session=${token}` } }, response);
  assert.equal(statusCode, 200);
  assert.deepEqual(payload, {
    authenticated: true,
    user: {
      name: "Owner",
      email: "owner@example.test",
      picture: "https://lh3.googleusercontent.com/profile"
    }
  });
  assert.equal("sub" in payload.user, false);
});
