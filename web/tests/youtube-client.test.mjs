import test from "node:test";
import assert from "node:assert/strict";
import { formatCommentThread, formatVideo, mergeChannelThumbnails, normalizeCategory, normalizePageToken, normalizeQuery, normalizeVideoId, parseDuration } from "../api/youtube-client.js";

test("normalizes public API query parameters", () => {
  assert.equal(normalizeCategory("10"), "10");
  assert.equal(normalizeCategory("music"), "");
  assert.equal(normalizeQuery("  เพลงไทย   ใหม่  "), "เพลงไทย ใหม่");
  assert.equal(normalizePageToken("CAUQAA"), "CAUQAA");
  assert.equal(normalizePageToken(`next.${"a".repeat(400)}==`).length, 407);
  assert.equal(normalizePageToken("bad token!"), "");
  assert.equal(normalizeVideoId("dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(normalizeVideoId("invalid!"), "");
});

test("formats YouTube duration and video payload", () => {
  assert.equal(parseDuration("PT3M7S"), "3:07");
  assert.equal(parseDuration("PT1H2M9S"), "62:09");
  const video = formatVideo({
    id: "dQw4w9WgXcQ",
    snippet: { title: "Example", channelTitle: "Channel", channelId: "channel-1", publishedAt: "2024-01-01T00:00:00Z", thumbnails: {} },
    contentDetails: { duration: "PT3M7S" },
    statistics: { viewCount: "1000", commentCount: "250" }
  });
  assert.equal(video.duration, "3:07");
  assert.equal(video.views, "1000");
  assert.equal(video.comments, "250");
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

test("formats comment threads and their visible replies", () => {
  const comment = formatCommentThread({
    snippet: {
      totalReplyCount: 3,
      topLevelComment: {
        id: "top-1",
        snippet: {
          authorDisplayName: "Viewer",
          authorProfileImageUrl: "https://yt3.ggpht.com/viewer",
          authorChannelId: { value: "UCviewer123" },
          textOriginal: "ความคิดเห็นจริง",
          likeCount: 42,
          publishedAt: "2026-01-02T00:00:00Z"
        }
      }
    },
    replies: {
      comments: [{ id: "reply-1", snippet: { authorDisplayName: "Creator", textOriginal: "ขอบคุณครับ" } }]
    }
  });
  assert.equal(comment.author, "Viewer");
  assert.equal(comment.text, "ความคิดเห็นจริง");
  assert.equal(comment.likes, 42);
  assert.equal(comment.replyCount, 3);
  assert.equal(comment.replies[0].text, "ขอบคุณครับ");
});

test("drops comment threads without a usable top-level comment", () => {
  assert.equal(formatCommentThread({ snippet: {} }), null);
});
