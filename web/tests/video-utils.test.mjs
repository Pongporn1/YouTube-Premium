import test from "node:test";
import assert from "node:assert/strict";
import { canonicalWatchUrl, extractVideoId, isSearchQuery, privacyEmbedUrl } from "../video-utils.js";

const id = "dQw4w9WgXcQ";

test("extracts supported YouTube URL forms", () => {
  assert.equal(extractVideoId(`https://www.youtube.com/watch?v=${id}&t=30`), id);
  assert.equal(extractVideoId(`https://youtu.be/${id}?si=abc`), id);
  assert.equal(extractVideoId(`https://www.youtube.com/shorts/${id}`), id);
  assert.equal(extractVideoId(`https://m.youtube.com/live/${id}`), id);
  assert.equal(extractVideoId(id), id);
});

test("rejects lookalike hosts and invalid IDs", () => {
  assert.equal(extractVideoId(`https://youtube.com.attacker.test/watch?v=${id}`), null);
  assert.equal(extractVideoId("https://www.youtube.com/watch?v=too-short"), null);
  assert.equal(extractVideoId("javascript:alert(1)"), null);
});

test("builds canonical and privacy-enhanced URLs", () => {
  assert.equal(canonicalWatchUrl(id), `https://www.youtube.com/watch?v=${id}`);
  assert.equal(privacyEmbedUrl(id), `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`);
  assert.throws(() => privacyEmbedUrl("invalid"), TypeError);
});

test("treats non-video text as a search query", () => {
  assert.equal(isSearchQuery("เพลงไทย ฟังสบาย"), true);
  assert.equal(isSearchQuery(""), false);
  assert.equal(isSearchQuery(id), false);
});
