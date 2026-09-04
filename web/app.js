import { canonicalWatchUrl, privacyEmbedUrl } from "./video-utils.js";

const FAVORITES_KEY = "mytube-private-favorites-v2";
const HISTORY_KEY = "mytube-private-history-v2";
const MAX_HISTORY = 48;

const elements = {
  body: document.body,
  menuToggle: document.getElementById("menu-toggle"),
  searchForm: document.getElementById("search-form"),
  searchInput: document.getElementById("search-input"),
  chips: document.getElementById("category-chips"),
  grid: document.getElementById("video-grid"),
  status: document.getElementById("status-message"),
  title: document.getElementById("feed-title"),
  eyebrow: document.getElementById("feed-eyebrow"),
  empty: document.getElementById("empty-state"),
  refresh: document.getElementById("refresh-button"),
  backHome: document.getElementById("back-home"),
  navButtons: [...document.querySelectorAll("[data-view]")],
  watchDialog: document.getElementById("watch-dialog"),
  closePlayer: document.getElementById("close-player"),
  player: document.getElementById("youtube-player"),
  playerTitle: document.getElementById("player-title"),
  playerChannel: document.getElementById("player-channel"),
  playerStats: document.getElementById("player-stats"),
  playerAvatar: document.getElementById("player-channel-avatar"),
  favoriteCurrent: document.getElementById("favorite-current"),
  openYouTube: document.getElementById("open-youtube"),
  privacyButton: document.getElementById("privacy-button"),
  privacyDialog: document.getElementById("privacy-dialog"),
  closePrivacy: document.getElementById("close-privacy"),
  privacyDone: document.getElementById("privacy-done")
};

let favorites = loadJson(FAVORITES_KEY, []);
let history = loadJson(HISTORY_KEY, []);
let videos = [];
let currentVideo = null;
let activeCategory = "";
let activeView = "home";
let activeQuery = "";
let requestController = null;

function loadJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function saveLocal() {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}

function isFavorite(id) {
  return favorites.some((video) => video.id === id);
}

function setStatus(message = "", isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}

function formatViews(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return "วิดีโอ YouTube";
  return `${new Intl.NumberFormat("th-TH", { notation: "compact", maximumFractionDigits: 1 }).format(number)} ครั้ง`;
}

function formatAge(value) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86400000));
  if (days < 1) return "วันนี้";
  if (days < 30) return `${days} วันที่แล้ว`;
  if (days < 365) return `${Math.floor(days / 30)} เดือนที่แล้ว`;
  return `${Math.floor(days / 365)} ปีที่แล้ว`;
}

function avatarText(channel) {
  return String(channel || "M").trim().slice(0, 1).toUpperCase() || "M";
}

function avatarColor(channel) {
  const palette = ["#6c5ce7", "#e84393", "#0984e3", "#00a884", "#d35400", "#b33939", "#6d4c41"];
  const hash = [...String(channel || "")].reduce((total, char) => total + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

function createSkeleton() {
  const article = document.createElement("article");
  article.className = "video-card skeleton";
  const thumbnail = document.createElement("div");
  thumbnail.className = "thumbnail-button";
  const body = document.createElement("div");
  body.className = "card-body";
  const avatar = document.createElement("div");
  avatar.className = "channel-avatar";
  const copy = document.createElement("div");
  const line = document.createElement("div");
  line.className = "skeleton-line";
  const shortLine = document.createElement("div");
  shortLine.className = "skeleton-line short";
  copy.append(line, shortLine);
  body.append(avatar, copy);
  article.append(thumbnail, body);
  return article;
}

function showSkeletons() {
  elements.grid.replaceChildren(...Array.from({ length: 12 }, createSkeleton));
  elements.grid.setAttribute("aria-busy", "true");
  elements.empty.hidden = true;
}

function createVideoCard(video) {
  const article = document.createElement("article");
  article.className = "video-card";
  article.dataset.videoId = video.id;

  const thumbnailButton = document.createElement("button");
  thumbnailButton.className = "thumbnail-button";
  thumbnailButton.type = "button";
  thumbnailButton.dataset.action = "play";
  thumbnailButton.setAttribute("aria-label", `เปิด ${video.title}`);
  const image = document.createElement("img");
  image.src = video.thumbnail;
  image.alt = "";
  image.loading = "lazy";
  image.referrerPolicy = "no-referrer";
  const duration = document.createElement("span");
  duration.className = "duration";
  duration.textContent = video.duration || "วิดีโอ";
  thumbnailButton.append(image, duration);

  const body = document.createElement("div");
  body.className = "card-body";
  const avatar = document.createElement("div");
  avatar.className = "channel-avatar";
  avatar.textContent = avatarText(video.channel);
  avatar.style.backgroundColor = avatarColor(video.channel);
  const copy = document.createElement("div");
  copy.className = "card-copy";
  const title = document.createElement("h2");
  title.textContent = video.title;
  const channel = document.createElement("p");
  channel.textContent = video.channel;
  const stats = document.createElement("p");
  stats.textContent = `${formatViews(video.views)} • ${formatAge(video.publishedAt)}`;
  copy.append(title, channel, stats);
  const favorite = document.createElement("button");
  favorite.className = `favorite-button${isFavorite(video.id) ? " active" : ""}`;
  favorite.type = "button";
  favorite.dataset.action = "favorite";
  favorite.textContent = isFavorite(video.id) ? "♥" : "♡";
  favorite.setAttribute("aria-label", isFavorite(video.id) ? "นำออกจากรายการโปรด" : "เพิ่มรายการโปรด");
  body.append(avatar, copy, favorite);
  article.append(thumbnailButton, body);
  return article;
}

function render(items = videos) {
  elements.grid.replaceChildren(...items.map(createVideoCard));
  elements.grid.setAttribute("aria-busy", "false");
  elements.empty.hidden = items.length > 0;
  if (items.length > 0) setStatus(`${items.length} วิดีโอ`);
}

async function fetchVideos(url) {
  requestController?.abort();
  requestController = new AbortController();
  showSkeletons();
  setStatus("กำลังโหลดวิดีโอ…");
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: requestController.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "โหลดรายการไม่สำเร็จ");
    videos = Array.isArray(data.items) ? data.items : [];
    render();
  } catch (error) {
    if (error.name === "AbortError") return;
    videos = [];
    render();
    setStatus(error.message || "โหลดรายการไม่สำเร็จ กรุณาลองใหม่", true);
  }
}

