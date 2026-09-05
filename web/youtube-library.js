import { formatAuthorizedVideo, playlistVideoIds } from './personalization-utils.js';

// The caller owns authorization and cancellation. Never persist access tokens.
export async function readAccountPage(request, view, { id = '', pageToken = '' } = {}) {
  const common = { maxResults: 50, pageToken };
  if (view === 'playlists' || view === 'subscriptions') {
    const data = await request(view, {
      ...common, part: view === 'playlists' ? 'snippet,contentDetails' : 'snippet', mine: true,
      ...(view === 'subscriptions' ? { order: 'alphabetical' } : {})
    });
    const items = (data.items || []).map(item => ({
      id: view === 'subscriptions' ? item.snippet?.resourceId?.channelId : item.id,
      title: item.snippet?.title || '',
      description: item.snippet?.description || '',
      thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || '',
      count: item.contentDetails?.itemCount,
      kind: view === 'playlists' ? 'playlist' : 'channel'
    })).filter(item => item.id);
    return { items, nextPageToken: data.nextPageToken || '', kind: 'collections' };
  }
  let data;
  if (view === 'liked') {
    data = await request('videos', { ...common, part: 'snippet,contentDetails,statistics', myRating: 'like' });
  } else if (view === 'playlist') {
    if (!/^[A-Za-z0-9_-]{10,100}$/.test(id)) throw new Error('รหัสเพลย์ลิสต์ไม่ถูกต้อง');
    const page = await request('playlistItems', { ...common, part: 'contentDetails', playlistId: id });
    const ids = playlistVideoIds(page);
    const details = ids.length ? await request('videos', { part: 'snippet,contentDetails,statistics', id: ids.join(',') }) : { items: [] };
    const byId = new Map((details.items || []).map(item => [item.id, item]));
    data = { items: ids.map(id => byId.get(id)).filter(Boolean), nextPageToken: page.nextPageToken };
  } else {
    throw new Error('ไม่รองรับหน้าข้อมูลนี้');
  }
  const items = (data.items || []).map(item => formatAuthorizedVideo(item)).filter(Boolean);
  return { items, nextPageToken: data.nextPageToken || '', kind: 'videos' };
}

export function mergeFreshMetadata(saved, fresh) {
  const byId = new Map(fresh.map(item => [item.id, item]));
  return saved.map(item => byId.has(item.id) ? { ...item, ...byId.get(item.id) } : item);
}
