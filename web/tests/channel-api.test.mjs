import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/channel.js';
import { createSession } from '../api/auth/session-core.js';

process.env.SESSION_SECRET = 'channel-tests-only-secret-at-least-thirty-two-characters';
process.env.ALLOWED_GOOGLE_EMAIL = 'test@example.test';
function response() {
  return { headers: {}, code: 0, data: null, setHeader(k,v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
}
const headers = () => ({ cookie: `mytube_session=${createSession({ sub: 'test', email: 'test@example.test' })}` });

test('channel endpoint requires login and validates channel IDs before contacting YouTube', async () => {
  const denied = response();
  await handler({ method: 'GET', query: {}, headers: {} }, denied);
  assert.equal(denied.code, 401);
  const invalid = response();
  await handler({ method: 'GET', query: {id:'not-a-channel'}, headers: headers() }, invalid);
  assert.equal(invalid.code, 400);
  assert.equal(invalid.headers['Cache-Control'], 'private, no-store');
});

test('channel endpoint returns real upload metadata in playlist order and next-page token', async t => {
  process.env.YOUTUBE_API_KEY = 'test-only';
  const calls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    calls.push(url);
    let data;
    if (url.pathname.endsWith('/channels')) data = { items: [{ id: 'UCaaaaaaaaaaaaaaaaaaaaaa', snippet: { title: 'Channel' }, statistics: { subscriberCount: '500' }, contentDetails: { relatedPlaylists: { uploads: 'UUaaaaaaaaaaaaaaaaaaaaaa' } } }] };
    else if (url.pathname.endsWith('/playlistItems')) data = {items:['aaaaaaaaaaa','bbbbbbbbbbb'].map(videoId => ({contentDetails:{videoId}})), nextPageToken:'NEXT'};
    else data = {items:[{id:'bbbbbbbbbbb',snippet:{title:'Second'}},{id:'aaaaaaaaaaa',snippet:{title:'First'}}]};
    return {ok:true,json:async()=>data};
  });
  const result = response();
  await handler({method:'GET',query:{id:'UCaaaaaaaaaaaaaaaaaaaaaa',pageToken:'PAGE2'},headers:headers()},result);
  assert.equal(result.code,200);
  assert.deepEqual(result.data.items.map(v=>v.title),['First','Second']);
  assert.equal(result.data.channel.subscribers,'500');
  assert.equal(result.data.nextPageToken,'NEXT');
  assert.equal(calls.find(url=>url.pathname.endsWith('/playlistItems')).searchParams.get('pageToken'),'PAGE2');
});
