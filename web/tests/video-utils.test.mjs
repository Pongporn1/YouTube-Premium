import test from "node:test";
import assert from "node:assert/strict";
import { canonicalWatchUrl, extractVideoId, isSearchQuery, isStrictMusicVideo, privacyEmbedUrl } from "../video-utils.js";

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

test("strictly filters music videos against variety, talk shows, and non-music categories", () => {
  // Accepts genuine music videos in category 10
  assert.equal(isStrictMusicVideo({ title: "LISA - SaWaDiKa (Official Music Video)", categoryId: "10" }), true);
  assert.equal(isStrictMusicVideo({ title: "พระจันทร์ที่ไม่เต็มดวง - KLEAR「Official MV」", categoryId: "10" }), true);
  assert.equal(isStrictMusicVideo({ title: "Bowkylion - วาดไว้ (Live Session)", categoryId: "10" }), true);
  assert.equal(isStrictMusicVideo({ snippet: { title: "Taylor Swift - Cruel Summer (Official Audio)", categoryId: "10" } }), true);

  // Rejects wrong category ID
  assert.equal(isStrictMusicVideo({ title: "LISA - SaWaDiKa (Official Music Video)", categoryId: "24" }), false);
  assert.equal(isStrictMusicVideo({ snippet: { title: "LISA - SaWaDiKa (Official Music Video)", categoryId: "22" } }), false);

  // Rejects variety, talk shows, documentaries, reactions, behind-the-scenes
  assert.equal(isStrictMusicVideo({ title: "รายการ คุยแซ่บShow | สัมภาษณ์พิเศษ เบิร์ด ธงไชย", categoryId: "10" }), false);
  assert.equal(isStrictMusicVideo({ title: "สารคดี ชีวประวัติราชาร็อคแอนด์โรล", categoryId: "10" }), false);
  assert.equal(isStrictMusicVideo({ title: "วาไรตี้สุดฮา ชาเลนจ์ร้องเพลง EP.1", categoryId: "10" }), false);
  assert.equal(isStrictMusicVideo({ title: "REACTION เพลง LISA - SaWaDiKa ตกใจมาก!", categoryId: "10" }), false);
  assert.equal(isStrictMusicVideo({ title: "เบื้องหลัง MV พระจันทร์ที่ไม่เต็มดวง | Behind The Scenes", categoryId: "10" }), false);
  assert.equal(isStrictMusicVideo({ title: "Podcast คุยเรื่องดนตรีกับโปรดิวเซอร์", categoryId: "10" }), false);
  assert.equal(isStrictMusicVideo({ title: "VLOG 1 วันในห้องอัดเสียง", categoryId: "10" }), false);
});

