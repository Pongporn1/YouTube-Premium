import test from 'node:test';
import assert from 'node:assert/strict';
import { readAccountPage, mergeFreshMetadata } from '../youtube-library.js';

test('reads the next page of owned playlists without requesting write access', async () => {
  const page = await readAccountPage(async (resource, params) => {
    assert.equal(resource, 'playlists');
    assert.equal(params.mine, true);
    assert.equal(params.pageToken, 'NEXT');
    return { items: [{ id: 'PL123456789', snippet: { title: 'My actual list' }, contentDetails: { itemCount: 80 } }], nextPageToken: 'MORE' };
  }, 'playlists', { pageToken: 'NEXT' });
  assert.equal(page.items[0].count, 80);
  assert.equal(page.nextPageToken, 'MORE');
});

test('playlist videos preserve playlist order even if details arrive reordered or a video is unavailable', async () => {
  const page = await readAccountPage(async (resource) => {
    if (resource === 'playlistItems') return { items: ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc'].map(videoId => ({ contentDetails: { videoId } })), nextPageToken: 'MORE' };
    return { items: [{ id: 'ccccccccccc', snippet: { title: 'Third' } }, { id: 'aaaaaaaaaaa', snippet: { title: 'First' } }] };
  }, 'playlist', { id: 'PL123456789' });
  assert.deepEqual(page.items.map(item => item.title), ['First', 'Third']);
  assert.equal(page.nextPageToken, 'MORE');
});

test('liked videos request the authenticated rating collection and keep pagination', async () => {
  const page = await readAccountPage(async (resource, params) => {
    assert.equal(resource, 'videos');
    assert.equal(params.myRating, 'like');
    return { items: [], nextPageToken: 'NEXT' };
  }, 'liked');
  assert.deepEqual(page.items, []);
  assert.equal(page.nextPageToken, 'NEXT');
});

test('subscription cards use the channel ID, not the subscription ID', async () => {
  const page = await readAccountPage(async () => ({ items: [{ id: 'subscription-id', snippet: { title: 'Channel', resourceId: { channelId: 'UC123' } } }] }), 'subscriptions');
  assert.equal(page.items[0].id, 'UC123');
  assert.equal(page.items[0].kind, 'channel');
});

test('authorization and quota errors remain errors, not a successful empty library', async () => {
  await assert.rejects(readAccountPage(async () => { throw new Error('quotaExceeded'); }, 'liked'), /quotaExceeded/);
});

test('metadata refresh preserves saved order, watch timestamps and unavailable entries', () => {
  const saved = [{ id: 'a', title: 'Old', watchedAt: 'yesterday' }, { id: 'b', title: 'Private' }];
  const merged = mergeFreshMetadata(saved, [{ id: 'a', title: 'Real', views: '100' }]);
  assert.deepEqual(merged, [{ id: 'a', title: 'Real', views: '100', watchedAt: 'yesterday' }, saved[1]]);
  assert.equal(saved[0].title, 'Old');
});
