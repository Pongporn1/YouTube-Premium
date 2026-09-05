import test from "node:test";
import assert from "node:assert/strict";
import { formatAuthorizedVideo, mixPersonalizedFeed, playlistVideoIds } from "../personalization-utils.js";

function video(id, title = id) {
  return { id, title, channel: "Channel" };
}

test("extracts valid video ids from authorized playlists", () => {
  assert.deepEqual(playlistVideoIds({ items: [
    { contentDetails: { videoId: "dQw4w9WgXcQ" } },
    { snippet: { resourceId: { videoId: "FyS5dAywkEo" } } },
    { contentDetails: { videoId: "bad" } }
  ] }), ["dQw4w9WgXcQ", "FyS5dAywkEo"]);
});

test("formats authorized YouTube video data for the existing cards", () => {
  const formatted = formatAuthorizedVideo({
    id: "dQw4w9WgXcQ",
    snippet: { title: "เพลงที่ชอบ", channelTitle: "Creator", channelId: "UCcreator123", thumbnails: {} },
    contentDetails: { duration: "PT1H2M9S" },
    statistics: { viewCount: "1000", commentCount: "25" }
  }, new Map([["UCcreator123", "https://yt3.ggpht.com/creator"]]));
  assert.equal(formatted.duration, "62:09");
  assert.equal(formatted.comments, "25");
  assert.equal(formatted.channelThumbnail, "https://yt3.ggpht.com/creator");
});

test("mixes personal signals with trending and avoids recently watched videos", () => {
  const personal = [video("AAAAAAAAAAA"), video("BBBBBBBBBBB"), video("CCCCCCCCCCC"), video("DDDDDDDDDDD")];
  const trending = [video("EEEEEEEEEEE"), video("FFFFFFFFFFF")];
  const mixed = mixPersonalizedFeed(personal, trending, {
    history: [video("AAAAAAAAAAA")],
    limit: 5,
    random: () => 0
  });
  assert.equal(mixed.length, 5);
  assert.equal(mixed.some((item) => item.id === "AAAAAAAAAAA"), false);
  assert.equal(mixed.some((item) => item.id === "EEEEEEEEEEE"), true);
  assert.equal(new Set(mixed.map((item) => item.id)).size, mixed.length);
});

test("ranks newly published personal videos above years-old ones", () => {
  const now = Date.parse("2026-09-05T00:00:00Z");
  const fresh = { ...video("AAAAAAAAAAA"), publishedAt: "2026-09-03T00:00:00Z" };
  const stale = { ...video("BBBBBBBBBBB"), publishedAt: "2018-01-01T00:00:00Z" };
  const mixed = mixPersonalizedFeed([stale, fresh], [], { limit: 2, random: () => 0, now });
  assert.deepEqual(mixed.map((item) => item.id), ["AAAAAAAAAAA", "BBBBBBBBBBB"]);
});

test("prefers channels the viewer actually watches", () => {
  const now = Date.parse("2026-09-05T00:00:00Z");
  const ignored = { ...video("AAAAAAAAAAA"), channelId: "UCignored", publishedAt: "2026-09-01T00:00:00Z" };
  const watched = { ...video("BBBBBBBBBBB"), channelId: "UCwatched", publishedAt: "2026-09-01T00:00:00Z" };
  const historyEntry = { ...video("CCCCCCCCCCC"), channelId: "UCwatched", categoryId: "24", publishedAt: "2026-09-02T00:00:00Z" };
  const mixed = mixPersonalizedFeed([ignored, watched], [], {
    history: [historyEntry, { ...historyEntry, id: "DDDDDDDDDDD" }, { ...historyEntry, id: "EEEEEEEEEEE" }],
    limit: 2,
    random: () => 0,
    now
  });
  assert.equal(mixed[0].id, "BBBBBBBBBBB");
});

test("ranks trending by category affinity instead of shuffling", () => {
  const now = Date.parse("2026-09-05T00:00:00Z");
  const music = { ...video("AAAAAAAAAAA"), categoryId: "10", publishedAt: "2026-09-01T00:00:00Z" };
  const gaming = { ...video("BBBBBBBBBBB"), categoryId: "20", publishedAt: "2026-09-01T00:00:00Z" };
  const mixed = mixPersonalizedFeed([], [music, gaming], {
    history: [
      { ...video("CCCCCCCCCCC"), categoryId: "20", publishedAt: "2026-09-02T00:00:00Z" },
      { ...video("DDDDDDDDDDD"), categoryId: "20", publishedAt: "2026-09-03T00:00:00Z" }
    ],
    limit: 2,
    random: () => 0,
    now
  });
  assert.equal(mixed[0].id, "BBBBBBBBBBB");
});
