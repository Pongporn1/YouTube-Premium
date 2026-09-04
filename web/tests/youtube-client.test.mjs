import test from "node:test";
import assert from "node:assert/strict";
import { formatVideo, mergeChannelThumbnails, normalizeCategory, normalizePageToken, normalizeQuery, parseDuration } from "../api/youtube-client.js";

test("normalizes public API query parameters", () => {
  assert.equal(normalizeCategory("10"), "10");
  assert.equal(normalizeCategory("music"), "");
  assert.equal(normalizeQuery("  เพลงไทย   ใหม่  "), "เพลงไทย ใหม่");
  assert.equal(normalizePageToken("CAUQAA"), "CAUQAA");
  assert.equal(normalizePageToken("bad token!"), "");
});

test("formats YouTube duration and video payload", () => {
  assert.equal(parseDuration("PT3M7S"), "3:07");
  assert.equal(parseDuration("PT1H2M9S"), "62:09");
  const video = formatVideo({
    id: "dQw4w9WgXcQ",
    snippet: { title: "Example", channelTitle: "Channel", channelId: "channel-1", publishedAt: "2024-01-01T00:00:00Z", thumbnails: {} },
    contentDetails: { duration: "PT3M7S" },
    statistics: { viewCount: "1000" }
  });
  assert.equal(video.duration, "3:07");
  assert.equal(video.views, "1000");
  assert.equal(video.channelId, "channel-1");
  assert.match(video.thumbnail, /dQw4w9WgXcQ/);
});

test("adds channel thumbnails to formatted videos", () => {
  const [video] = mergeChannelThumbnails(
    [{ id: "dQw4w9WgXcQ", channelId: "channel-1" }],
    [{ id: "channel-1", snippet: { thumbnails: { high: { url: "https://yt3.ggpht.com/channel" } } } }]
  );
  assert.equal(video.channelThumbnail, "https://yt3.ggpht.com/channel");
});

test("drops malformed video records", () => {
  assert.equal(formatVideo({ id: "bad" }), null);
});
