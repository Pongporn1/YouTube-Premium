import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/search.js';
import { createSession } from '../api/auth/session-core.js';

process.env.SESSION_SECRET = 'search-tests-only-secret-at-least-thirty-two-characters';
process.env.YOUTUBE_API_KEY = 'test-only';
const headers = () => ({cookie: `mytube_session=${createSession({sub:'test',email:'test@example.test'})}`});
const response = () => ({headers:{}, setHeader(k,v){this.headers[k]=v;}, status(code){this.code=code;return this;}, json(data){this.data=data;return this;}});

test('search requires authentication and a nonempty query', async () => {
  const denied=response();
  await handler({method:'GET',query:{q:'music'},headers:{}},denied);
  assert.equal(denied.code,401);
  const empty=response();
  await handler({method:'GET',query:{q:'  '},headers:headers()},empty);
  assert.equal(empty.code,400);
});

test('search forwards real filters and pagination while preserving relevance order', async t => {
  const calls=[];
  t.mock.method(globalThis,'fetch', async url => {
    calls.push(url);
    const data=url.pathname.endsWith('/search')
      ? {items:[{id:{videoId:'aaaaaaaaaaa'}},{id:{videoId:'bbbbbbbbbbb'}}],nextPageToken:'NEXT'}
      : {items:[{id:'bbbbbbbbbbb',snippet:{title:'Second'}},{id:'aaaaaaaaaaa',snippet:{title:'First'}}]};
    return {ok:true,json:async()=>data};
  });
  const result=response();
  await handler({method:'GET',query:{q:'เพลง Lisa',order:'date',duration:'long',pageToken:'PAGE2'},headers:headers()},result);
  assert.equal(result.code,200);
  assert.deepEqual(result.data.items.map(v=>v.title),['First','Second']);
  assert.equal(result.data.nextPageToken,'NEXT');
  const params=calls[0].searchParams;
  assert.equal(params.get('q'),'เพลง Lisa');
  assert.equal(params.get('order'),'date');
  assert.equal(params.get('videoDuration'),'long');
  assert.equal(params.get('pageToken'),'PAGE2');
  assert.equal(result.headers['Cache-Control'],'private, no-store');
  const invalid=response();
  await handler({method:'GET',query:{q:'music',order:'invalid',duration:'invalid'},headers:headers()},invalid);
  assert.equal(calls[2].searchParams.get('order'),'relevance');
  assert.equal(calls[2].searchParams.get('videoDuration'),'any');
});
