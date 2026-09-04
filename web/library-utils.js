import { extractVideoId } from "./video-utils.js";

const MAX_TITLE_LENGTH = 300;
const MAX_CHANNEL_LENGTH = 120;

function cleanText(value, maxLength) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function importTimestamp(item, index, now) {
  const candidate = item?.watchedAt || item?.time || item?.createdAt || item?.timestamp;
  const parsed = Date.parse(String(candidate || ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date(now - index * 1000).toISOString();
}

export function normalizeImportedVideo(item, index = 0, now = Date.now()) {
  const urlOrId = item?.videoId || item?.id || item?.titleUrl || item?.url || "";
  const id = extractVideoId(urlOrId);
  if (!id) return null;

  const rawTitle = cleanText(item?.title, MAX_TITLE_LENGTH);
  const title = rawTitle.replace(/^(Watched|ดู|รับชม)\s+/i, "").replace(/\s+-\s+YouTube$/i, "").trim();
  return {
    id,
    title: title || `YouTube video ${id}`,
    channel: cleanText(item?.channel || item?.author || item?.subtitles?.[0]?.name || "YouTube", MAX_CHANNEL_LENGTH) || "YouTube",
    publishedAt: cleanText(item?.publishedAt, 40),
    thumbnail: cleanText(item?.thumbnail, 500) || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    duration: cleanText(item?.duration, 20),
    views: cleanText(item?.views, 30) || "0",
    watchedAt: importTimestamp(item, index, now)
  };
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function csvItems(text) {
  const rows = parseCsvRows(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((value) => value.replace(/^\uFEFF/, "").trim().toLowerCase());
  const column = (...names) => headers.findIndex((header) => names.some((name) => header.includes(name)));
  const idColumn = column("video id", "videoid", "รหัสวิดีโอ");
  const urlColumn = column("video url", "url", "ลิงก์");
  const titleColumn = column("title", "ชื่อ");
  const channelColumn = column("channel", "ช่อง");
  const timeColumn = column("timestamp", "creation timestamp", "time", "วันที่");

  return rows.slice(1).map((values) => ({
    id: idColumn >= 0 ? values[idColumn] : "",
    url: urlColumn >= 0 ? values[urlColumn] : "",
    title: titleColumn >= 0 ? values[titleColumn] : "",
    channel: channelColumn >= 0 ? values[channelColumn] : "",
    time: timeColumn >= 0 ? values[timeColumn] : ""
  }));
}

function jsonItems(payload, target) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  if (target === "watch-later") {
    return payload.watchLater || payload.watch_later || payload.favorites || payload.items || [];
  }
  return payload.history || payload.items || [];
}

export function parseLibraryText(text, { filename = "", target = "history", now = Date.now() } = {}) {
  const source = String(text || "").trim();
  if (!source) return [];

  let items = [];
  const looksLikeJson = /\.json$/i.test(filename) || source.startsWith("[") || source.startsWith("{");
  if (looksLikeJson) {
    try {
      items = jsonItems(JSON.parse(source), target);
    } catch {
      items = [];
    }
  }
  if (items.length === 0 && (/\.csv$/i.test(filename) || source.includes(","))) items = csvItems(source);
  if (items.length === 0) {
    items = source.split(/\r?\n/).map((line) => ({ url: line.trim() })).filter((item) => item.url);
  }

  const normalized = items.map((item, index) => normalizeImportedVideo(item, index, now)).filter(Boolean);
  return normalized.filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index);
}

export function mergeVideoCollections(primary, secondary, { history = false, max = 1000 } = {}) {
  const merged = new Map();
  [...primary, ...secondary].forEach((item) => {
    const normalized = normalizeImportedVideo(item);
    if (!normalized) return;
    const current = merged.get(normalized.id);
    if (!current) {
      merged.set(normalized.id, { ...item, ...normalized });
      return;
    }
    if (history) {
      const currentTime = Date.parse(current.watchedAt || "") || 0;
      const candidateTime = Date.parse(normalized.watchedAt || "") || 0;
      if (candidateTime > currentTime) merged.set(normalized.id, { ...current, ...item, ...normalized });
    }
  });

  const values = [...merged.values()];
  if (history) values.sort((a, b) => (Date.parse(b.watchedAt || "") || 0) - (Date.parse(a.watchedAt || "") || 0));
  return values.slice(0, Math.max(1, max));
}
