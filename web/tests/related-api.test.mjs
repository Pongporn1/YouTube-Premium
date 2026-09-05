import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/related.js';
import { createSession } from '../api/auth/session-core.js';

process.env.SESSION_SECRET = 'related-tests-only-secret-at-least-thirty-two-chars';
process.env.YOUTUBE_API_KEY = 'test-only';
const headers = () => ({cookie: `mytube_session=${createSession({sub:'test',email:'test@example.test'})}`});
const response = () => ({headers:{}, setHeader(k,v){this.headers[k]=v;}, status(code){this.code=code;return this;}, json(data){this.data=data;return this;}});

test('related requires authentication and a valid video id', async () => {
  const denied = response();
  await handler({method:'GET',query:{id:'aaaaaaaaaaa'},headers:{}},denied);
  assert.equal(denied.code,401);
  const invalid = response();
  await handler({method:'GET',query:{id:'nope'},headers:headers()},invalid);
  assert.equal(invalid.code,400);
});

test('related derives a search from the source title, excludes the current video and paginates', async t => {
  const calls = [];
  t.mock.method(globalThis,'fetch', async url => {
    calls.push(url);
    let data;
    if (url.pathname.endsWith('/search')) data = {items:[{id:{videoId:'aaaaaaaaaaa'}},{id:{videoId:'bbbbbbbbbbb'}},{id:{videoId:'bbbbbbbbbbb'}},{id:{videoId:'ccccccccccc'}}],nextPageToken:'NEXT'};
    else if (url.pathname.endsWith('/videos') && url.searchParams.get('part') === 'snippet') data = {items:[{id:'aaaaaaaaaaa',snippet:{title:'เพลงใหม่ล่าสุด (Official MV)'}}]};
    else if (url.pathname.endsWith('/videos')) data = {items:[{id:'ccccccccccc',snippet:{title:'Third'}},{id:'bbbbbbbbbbb',snippet:{title:'Second'}}]};
    else data = {items:[]};
    return {ok:true,json:async()=>data};
  });
  const result = response();
  await handler({method:'GET',query:{id:'aaaaaaaaaaa'},headers:headers()},result);
  assert.equal(result.code,200);
  assert.deepEqual(result.data.items.map(v=>v.id),['bbbbbbbbbbb','ccccccccccc']);
  assert.equal(result.data.nextPageToken,'NEXT');
  assert.equal(calls[0].searchParams.get('id'),'aaaaaaaaaaa');
  assert.equal(calls[1].searchParams.get('q'),'เพลงใหม่ล่าสุด Official MV');
  assert.equal(result.headers['Cache-Control'],'public, s-maxage=1800, stale-while-revalidate=3600');
  const next = response();
  await handler({method:'GET',query:{id:'aaaaaaaaaaa',pageToken:'NEXT'},headers:headers()},next);
  assert.equal(next.code,200);
  assert.equal(calls[4].searchParams.get('pageToken'),'NEXT');
});

test('related reports a missing source video', async t => {
  t.mock.method(globalThis,'fetch', async () => ({ok:true,json:async()=>({items:[]})}));
  const result = response();
  await handler({method:'GET',query:{id:'aaaaaaaaaaa'},headers:headers()},result);
  assert.equal(result.code,404);
});
