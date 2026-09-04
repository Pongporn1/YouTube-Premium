import test from "node:test";
import assert from "node:assert/strict";
import googleAuthHandler, { hasValidGoogleCsrf } from "../api/auth/google.js";

test("accepts Google's matching double-submit CSRF token", () => {
  const request = {
    headers: { cookie: "theme=dark; g_csrf_token=mobile-token%2B1" },
    body: "credential=fake&g_csrf_token=mobile-token%2B1"
  };

  assert.equal(hasValidGoogleCsrf(request), true);
});

test("rejects missing or mismatched Google CSRF tokens", () => {
  assert.equal(hasValidGoogleCsrf({ headers: {}, body: { g_csrf_token: "token" } }), false);
  assert.equal(hasValidGoogleCsrf({
    headers: { cookie: "g_csrf_token=cookie-token" },
    body: { g_csrf_token: "body-token" }
  }), false);
});

test("rejects a forged redirect POST before token verification", async () => {
  const result = { statusCode: 200, headers: {}, body: null };
  const response = {
    setHeader(name, value) { result.headers[name] = value; },
    status(code) { result.statusCode = code; return this; },
    json(body) { result.body = body; return this; },
    end() { return this; }
  };

  await googleAuthHandler({
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: "g_csrf_token=cookie-token"
    },
    body: "credential=fake&g_csrf_token=forged-token"
  }, response);

  assert.equal(result.statusCode, 403);
  assert.deepEqual(result.body, { error: "คำขอเข้าสู่ระบบไม่ถูกต้อง" });
});