function activateView(view) {
  activeView = view;
  elements.navButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  elements.chips.hidden = view !== "home";
  if (view === "favorites") {
    elements.title.textContent = "รายการโปรดของคุณ";
    elements.eyebrow.textContent = "LOCAL LIBRARY";
    videos = [...favorites];
    render();
  } else if (view === "history") {
    elements.title.textContent = "ดูล่าสุด";
    elements.eyebrow.textContent = "LOCAL HISTORY";
    videos = [...history];
    render();
  } else {
    activeQuery = "";
    elements.searchInput.value = "";
    elements.title.textContent = "กำลังมาแรงในไทย";
    elements.eyebrow.textContent = "MYTUBE • THAILAND";
    fetchVideos(`/api/feed?category=${encodeURIComponent(activeCategory)}`);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toggleFavorite(video) {
  if (isFavorite(video.id)) favorites = favorites.filter((item) => item.id !== video.id);
  else favorites = [video, ...favorites.filter((item) => item.id !== video.id)];
  saveLocal();
  if (activeView === "favorites") videos = [...favorites];
  render();
  updatePlayerFavorite();
}

function addHistory(video) {
  history = [video, ...history.filter((item) => item.id !== video.id)].slice(0, MAX_HISTORY);
  saveLocal();
}

function openVideo(video) {
  currentVideo = video;
  addHistory(video);
  elements.player.src = privacyEmbedUrl(video.id);
  elements.playerTitle.textContent = video.title;
  elements.playerChannel.textContent = video.channel;
  elements.playerStats.textContent = formatViews(video.views);
  elements.playerAvatar.textContent = avatarText(video.channel);
  elements.playerAvatar.style.backgroundColor = avatarColor(video.channel);
  elements.openYouTube.href = canonicalWatchUrl(video.id);
  updatePlayerFavorite();
  elements.watchDialog.showModal();
}

function closeVideo() {
  elements.watchDialog.close();
  elements.player.src = "";
  currentVideo = null;
}

function updatePlayerFavorite() {
  const active = currentVideo && isFavorite(currentVideo.id);
  elements.favoriteCurrent.classList.toggle("active", Boolean(active));
  elements.favoriteCurrent.firstChild.textContent = active ? "★ " : "☆ ";
}

elements.menuToggle.addEventListener("click", () => elements.body.classList.toggle("sidebar-collapsed"));
elements.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = elements.searchInput.value.trim();
  if (!query) return activateView("home");
  activeView = "search";
  activeQuery = query;
  elements.navButtons.forEach((button) => button.classList.remove("active"));
  elements.chips.hidden = true;
  elements.title.textContent = `ผลค้นหา “${query}”`;
  elements.eyebrow.textContent = "SEARCH RESULTS";
  fetchVideos(`/api/search?q=${encodeURIComponent(query)}`);
});

elements.chips.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  [...elements.chips.querySelectorAll("[data-category]")].forEach((item) => item.classList.toggle("active", item === button));
  elements.title.textContent = activeCategory ? button.textContent : "กำลังมาแรงในไทย";
  fetchVideos(`/api/feed?category=${encodeURIComponent(activeCategory)}`);
});

elements.grid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-video-id]");
  const action = event.target.closest("[data-action]");
  if (!card || !action) return;
  const video = videos.find((item) => item.id === card.dataset.videoId);
  if (!video) return;
  if (action.dataset.action === "play") openVideo(video);
  if (action.dataset.action === "favorite") toggleFavorite(video);
});

elements.refresh.addEventListener("click", () => {
  if (activeView === "search" && activeQuery) fetchVideos(`/api/search?q=${encodeURIComponent(activeQuery)}`);
  else if (activeView === "home") fetchVideos(`/api/feed?category=${encodeURIComponent(activeCategory)}`);
  else render();
});
elements.backHome.addEventListener("click", () => activateView("home"));
elements.navButtons.forEach((button) => button.addEventListener("click", () => activateView(button.dataset.view)));
elements.closePlayer.addEventListener("click", closeVideo);
elements.watchDialog.addEventListener("click", (event) => { if (event.target === elements.watchDialog) closeVideo(); });
elements.favoriteCurrent.addEventListener("click", () => { if (currentVideo) toggleFavorite(currentVideo); });
elements.privacyButton.addEventListener("click", () => elements.privacyDialog.showModal());
elements.closePrivacy.addEventListener("click", () => elements.privacyDialog.close());
elements.privacyDone.addEventListener("click", () => elements.privacyDialog.close());
elements.privacyDialog.addEventListener("click", (event) => { if (event.target === elements.privacyDialog) elements.privacyDialog.close(); });

fetchVideos("/api/feed");
