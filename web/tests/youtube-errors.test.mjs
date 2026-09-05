import test from 'node:test';
import assert from 'node:assert/strict';
import { youtubeRequest } from '../lib/youtube-client.js';
process.env.YOUTUBE_API_KEY='test-only';
test('quota errors and permission errors have distinct messages', async t => {
  let reason='quotaExceeded';
  t.mock.method(globalThis,'fetch',async()=>({ok:false,status:403,json:async()=>({error:{errors:[{reason}]}})}));
  await assert.rejects(youtubeRequest('videos',{}), /โควตา/);
  reason='forbidden';
  await assert.rejects(youtubeRequest('videos',{}), /ปฏิเสธสิทธิ์/);
});

test('falls over to the next key when one project is out of quota', async t => {
  const usedKeys = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    const key = new URL(String(url)).searchParams.get('key');
    usedKeys.push(key);
    if (key === 'key-one') {
      return { ok: false, status: 403, json: async () => ({ error: { errors: [{ reason: 'quotaExceeded' }] } }) };
    }
    return { ok: true, status: 200, json: async () => ({ items: [{ id: 'dQw4w9WgXcQ' }] }) };
  });
  process.env.YOUTUBE_API_KEY = 'key-one';
  process.env.YOUTUBE_API_KEYS = 'key-two';
  const data = await youtubeRequest('videos', {});
  assert.deepEqual(data.items.map((item) => item.id), ['dQw4w9WgXcQ']);
  assert.deepEqual(usedKeys, ['key-one', 'key-two']);
  // The warm instance stays on the working key instead of retrying the spent one.
  await youtubeRequest('videos', {});
  assert.deepEqual(usedKeys, ['key-one', 'key-two', 'key-two']);
  process.env.YOUTUBE_API_KEY = 'test-only';
  delete process.env.YOUTUBE_API_KEYS;
});
