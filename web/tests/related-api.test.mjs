import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/related.js';
import { createSession } from '../api/auth/session-core.js';

process.env.SESSION_SECRET = 'related-tests-only-secret-at-least-thirty-two-chars';
process.env.ALLOWED_GOOGLE_EMAIL = 'test@example.test';
process.env.YOUTUBE_API_KEY = 'test-only';
const headers = () => ({cookie: `mytube_session=${createSession({sub:'test',email:'test@example.test'})}`});
const response = () => ({headers:{}, setHeader(k,v){this.headers[k]=v;}, status(code){this.code=code;return this;}, json(data){this.data=data;return this;}});

const CHANNEL = 'UCaaaaaaaaaaaaaaaaaaaaaa';

test('related requires authentication and a valid channel id', async () => {
  const denied = response();
  await handler({method:'GET',query:{channelId:CHANNEL,exclude:'aaaaaaaaaaa'},headers:{}},denied);
  assert.equal(denied.code,401);
  const invalid = response();
  await handler({method:'GET',query:{channelId:'nope',exclude:'aaaaaaaaaaa'},headers:headers()},invalid);
  assert.equal(invalid.code,400);
});

test('related reuses the channel uploads playlist and excludes the playing video', async t => {
  const calls = [];
  t.mock.method(globalThis,'fetch', async url => {
    calls.push(url);
    let data;
    if (url.pathname.endsWith('/channels')) data = {items:[{id:CHANNEL,contentDetails:{relatedPlaylists:{uploads:'UUaaaaaaaaaaaaaaaaaaaaaa'}},snippet:{thumbnails:{high:{url:'https://yt3.ggpht.com/channel'}}}}]};
    else if (url.pathname.endsWith('/playlistItems')) data = {items:['aaaaaaaaaaa','bbbbbbbbbbb','ccccccccccc'].map(videoId=>({contentDetails:{videoId}})),nextPageToken:'NEXT'};
    else if (url.pathname.endsWith('/videos')) data = {items:[{id:'ccccccccccc',snippet:{title:'Third'}},{id:'bbbbbbbbbbb',snippet:{title:'Second'}}]};
    else data = {items:[]};
    return {ok:true,json:async()=>data};
  });
  const result = response();
  await handler({method:'GET',query:{channelId:CHANNEL,exclude:'aaaaaaaaaaa'},headers:headers()},result);
  assert.equal(result.code,200);
  assert.deepEqual(result.data.items.map(v=>v.id),['bbbbbbbbbbb','ccccccccccc']);
  assert.equal(result.data.nextPageToken,'NEXT');
  assert.equal(calls[1].searchParams.get('playlistId'),'UUaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(calls[1].searchParams.get('maxResults'),'15');
  assert.equal(result.headers['Cache-Control'],'public, s-maxage=1800, stale-while-revalidate=3600');
  const next = response();
  await handler({method:'GET',query:{channelId:CHANNEL,exclude:'aaaaaaaaaaa',pageToken:'NEXT'},headers:headers()},next);
  assert.equal(next.code,200);
  assert.equal(calls[4].searchParams.get('pageToken'),'NEXT');
});

test('related returns empty items when the channel has no uploads playlist', async t => {
  t.mock.method(globalThis,'fetch', async () => ({ok:true,json:async()=>({items:[]})}));
  const result = response();
  await handler({method:'GET',query:{channelId:CHANNEL,exclude:'aaaaaaaaaaa'},headers:headers()},result);
  assert.equal(result.code,200);
  assert.deepEqual(result.data.items,[]);
});
