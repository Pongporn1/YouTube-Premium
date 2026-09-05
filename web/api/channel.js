import { requireSession } from './auth/session-core.js';
import { addChannelThumbnails, formatVideo, normalizePageToken, sendError, youtubeRequest } from './youtube-client.js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'private, no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireSession(request, response)) return;
  const id = String(request.query.id || '');
  if (!/^UC[A-Za-z0-9_-]{22}$/.test(id)) return response.status(400).json({ error: 'Invalid channel ID' });
  try {
    const channels = await youtubeRequest('channels', { part: 'snippet,contentDetails,statistics', id });
    const channel = channels.items?.[0];
    if (!channel) return response.status(404).json({ error: 'ไม่พบช่องนี้บน YouTube' });
    const uploads = channel.contentDetails?.relatedPlaylists?.uploads;
    const page = uploads ? await youtubeRequest('playlistItems', {
      part: 'contentDetails', playlistId: uploads, maxResults: 24, pageToken: normalizePageToken(request.query.pageToken)
    }) : { items: [] };
    const ids = (page.items || []).map(item => item.contentDetails?.videoId).filter(Boolean);
    const details = ids.length ? await youtubeRequest('videos', { part: 'snippet,contentDetails,statistics', id: ids.join(',') }) : { items: [] };
    const byId = new Map((details.items || []).map(item => [item.id, item]));
    const items = await addChannelThumbnails(ids.map(id => byId.get(id)).filter(Boolean).map(formatVideo).filter(Boolean));
    return response.status(200).json({ items, nextPageToken: page.nextPageToken || '', channel: {
      title: channel.snippet.title,
      description: channel.snippet.description,
      subscribers: channel.statistics?.hiddenSubscriberCount ? null : channel.statistics?.subscriberCount
    } });
  } catch (error) { return sendError(response, error); }
}
