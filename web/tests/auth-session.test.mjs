import test from "node:test";
import assert from "node:assert/strict";
import { createSession, readSession } from "../api/auth/session-core.js";

process.env.SESSION_SECRET = "test-only-secret-with-at-least-thirty-two-characters";

test("creates and verifies a signed private session", () => {
  const now = Date.UTC(2026, 8, 4);
  const token = createSession({ sub: "google-user", email: "owner@example.test", name: "Owner" }, now);
  const session = readSession({ headers: { cookie: `other=1; mytube_session=${token}` } }, now + 1000);
  assert.equal(session.sub, "google-user");
  assert.equal(session.name, "Owner");
});

test("rejects tampered and expired sessions", () => {
  const now = Date.UTC(2026, 8, 4);
  const token = createSession({ sub: "google-user", email: "owner@example.test", name: "Owner" }, now);
  assert.equal(readSession({ headers: { cookie: `mytube_session=${token}x` } }, now), null);
  assert.equal(readSession({ headers: { cookie: `mytube_session=${token}` } }, now + 8 * 24 * 60 * 60 * 1000), null);
});
