import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/youtube-auth.js';
import { createSession } from '../lib/session-core.js';

process.env.SESSION_SECRET = 'youtube-auth-tests-only-secret-at-least-32ch';
process.env.YOUTUBE_DATA_CLIENT_ID = 'data-client-id.apps.googleusercontent.com';
process.env.YOUTUBE_DATA_CLIENT_SECRET = 'data-client-secret';

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, value) {
      if (this.headers[key]) this.headers[key] = [].concat(this.headers[key], value);
      else this.headers[key] = value;
    },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    writeHead(code, headers) { this.statusCode = code; Object.assign(this.headers, headers); return this; },
    end() { return this; }
  };
}

const sessionCookie = `mytube_session=${createSession({ sub: 'user-1', email: 'ballboss6184@gmail.com' })}`;

test('start redirects to Google consent with the data client and a state cookie', async () => {
  const response = mockResponse();
  await handler({
    method: 'GET',
    url: 'https://mytube-private-web.vercel.app/api/youtube-auth',
    headers: { cookie: sessionCookie, host: 'mytube-private-web.vercel.app' }
  }, response);
  assert.equal(response.statusCode, 302);
  assert.match(String(response.headers.Location), /accounts\.google\.com\/o\/oauth2\/v2\/auth/);
  assert.match(String(response.headers.Location), /client_id=data-client-id/);
  assert.match(String(response.headers.Location), /access_type=offline/);
  assert.match(String(response.headers.Location), /login_hint=ballboss6184/);
  const cookies = [].concat(response.headers['Set-Cookie']);
  assert.equal(cookies.some((cookie) => cookie.startsWith('mytube_yt_state=')), true);
  assert.equal(cookies.every((cookie) => cookie.includes('HttpOnly')), true);
});

test('token mode without a refresh cookie answers 401', async () => {
  const response = mockResponse();
  await handler({
    method: 'GET',
    url: 'https://mytube-private-web.vercel.app/api/youtube-auth?action=token',
    headers: { cookie: sessionCookie }
  }, response);
  assert.equal(response.statusCode, 401);
});
