import test from "node:test";
import assert from "node:assert/strict";
import { mergeVideoCollections, parseLibraryText } from "../library-utils.js";

test("parses Google Takeout watch history JSON", () => {
  const items = parseLibraryText(JSON.stringify([{
    title: "Watched Example video",
    titleUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    subtitles: [{ name: "Example channel" }],
    time: "2026-09-01T12:00:00Z"
  }]), { filename: "watch-history.json", target: "history" });

  assert.equal(items.length, 1);
  assert.equal(items[0].id, "dQw4w9WgXcQ");
  assert.equal(items[0].title, "Example video");
  assert.equal(items[0].channel, "Example channel");
  assert.equal(items[0].watchedAt, "2026-09-01T12:00:00.000Z");
});

test("parses Google Takeout Watch Later CSV", () => {
  const csv = "Video ID,Playlist Video Creation Timestamp\nQt-T8juzxAI,2026-08-31T10:30:00Z\n";
  const items = parseLibraryText(csv, { filename: "Watch later-videos.csv", target: "watch-later" });

  assert.equal(items.length, 1);
  assert.equal(items[0].id, "Qt-T8juzxAI");
  assert.equal(items[0].title, "YouTube video Qt-T8juzxAI");
});

test("parses pasted YouTube links and removes duplicates", () => {
  const items = parseLibraryText([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=Qt-T8juzxAI"
  ].join("\n"), { target: "history", now: Date.parse("2026-09-05T00:00:00Z") });

  assert.deepEqual(items.map((item) => item.id), ["dQw4w9WgXcQ", "Qt-T8juzxAI"]);
  assert.ok(items[0].watchedAt > items[1].watchedAt);
});

test("idempotently merges legacy favorites with current Watch Later", () => {
  const current = [{ id: "dQw4w9WgXcQ", title: "Current", channel: "A" }];
  const legacy = [
    { id: "dQw4w9WgXcQ", title: "Legacy duplicate", channel: "B" },
    { id: "Qt-T8juzxAI", title: "Legacy only", channel: "C" }
  ];
  const merged = mergeVideoCollections(current, legacy);

  assert.deepEqual(merged.map((item) => item.id), ["dQw4w9WgXcQ", "Qt-T8juzxAI"]);
  assert.equal(merged[0].title, "Current");
});
