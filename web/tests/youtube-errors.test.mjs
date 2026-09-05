import test from 'node:test';
import assert from 'node:assert/strict';
import { youtubeRequest } from '../api/youtube-client.js';
process.env.YOUTUBE_API_KEY='test-only';
test('quota errors and permission errors have distinct messages', async t => {
  let reason='quotaExceeded';
  t.mock.method(globalThis,'fetch',async()=>({ok:false,status:403,json:async()=>({error:{errors:[{reason}]}})}));
  await assert.rejects(youtubeRequest('videos',{}), /โควตา/);
  reason='forbidden';
  await assert.rejects(youtubeRequest('videos',{}), /ปฏิเสธสิทธิ์/);
});
