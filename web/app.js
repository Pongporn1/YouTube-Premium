import { canonicalWatchUrl, isStrictMusicVideo, privacyEmbedUrl } from "./video-utils.js";
import { mergeVideoCollections, parseLibraryText } from "./library-utils.js";
import { formatAuthorizedVideo, mixPersonalizedFeed, playlistVideoIds } from "./personalization-utils.js";

const WATCH_LATER_KEY = "mytube-private-watch-later-v3";
const LEGACY_FAVORITES_KEY = "mytube-private-favorites-v2";
const HISTORY_KEY = "mytube-private-history-v2";
const PERSONALIZATION_KEY = "mytube-private-personalization-v1";
const LAST_HOME_ORDER_KEY = "mytube-private-home-order-v1";
const MAX_HISTORY = 1000;
const MAX_YOUTUBE_PAGES = 100;
const MAX_SUBSCRIPTION_CHANNELS = 250;
const MAX_PERSONALIZED_VIDEOS = 1000;
const UPLOADS_PER_CHANNEL = 10;
const PERSONALIZATION_REFRESH_MS = 15 * 60 * 1000;
const PERSONALIZATION_WORKERS = 6;

const elements = {
  body: document.body,
  authGate: document.getElementById("auth-gate"),
  googleButton: document.getElementById("google-button"),
  authMessage: document.getElementById("auth-message"),
  accountButton: document.getElementById("account-button"),
  accountMenu: document.getElementById("account-menu"),
  accountAvatarFallback: document.getElementById("account-avatar-fallback"),
  accountAvatarImage: document.getElementById("account-avatar-image"),
  accountMenuAvatarFallback: document.getElementById("account-menu-avatar-fallback"),
  accountMenuAvatarImage: document.getElementById("account-menu-avatar-image"),
  accountName: document.getElementById("account-name"),
  accountEmail: document.getElementById("account-email"),
  accountPrivacy: document.getElementById("account-privacy"),
  accountLogout: document.getElementById("account-logout"),
  mobileAccountButton: document.getElementById("mobile-account-button"),
  mobileAvatarFallback: document.getElementById("mobile-avatar-fallback"),
  mobileAvatarImage: document.getElementById("mobile-avatar-image"),
  logoutButton: document.getElementById("logout-button"),
  menuToggle: document.getElementById("menu-toggle"),
  voiceSearch: document.getElementById("voice-search"),
  mobileSearchClose: document.getElementById("mobile-search-close"),
  searchForm: document.getElementById("search-form"),
  searchInput: document.getElementById("search-input"),
  chips: document.getElementById("category-chips"),
  grid: document.getElementById("video-grid"),
  personalizationPanel: document.getElementById("personalization-panel"),
  personalizationTitle: document.getElementById("personalization-title"),
  personalizationStatus: document.getElementById("personalization-status"),
  connectYouTube: document.getElementById("connect-youtube"),
  accountYouTube: document.getElementById("account-youtube"),
  clearPersonalization: document.getElementById("clear-personalization"),
  feedLoader: document.getElementById("feed-loader"),
  feedSentinel: document.getElementById("feed-sentinel"),
  status: document.getElementById("status-message"),
  title: document.getElementById("feed-title"),
  eyebrow: document.getElementById("feed-eyebrow"),
  empty: document.getElementById("empty-state"),
  emptyTitle: document.getElementById("empty-title"),
  emptyCopy: document.getElementById("empty-copy"),
  refresh: document.getElementById("refresh-button"),
  backHome: document.getElementById("back-home"),
  historyTools: document.getElementById("history-tools"),
  historySearch: document.getElementById("history-search"),
  importLibrary: document.getElementById("import-library"),
  clearLibrary: document.getElementById("clear-library"),
  importMessage: document.getElementById("import-message"),
  navButtons: [...document.querySelectorAll("[data-view]")],
  watchDialog: document.getElementById("watch-dialog"),
  closePlayer: document.getElementById("close-player"),
  minimizePlayer: document.getElementById("minimize-player"),
  expandPlayer: document.getElementById("expand-player"),
  player: document.getElementById("youtube-player"),
  playerTitle: document.getElementById("player-title"),
  playerChannel: document.getElementById("player-channel"),
  playerStats: document.getElementById("player-stats"),
  playerAvatar: document.getElementById("player-channel-avatar"),
  favoriteCurrent: document.getElementById("favorite-current"),
  shareCurrent: document.getElementById("share-current"),
  openYouTube: document.getElementById("open-youtube"),
  commentsCount: document.getElementById("comments-count"),
  commentsOrder: document.getElementById("comments-order"),
  commentsStatus: document.getElementById("comments-status"),
  commentsList: document.getElementById("comments-list"),
  loadMoreComments: document.getElementById("load-more-comments"),
  privacyButton: document.getElementById("privacy-button"),
  privacyDialog: document.getElementById("privacy-dialog"),
  closePrivacy: document.getElementById("close-privacy"),
  privacyDone: document.getElementById("privacy-done"),
  importDialog: document.getElementById("import-dialog"),
  closeImport: document.getElementById("close-import"),
  importTitle: document.getElementById("import-title"),
  importText: document.getElementById("import-text"),
  chooseImportFiles: document.getElementById("choose-import-files"),
  libraryFiles: document.getElementById("library-files"),
  applyImport: document.getElementById("apply-import"),
  importDialogMessage: document.getElementById("import-dialog-message"),
  videoMenu: document.getElementById("video-menu"),
  videoMenuWatchLabel: document.getElementById("video-menu-watch-label"),
  videoMenuYouTube: document.getElementById("video-menu-youtube"),
  toast: document.getElementById("toast")
};

let storageFailed = false;
let watchLater = loadWatchLater();
let history = loadJson(HISTORY_KEY, []);
let personalization = loadPersonalization();
let videos = [];
let currentVideo = null;
let activeCategory = "";
let activeView = "home";
let activeQuery = "";
let requestController = null;
let requestSerial = 0;
let nextPageToken = "";
let loadingMore = false;
let commentController = null;
let commentSerial = 0;
let comments = [];
let commentsNextPageToken = "";
let commentsVideoId = "";
let commentsTotal = 0;
let googleClientId = "";
let youtubeAccessToken = "";
let youtubeTokenExpiresAt = 0;
let personalizationBusy = false;
let importTarget = "history";
let currentMenuVideo = null;
let currentMenuTrigger = null;
let toastTimer = null;
let personalizationTimer = null;
const mobileViewport = window.matchMedia("(max-width: 680px)");

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    storageFailed = true;
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    storageFailed = true;
    return false;
  }
}

function loadJson(key, fallback) {
  try {
    const value = JSON.parse(safeStorageGet(key) || "null");
    return Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function loadPersonalization() {
  try {
    const value = JSON.parse(safeStorageGet(PERSONALIZATION_KEY) || "null");
    const sanitizeItems = (items, limit = 100) => Array.isArray(items)
      ? items.filter((item) => /^[A-Za-z0-9_-]{11}$/.test(String(item?.id || ""))).slice(0, limit)
      : [];
    const items = sanitizeItems(value?.items, 100);
    const likedItems = sanitizeItems(value?.likedItems?.length
      ? value.likedItems
      : items.filter((item) => item.recommendationReason === "วิดีโอที่คุณชอบ"), 50);
    const subscriptionItems = sanitizeItems(value?.subscriptionItems?.length
      ? value.subscriptionItems
      : items.filter((item) => item.recommendationReason === "ใหม่จากช่องที่ติดตาม"), 50);
    return {
      items,
      likedItems,
      subscriptionItems,
      subscriptionCount: Math.max(0, Number(value?.subscriptionCount) || 0),
      likedCount: Math.max(0, Number(value?.likedCount) || 0),
      updatedAt: String(value?.updatedAt || "")
    };
  } catch {
    return emptyPersonalization();
  }
}

function emptyPersonalization() {
  return { items: [], likedItems: [], subscriptionItems: [], subscriptionCount: 0, likedCount: 0, updatedAt: "" };
}

function hasYouTubeConnection() {
  return Boolean(personalization.updatedAt || personalization.items.length || personalization.subscriptionCount || personalization.likedCount);
}

function matchesActiveCategory(video) {
  if (!activeCategory) return true;
  return String(video?.categoryId || "") === String(activeCategory);
}

function savePersonalization() {
  return safeStorageSet(PERSONALIZATION_KEY, JSON.stringify(personalization));
}

function personalizedHomeItems(trending) {
  const limit = Math.max(1, Math.min(24, trending.length || 24));
  const personal = personalization.items.filter(matchesActiveCategory);
  let mixed = mixPersonalizedFeed(personal, trending.filter(matchesActiveCategory), { history, limit });
  const previous = safeStorageGet(LAST_HOME_ORDER_KEY);
  const order = mixed.map((video) => video.id).join(",");
  if (mixed.length > 1 && order === previous) mixed = [...mixed.slice(1), mixed[0]];
  safeStorageSet(LAST_HOME_ORDER_KEY, mixed.map((video) => video.id).join(","));
  return mixed;
}

function loadWatchLater() {
  const current = loadJson(WATCH_LATER_KEY, []);
  const legacy = loadJson(LEGACY_FAVORITES_KEY, []);
  const migrated = mergeVideoCollections(current, legacy, { max: MAX_HISTORY });
  safeStorageSet(WATCH_LATER_KEY, JSON.stringify(migrated));
  return migrated;
}

function saveLocal() {
  const watchLaterSaved = safeStorageSet(WATCH_LATER_KEY, JSON.stringify(watchLater));
  const historySaved = safeStorageSet(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  return watchLaterSaved && historySaved;
}

function isInWatchLater(id) {
  return watchLater.some((video) => video.id === id);
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

function formatCompactNumber(value) {
  const number = Math.max(0, Number(value) || 0);
  return new Intl.NumberFormat("th-TH", { notation: "compact", maximumFractionDigits: 1 }).format(number);
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

function youtubeChannelUrl(channelId) {
  const id = String(channelId || "");
  return /^[A-Za-z0-9_-]{8,80}$/.test(id)
    ? `https://www.youtube.com/channel/${encodeURIComponent(id)}`
    : "";
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

  const thumbnailWrap = document.createElement("div");
  thumbnailWrap.className = "thumbnail-wrap";
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
  thumbnailButton.append(image);
  if (video.recommendationReason) {
    const reason = document.createElement("span");
    reason.className = "recommendation-reason";
    reason.textContent = video.recommendationReason;
    thumbnailButton.append(reason);
  }
  thumbnailButton.append(duration);
  const quickWatchLater = document.createElement("button");
  quickWatchLater.className = `quick-watch-later${isInWatchLater(video.id) ? " active" : ""}`;
  quickWatchLater.type = "button";
  quickWatchLater.dataset.action = "watch-later";
  quickWatchLater.textContent = "◷";
  quickWatchLater.setAttribute("aria-label", isInWatchLater(video.id) ? "นำออกจากดูภายหลัง" : "บันทึกไว้ดูภายหลัง");
  quickWatchLater.title = isInWatchLater(video.id) ? "นำออกจากดูภายหลัง" : "ดูภายหลัง";
  thumbnailWrap.append(thumbnailButton, quickWatchLater);

  const body = document.createElement("div");
  body.className = "card-body";
  const channelHref = youtubeChannelUrl(video.channelId);
  const avatar = document.createElement(channelHref ? "a" : "div");
  avatar.className = "channel-avatar";
  avatar.style.backgroundColor = avatarColor(video.channel);
  if (channelHref) {
    avatar.href = channelHref;
    avatar.target = "_blank";
    avatar.rel = "noopener noreferrer";
    avatar.setAttribute("aria-label", `เปิดช่อง ${video.channel} บน YouTube`);
  }
  const channelPicture = safeProfilePicture(video.channelThumbnail);
  if (channelPicture) {
    const channelImage = document.createElement("img");
    channelImage.src = channelPicture;
    channelImage.alt = "";
    channelImage.loading = "lazy";
    channelImage.referrerPolicy = "no-referrer";
    channelImage.addEventListener("error", () => {
      channelImage.remove();
      avatar.textContent = avatarText(video.channel);
    }, { once: true });
    avatar.append(channelImage);
  } else {
    avatar.textContent = avatarText(video.channel);
  }
  const copy = document.createElement("div");
  copy.className = "card-copy";
  const title = document.createElement("h2");
  const titleButton = document.createElement("button");
  titleButton.className = "card-title-button";
  titleButton.type = "button";
  titleButton.dataset.action = "play";
  titleButton.textContent = video.title;
  title.append(titleButton);
  const channel = document.createElement(channelHref ? "a" : "p");
  channel.className = "channel-link";
  channel.textContent = video.channel;
  if (channelHref) {
    channel.href = channelHref;
    channel.target = "_blank";
    channel.rel = "noopener noreferrer";
  }
  const stats = document.createElement("p");
  stats.textContent = `${formatViews(video.views)} • ${formatAge(video.publishedAt)}`;
  copy.append(title, channel, stats);
  const menuButton = document.createElement("button");
  menuButton.className = "card-menu-button";
  menuButton.type = "button";
  menuButton.dataset.action = "options";
  menuButton.textContent = "⋮";
  menuButton.setAttribute("aria-label", `ตัวเลือกสำหรับ ${video.title}`);
  menuButton.setAttribute("aria-haspopup", "menu");
  menuButton.setAttribute("aria-expanded", "false");
  body.append(avatar, copy, menuButton);
  article.append(thumbnailWrap, body);
  return article;
}

function configureEmptyState() {
  if (activeView === "watch-later") {
    elements.emptyTitle.textContent = "ยังไม่มีรายการดูภายหลังใน MyTube";
    elements.emptyCopy.textContent = "นำเข้ารายการ Watch Later เดิมจาก YouTube หรือกดปุ่ม ◷ บนวิดีโอเพื่อเก็บไว้ดูภายหลัง";
    elements.backHome.textContent = "นำเข้าจาก YouTube";
  } else if (activeView === "history") {
    elements.emptyTitle.textContent = "ยังไม่มีประวัติใน MyTube";
    elements.emptyCopy.textContent = "นำเข้าประวัติเดิมจาก YouTube หรือเปิดวิดีโอใน MyTube เพื่อเริ่มบันทึกประวัติ";
    elements.backHome.textContent = "นำเข้าจาก YouTube";
  } else if (activeView === "subscriptions") {
    elements.emptyTitle.textContent = hasYouTubeConnection() ? "ยังไม่มีคลิปใหม่จากช่องที่ติดตาม" : "เชื่อม YouTube เพื่อดูการติดตาม";
    elements.emptyCopy.textContent = hasYouTubeConnection()
      ? "กดอัปเดตข้อมูล YouTube เพื่อสุ่มคลิปล่าสุดจากช่องที่คุณติดตามอีกครั้ง"
      : "ใช้สิทธิ์อ่านอย่างเดียว และ MyTube จะไม่กดติดตามหรือแก้ไขบัญชีแทนคุณ";
    elements.backHome.textContent = hasYouTubeConnection() ? "อัปเดตข้อมูล YouTube" : "เชื่อม YouTube";
  } else if (activeView === "liked") {
    elements.emptyTitle.textContent = hasYouTubeConnection() ? "ยังไม่พบวิดีโอที่ชอบ" : "เชื่อม YouTube เพื่อดูวิดีโอที่ชอบ";
    elements.emptyCopy.textContent = hasYouTubeConnection()
      ? "กดอัปเดตข้อมูล YouTube เพื่อดึงรายการล่าสุดแบบอ่านอย่างเดียว"
      : "MyTube อ่านรายการที่คุณกดถูกใจได้ แต่จะไม่เพิ่มหรือลบการกดถูกใจ";
    elements.backHome.textContent = hasYouTubeConnection() ? "อัปเดตข้อมูล YouTube" : "เชื่อม YouTube";
  } else {
    elements.emptyTitle.textContent = "ยังไม่พบวิดีโอ";
    elements.emptyCopy.textContent = "ลองค้นหาด้วยคำอื่น หรือกลับไปดูวิดีโอกำลังมาแรง";
    elements.backHome.textContent = "กลับหน้าหลัก";
  }
}

function render(items = videos) {
  const query = activeView === "history" ? elements.historySearch.value.trim().toLocaleLowerCase("th") : "";
  const visibleItems = query
    ? items.filter((item) => `${item.title} ${item.channel}`.toLocaleLowerCase("th").includes(query))
    : items;
  elements.grid.replaceChildren(...visibleItems.map(createVideoCard));
  elements.grid.setAttribute("aria-busy", "false");
  elements.empty.hidden = visibleItems.length > 0;
  configureEmptyState();
  setStatus(`${visibleItems.length} วิดีโอ`);
  elements.feedSentinel.hidden = !(["home", "search"].includes(activeView) && nextPageToken);
}

function videoRequestUrl(pageToken = "") {
  const params = new URLSearchParams();
  if (activeView === "search") params.set("q", activeQuery);
  else if (activeCategory) params.set("category", activeCategory);
  if (pageToken) params.set("pageToken", pageToken);
  return `/api/${activeView === "search" ? "search" : "feed"}?${params.toString()}`;
}

async function fetchVideos(url, { append = false } = {}) {
  if (append && loadingMore) return;
  if (!append) {
    requestController?.abort();
    nextPageToken = "";
  }
  const controller = new AbortController();
  const requestId = ++requestSerial;
  const requestView = activeView;
  requestController = controller;
  loadingMore = append;
  elements.feedLoader.hidden = !append;
  if (!append) {
    showSkeletons();
    setStatus("กำลังโหลดวิดีโอ…");
  }
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "โหลดรายการไม่สำเร็จ");
    if (requestId !== requestSerial || requestView !== activeView) return;
    const incoming = Array.isArray(data.items) ? data.items : [];
    const filteredIncoming = incoming.filter(matchesActiveCategory).filter((video) => activeCategory !== "10" || isStrictMusicVideo(video));
    const initialItems = !append && activeView === "home" && !activeCategory ? personalizedHomeItems(filteredIncoming) : filteredIncoming;
    videos = append
      ? [...new Map([...videos, ...filteredIncoming].map((video) => [video.id, video])).values()]
      : initialItems;
    nextPageToken = String(data.nextPageToken || "");
    render();
  } catch (error) {
    if (error.name === "AbortError") return;
    if (requestId !== requestSerial || requestView !== activeView) return;
    if (!append) {
      videos = [];
      render();
    }
    setStatus(error.message || "โหลดรายการไม่สำเร็จ กรุณาลองใหม่", true);
  } finally {
    if (requestController === controller) requestController = null;
    if (requestId === requestSerial) {
      loadingMore = false;
      elements.feedLoader.hidden = true;
      if (!append && nextPageToken && ["home", "search"].includes(activeView)) {
        window.setTimeout(() => { void prefetchFeedPages(); }, 0);
      }
      elements.feedSentinel.hidden = !(["home", "search"].includes(activeView) && nextPageToken);
    }
  }
}

function loadNextVideoPage() {
  if (!nextPageToken || loadingMore || !["home", "search"].includes(activeView)) return;
  fetchVideos(videoRequestUrl(nextPageToken), { append: true });
}

async function prefetchFeedPages(maxPages = 3) {
  let loaded = 0;
  while (nextPageToken && !loadingMore && loaded < maxPages && ["home", "search"].includes(activeView)) {
    const tokenBefore = nextPageToken;
    await fetchVideos(videoRequestUrl(tokenBefore), { append: true });
    loaded += 1;
    if (nextPageToken === tokenBefore) break;
  }
}

function activateView(view) {
  elements.body.classList.remove("mobile-searching");
  activeView = view;
  elements.body.dataset.view = view;
  if (["watch-later", "history", "subscriptions", "liked"].includes(view)) {
    requestSerial += 1;
    requestController?.abort();
    requestController = null;
    nextPageToken = "";
    loadingMore = false;
    elements.feedLoader.hidden = true;
    elements.feedSentinel.hidden = true;
  }
  elements.navButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  elements.chips.hidden = view !== "home";
  elements.historyTools.hidden = view !== "history" && view !== "watch-later";
  elements.historySearch.closest("label").hidden = view !== "history";
  elements.clearLibrary.textContent = view === "watch-later" ? "ล้างดูภายหลัง" : "ล้างประวัติ";
  elements.importMessage.hidden = true;
  if (view === "watch-later") {
    elements.title.textContent = "ดูภายหลัง";
    elements.eyebrow.textContent = "MYTUBE QUEUE";
    videos = [...watchLater];
    render();
  } else if (view === "history") {
    elements.title.textContent = "ประวัติการดู";
    elements.eyebrow.textContent = "PRIVATE • ON THIS BROWSER";
    videos = [...history];
    render();
  } else if (view === "subscriptions") {
    elements.title.textContent = "การติดตาม";
    elements.eyebrow.textContent = "YOUTUBE • READ ONLY";
    videos = [...personalization.subscriptionItems];
    render();
  } else if (view === "liked") {
    elements.title.textContent = "วิดีโอที่ชอบ";
    elements.eyebrow.textContent = "YOUTUBE • READ ONLY";
    videos = [...personalization.likedItems];
    render();
  } else {
    activeQuery = "";
    activeCategory = "";
    elements.searchInput.value = "";
    [...elements.chips.querySelectorAll("[data-category]")].forEach((button) => button.classList.toggle("active", !button.dataset.category));
    elements.title.textContent = "กำลังมาแรงในไทย";
    elements.eyebrow.textContent = "MYTUBE • THAILAND";
    fetchVideos(videoRequestUrl());
  }
  updatePersonalizationPanel();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toggleWatchLater(video) {
  if (isInWatchLater(video.id)) watchLater = watchLater.filter((item) => item.id !== video.id);
  else watchLater = [video, ...watchLater.filter((item) => item.id !== video.id)];
  const saved = saveLocal();
  if (activeView === "watch-later") videos = [...watchLater];
  render();
  if (!saved) setStatus("บันทึกได้ชั่วคราว แต่เบราว์เซอร์ปิด Local Storage อยู่", true);
  updatePlayerWatchLater();
}

function closeVideoMenu() {
  if (currentMenuTrigger) currentMenuTrigger.setAttribute("aria-expanded", "false");
  elements.videoMenu.hidden = true;
  currentMenuVideo = null;
  currentMenuTrigger = null;
}

function openVideoMenu(video, trigger) {
  const isSameOpenMenu = !elements.videoMenu.hidden && currentMenuVideo?.id === video.id;
  closeVideoMenu();
  if (isSameOpenMenu) return;
  currentMenuVideo = video;
  currentMenuTrigger = trigger;
  trigger.setAttribute("aria-expanded", "true");
  elements.videoMenuWatchLabel.textContent = isInWatchLater(video.id) ? "นำออกจากดูภายหลัง" : "บันทึกไว้ดูภายหลัง";
  elements.videoMenuYouTube.href = canonicalWatchUrl(video.id);
  elements.videoMenu.hidden = false;
  const rect = trigger.getBoundingClientRect();
  const menuRect = elements.videoMenu.getBoundingClientRect();
  const left = Math.min(window.innerWidth - menuRect.width - 8, Math.max(8, rect.right - menuRect.width));
  const below = rect.bottom + 6;
  const top = below + menuRect.height <= window.innerHeight - 8 ? below : Math.max(8, rect.top - menuRect.height - 6);
  elements.videoMenu.style.left = `${left}px`;
  elements.videoMenu.style.top = `${top}px`;
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  toastTimer = window.setTimeout(() => { elements.toast.hidden = true; }, 2400);
}

function startVoiceSearch() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    showToast("เบราว์เซอร์นี้ยังไม่รองรับการค้นหาด้วยเสียง");
    return;
  }
  const recognition = new Recognition();
  recognition.lang = "th-TH";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  elements.voiceSearch.classList.add("listening");
  recognition.addEventListener("result", (event) => {
    const transcript = String(event.results?.[0]?.[0]?.transcript || "").trim();
    if (!transcript) return;
    elements.searchInput.value = transcript;
    elements.searchForm.requestSubmit();
  });
  recognition.addEventListener("error", () => showToast("ไม่สามารถรับเสียงได้ กรุณาลองใหม่"));
  recognition.addEventListener("end", () => elements.voiceSearch.classList.remove("listening"));
  try {
    recognition.start();
  } catch {
    elements.voiceSearch.classList.remove("listening");
    showToast("ไมโครโฟนยังไม่พร้อมใช้งาน");
  }
}

function addHistory(video) {
  history = [{ ...video, watchedAt: new Date().toISOString() }, ...history.filter((item) => item.id !== video.id)].slice(0, MAX_HISTORY);
  saveLocal();
}

function createCommentAvatar(comment, compact = false) {
  const href = youtubeChannelUrl(comment.authorChannelId);
  const avatar = document.createElement(href ? "a" : "div");
  avatar.className = `comment-avatar${compact ? " compact" : ""}`;
  avatar.style.backgroundColor = avatarColor(comment.author);
  if (href) {
    avatar.href = href;
    avatar.target = "_blank";
    avatar.rel = "noopener noreferrer";
    avatar.setAttribute("aria-label", `เปิดช่อง ${comment.author} บน YouTube`);
  }
  const picture = safeProfilePicture(comment.authorImage);
  if (picture) {
    const image = document.createElement("img");
    image.src = picture;
    image.alt = "";
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => {
      image.remove();
      avatar.textContent = avatarText(comment.author);
    }, { once: true });
    avatar.append(image);
  } else {
    avatar.textContent = avatarText(comment.author);
  }
  return avatar;
}

function createComment(comment, compact = false) {
  const article = document.createElement("article");
  article.className = `comment${compact ? " comment-reply" : ""}`;
  const avatar = createCommentAvatar(comment, compact);
  const copy = document.createElement("div");
  copy.className = "comment-copy";
  const header = document.createElement("div");
  header.className = "comment-byline";
  const href = youtubeChannelUrl(comment.authorChannelId);
  const author = document.createElement(href ? "a" : "strong");
  author.textContent = comment.author;
  if (href) {
    author.href = href;
    author.target = "_blank";
    author.rel = "noopener noreferrer";
  }
  const age = document.createElement("span");
  age.textContent = formatAge(comment.publishedAt);
  header.append(author, age);
  const text = document.createElement("p");
  text.textContent = comment.text;
  const meta = document.createElement("div");
  meta.className = "comment-meta";
  const likes = document.createElement("span");
  likes.textContent = comment.likes ? `♡ ${formatCompactNumber(comment.likes)}` : "♡";
  meta.append(likes);
  copy.append(header, text, meta);

  if (!compact && (comment.replyCount || comment.replies?.length)) {
    const replySummary = document.createElement("span");
    replySummary.className = "reply-summary";
    replySummary.textContent = `${formatCompactNumber(comment.replyCount || comment.replies.length)} คำตอบ`;
    meta.append(replySummary);
    if (comment.replies?.length) {
      const replies = document.createElement("div");
      replies.className = "comment-replies";
      replies.append(...comment.replies.map((reply) => createComment(reply, true)));
      copy.append(replies);
    }
  }
  article.append(avatar, copy);
  return article;
}

function renderComments() {
  elements.commentsList.replaceChildren(...comments.map((comment) => createComment(comment)));
  const countText = commentsTotal
    ? `${formatCompactNumber(commentsTotal)} ความคิดเห็น`
    : "ความคิดเห็น";
  elements.commentsCount.textContent = countText;
  const teaserCount = document.getElementById("comments-teaser-count");
  if (teaserCount) teaserCount.textContent = commentsTotal ? formatCompactNumber(commentsTotal) : "";
  const teaserText = document.getElementById("teaser-text");
  const teaserAvatar = document.getElementById("teaser-avatar");
  if (comments.length > 0 && teaserText && teaserAvatar) {
    const topComment = comments[0];
    teaserText.textContent = topComment.text;
    teaserAvatar.textContent = avatarText(topComment.author);
    teaserAvatar.style.backgroundColor = avatarColor(topComment.author);
    if (topComment.authorThumbnail) {
      const img = document.createElement("img");
      img.src = topComment.authorThumbnail;
      img.alt = "";
      img.referrerPolicy = "no-referrer";
      teaserAvatar.replaceChildren(img);
    }
  } else if (teaserText) {
    teaserText.textContent = "ยังไม่มีความคิดเห็นในวิดีโอนี้";
  }
  elements.loadMoreComments.hidden = !commentsNextPageToken;
  elements.loadMoreComments.disabled = false;
}

async function loadComments(videoId, { append = false } = {}) {
  if (!videoId || (append && !commentsNextPageToken)) return;
  if (!append) {
    commentController?.abort();
    comments = [];
    commentsNextPageToken = "";
    commentsTotal = Math.max(0, Number(currentVideo?.comments) || 0);
    commentsVideoId = videoId;
    renderComments();
  }
  const controller = new AbortController();
  const requestId = ++commentSerial;
  commentController = controller;
  elements.commentsStatus.textContent = append ? "กำลังโหลดความคิดเห็นเพิ่มเติม…" : "กำลังโหลดความคิดเห็นจริงจาก YouTube…";
  elements.loadMoreComments.disabled = true;
  const params = new URLSearchParams({ videoId, order: elements.commentsOrder.value });
  if (append) params.set("pageToken", commentsNextPageToken);
  try {
    const response = await fetch(`/api/comments?${params.toString()}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "โหลดความคิดเห็นไม่สำเร็จ");
    if (requestId !== commentSerial || commentsVideoId !== videoId || currentVideo?.id !== videoId) return;
    if (data.disabled) {
      comments = [];
      commentsNextPageToken = "";
      commentsTotal = 0;
      renderComments();
      elements.commentsStatus.textContent = "วิดีโอนี้ปิดความคิดเห็นไว้";
      return;
    }
    const incoming = Array.isArray(data.items) ? data.items : [];
    comments = append
      ? [...new Map([...comments, ...incoming].map((comment) => [comment.id, comment])).values()]
      : incoming;
    commentsNextPageToken = String(data.nextPageToken || "");
    commentsTotal = Math.max(comments.length, Number(currentVideo?.comments) || 0, Number(data.totalResults) || 0);
    renderComments();
    elements.commentsStatus.textContent = comments.length
      ? commentsTotal > comments.length
        ? `แสดง ${formatCompactNumber(comments.length)} จาก ${formatCompactNumber(commentsTotal)} ความคิดเห็น`
        : `แสดง ${formatCompactNumber(comments.length)} ความคิดเห็น`
      : "ยังไม่มีความคิดเห็นในวิดีโอนี้";
  } catch (error) {
    if (error.name === "AbortError") return;
    if (requestId !== commentSerial || commentsVideoId !== videoId) return;
    elements.commentsStatus.textContent = error.message || "โหลดความคิดเห็นไม่สำเร็จ กรุณาลองใหม่";
    elements.loadMoreComments.disabled = false;
  } finally {
    if (commentController === controller) commentController = null;
  }
}

function openVideo(video) {
  if (elements.watchDialog.open) elements.watchDialog.close();
  elements.watchDialog.classList.remove("mini-player");
  elements.body.classList.remove("has-mini-player");
  currentVideo = video;
  addHistory(video);
  elements.player.src = privacyEmbedUrl(video.id);
  elements.playerTitle.textContent = video.title;
  elements.playerChannel.textContent = video.channel;
  elements.playerStats.textContent = formatViews(video.views);
  elements.playerAvatar.replaceChildren();
  elements.playerAvatar.textContent = avatarText(video.channel);
  elements.playerAvatar.style.backgroundColor = avatarColor(video.channel);
  const channelPicture = safeProfilePicture(video.channelThumbnail);
  if (channelPicture) {
    const image = document.createElement("img");
    image.src = channelPicture;
    image.alt = "";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => {
      image.remove();
      elements.playerAvatar.textContent = avatarText(video.channel);
    }, { once: true });
    elements.playerAvatar.replaceChildren(image);
  }
  const channelHref = youtubeChannelUrl(video.channelId);
  for (const anchor of [elements.playerAvatar, elements.playerChannel]) {
    if (channelHref) anchor.href = channelHref;
    else anchor.removeAttribute("href");
  }
  const channelSubscribe = document.getElementById("channel-subscribe");
  if (channelSubscribe) {
    channelSubscribe.href = channelHref || canonicalWatchUrl(video.id);
  }
  elements.openYouTube.href = canonicalWatchUrl(video.id);
  updatePlayerWatchLater();
  elements.watchDialog.showModal();
  loadComments(video.id);
}

function minimizeVideo() {
  if (!currentVideo || !elements.watchDialog.open || !mobileViewport.matches) return;
  elements.watchDialog.close();
  elements.watchDialog.classList.add("mini-player");
  elements.body.classList.add("has-mini-player");
  elements.watchDialog.show();
}

function expandVideo() {
  if (!currentVideo || !elements.watchDialog.open || !elements.watchDialog.classList.contains("mini-player")) return;
  elements.watchDialog.close();
  elements.watchDialog.classList.remove("mini-player");
  elements.body.classList.remove("has-mini-player");
  elements.watchDialog.showModal();
}

function closeVideo() {
  if (elements.watchDialog.open) elements.watchDialog.close();
  elements.watchDialog.classList.remove("mini-player");
  elements.body.classList.remove("has-mini-player");
  elements.player.src = "";
  commentSerial += 1;
  commentController?.abort();
  commentController = null;
  commentsVideoId = "";
  commentsNextPageToken = "";
  comments = [];
  commentsTotal = 0;
  renderComments();
  elements.commentsStatus.textContent = "เลือกวิดีโอเพื่อดูความคิดเห็น";
  currentVideo = null;
}

async function shareCurrentVideo() {
  if (!currentVideo) return;
  const url = canonicalWatchUrl(currentVideo.id);
  try {
    if (navigator.share) {
      await navigator.share({ title: currentVideo.title, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    showToast("คัดลอกลิงก์วิดีโอแล้ว");
  } catch (error) {
    if (error?.name !== "AbortError") showToast("แชร์วิดีโอไม่สำเร็จ");
  }
}

function updatePlayerWatchLater() {
  const active = currentVideo && isInWatchLater(currentVideo.id);
  elements.favoriteCurrent.classList.toggle("active", Boolean(active));
  elements.favoriteCurrent.firstChild.textContent = active ? "▣ " : "□ ";
}

function showImportMessage(message, isError = false) {
  elements.importMessage.textContent = message;
  elements.importMessage.classList.toggle("error", isError);
  elements.importMessage.hidden = false;
}

function setImportDialogMessage(message = "", isError = false) {
  elements.importDialogMessage.textContent = message;
  elements.importDialogMessage.classList.toggle("error", isError);
}

function openImportDialog(target = activeView) {
  importTarget = target === "watch-later" ? "watch-later" : "history";
  elements.importTitle.textContent = importTarget === "watch-later" ? "นำเข้ารายการดูภายหลัง" : "นำเข้าประวัติ YouTube";
  elements.importText.value = "";
  elements.libraryFiles.value = "";
  setImportDialogMessage("วางลิงก์หรือเลือกไฟล์ที่ต้องการนำเข้า");
  elements.importDialog.showModal();
}

async function enrichImportedVideos(items) {
  const needsMetadata = items.filter((item) => item.title === `YouTube video ${item.id}` || item.channel === "YouTube");
  if (needsMetadata.length === 0) return items;

  const metadata = new Map();
  for (let index = 0; index < needsMetadata.length; index += 50) {
    const ids = needsMetadata.slice(index, index + 50).map((item) => item.id).join(",");
    try {
      const response = await fetch(`/api/video?ids=${encodeURIComponent(ids)}`, { headers: { Accept: "application/json" } });
      const data = await response.json().catch(() => ({}));
      if (response.ok && Array.isArray(data.items)) data.items.forEach((item) => metadata.set(item.id, item));
    } catch {
      // The imported video ID and thumbnail are still usable when metadata lookup fails.
    }
  }

  return items.map((item) => {
    const details = metadata.get(item.id);
    if (!details) return item;
    return {
      ...item,
      title: item.title === `YouTube video ${item.id}` ? details.title : item.title,
      channel: item.channel === "YouTube" ? details.channel : item.channel,
      channelId: item.channelId || details.channelId,
      channelThumbnail: item.channelThumbnail || details.channelThumbnail,
      publishedAt: item.publishedAt || details.publishedAt,
      thumbnail: details.thumbnail || item.thumbnail,
      duration: item.duration || details.duration,
      views: item.views === "0" ? details.views : item.views,
      comments: item.comments || details.comments
    };
  });
}

function applyImportedVideos(items, target) {
  if (target === "watch-later") {
    watchLater = mergeVideoCollections(watchLater, items, { max: MAX_HISTORY });
    if (activeView === "watch-later") videos = [...watchLater];
  } else {
    history = mergeVideoCollections(history, items, { history: true, max: MAX_HISTORY });
    if (activeView === "history") videos = [...history];
  }
}

async function finishImport(groups) {
  const importedHistory = await enrichImportedVideos(groups.history);
  const importedWatchLater = await enrichImportedVideos(groups.watchLater);
  if (importedHistory.length === 0 && importedWatchLater.length === 0) {
    setImportDialogMessage("ไม่พบลิงก์วิดีโอ YouTube ในข้อมูลนี้", true);
    return;
  }

  applyImportedVideos(importedHistory, "history");
  applyImportedVideos(importedWatchLater, "watch-later");
  const saved = saveLocal();
  if (activeView === "history") videos = [...history];
  if (activeView === "watch-later") videos = [...watchLater];
  render();
  const counts = [
    importedHistory.length ? `ประวัติ ${importedHistory.length}` : "",
    importedWatchLater.length ? `ดูภายหลัง ${importedWatchLater.length}` : ""
  ].filter(Boolean).join(" • ");
  showImportMessage(`นำเข้าแล้ว ${counts}${saved ? " • เก็บในเบราว์เซอร์นี้" : " • บันทึกถาวรไม่ได้"}`, !saved);
  elements.importDialog.close();
}

async function importTextPayload() {
  const items = parseLibraryText(elements.importText.value, { target: importTarget });
  const groups = { history: [], watchLater: [] };
  groups[importTarget === "watch-later" ? "watchLater" : "history"] = items;
  await finishImport(groups);
}

async function importLibraryFiles(files) {
  const groups = { history: [], watchLater: [] };
  let totalSize = 0;
  for (const file of files) {
    totalSize += file.size;
    if (totalSize > 20 * 1024 * 1024) {
      setImportDialogMessage("ไฟล์รวมใหญ่เกิน 20 MB", true);
      return;
    }
    const name = file.name.toLowerCase();
    const target = /(watch[\s_-]*later|ดูภายหลัง)/i.test(name)
      ? "watch-later"
      : /(watch[\s_-]*history|history|ประวัติ)/i.test(name)
        ? "history"
        : importTarget;
    const items = parseLibraryText(await file.text(), { filename: file.name, target });
    groups[target === "watch-later" ? "watchLater" : "history"].push(...items);
  }
  await finishImport(groups);
}

function setAuthMessage(message, isError = false) {
  elements.authMessage.textContent = message;
  elements.authMessage.classList.toggle("error", isError);
}

function userInitials(name) {
  return String(name || "MyTube").trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "MY";
}

function safeProfilePicture(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function setAccountAvatar(image, fallback, picture, initials) {
  fallback.textContent = initials;
  fallback.hidden = false;
  image.hidden = true;
  image.removeAttribute("src");
  if (!picture) return;
  image.onload = () => {
    image.hidden = false;
    fallback.hidden = true;
  };
  image.onerror = () => {
    image.hidden = true;
    fallback.hidden = false;
    image.removeAttribute("src");
  };
  image.src = picture;
}

function toggleAccountMenu(force) {
  const shouldOpen = typeof force === "boolean" ? force : elements.accountMenu.hidden;
  elements.accountMenu.hidden = !shouldOpen;
  elements.accountButton.setAttribute("aria-expanded", String(shouldOpen));
  elements.mobileAccountButton.setAttribute("aria-expanded", String(shouldOpen));
}

function unlockApp(user) {
  const label = String(user?.name || "MyTube").trim();
  const initials = userInitials(label);
  const picture = safeProfilePicture(user?.picture);
  elements.accountName.textContent = label;
  elements.accountEmail.textContent = String(user?.email || "").trim();
  elements.accountEmail.hidden = !elements.accountEmail.textContent;
  elements.accountButton.title = `บัญชี ${label}`;
  elements.accountButton.setAttribute("aria-label", `เปิดเมนูบัญชี ${label}`);
  setAccountAvatar(elements.accountAvatarImage, elements.accountAvatarFallback, picture, initials);
  setAccountAvatar(elements.accountMenuAvatarImage, elements.accountMenuAvatarFallback, picture, initials);
  setAccountAvatar(elements.mobileAvatarImage, elements.mobileAvatarFallback, picture, initials);
  elements.authGate.hidden = true;
  elements.body.classList.remove("auth-pending");
  fetchVideos("/api/feed");
  scheduleAutomaticPersonalizationSync();
}

async function performLogout(trigger) {
  const buttons = [elements.accountLogout, elements.logoutButton];
  buttons.forEach((button) => { button.disabled = true; });
  const originalText = trigger.textContent;
  trigger.textContent = "กำลังออกจากระบบ…";
  try {
    const response = await fetch("/api/auth/logout", { method: "POST", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Sign out failed");
    window.google?.accounts?.id?.disableAutoSelect();
    location.reload();
  } catch {
    buttons.forEach((button) => { button.disabled = false; });
    trigger.textContent = "ออกจากระบบไม่สำเร็จ — ลองอีกครั้ง";
    window.setTimeout(() => { trigger.textContent = originalText; }, 2500);
  }
}

function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client?hl=th";
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Google Identity unavailable"));
    document.head.append(script);
  });
}

async function getGoogleClientId() {
  if (googleClientId) return googleClientId;
  const response = await fetch("/api/auth/config", { headers: { Accept: "application/json" } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.clientId) throw new Error("ยังไม่พบการตั้งค่า Google OAuth");
  googleClientId = String(data.clientId);
  return googleClientId;
}

function requestYouTubeAccessToken({ silent = false } = {}) {
  if (youtubeAccessToken && Date.now() < youtubeTokenExpiresAt - 60000) return Promise.resolve(youtubeAccessToken);
  return Promise.all([loadGoogleIdentity(), getGoogleClientId()]).then(([, clientId]) => new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/youtube.readonly",
      include_granted_scopes: true,
      callback: (result) => {
        if (!result?.access_token || result.error) {
          reject(new Error("ไม่ได้รับสิทธิ์อ่านข้อมูล YouTube"));
          return;
        }
        youtubeAccessToken = result.access_token;
        youtubeTokenExpiresAt = Date.now() + Math.max(300, Number(result.expires_in) || 3600) * 1000;
        resolve(youtubeAccessToken);
      },
      error_callback: () => reject(new Error("การเชื่อม YouTube ถูกยกเลิกหรือป๊อปอัปถูกบล็อก"))
    });
    client.requestAccessToken({ prompt: silent || hasYouTubeConnection() ? "" : "consent" });
  }));
}

async function authorizedYouTubeRequest(resource, parameters, token) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${resource}`);
  Object.entries(parameters).forEach(([name, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(name, String(value));
  });
  const response = await fetch(url, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      youtubeAccessToken = "";
      youtubeTokenExpiresAt = 0;
      throw new Error("สิทธิ์ YouTube หมดอายุ กรุณากดเชื่อมอีกครั้ง");
    }
    const reason = String(data?.error?.errors?.[0]?.reason || "");
    throw new Error(reason === "quotaExceeded"
      ? "โควต้า YouTube API เต็มชั่วคราว กรุณาลองใหม่ภายหลัง"
      : "อ่านข้อมูล YouTube ไม่สำเร็จ กรุณาตรวจสิทธิ์แล้วลองใหม่");
  }
  return data;
}

function shuffledCopy(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function chunkItems(items, size = 50) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

async function mapWithConcurrency(items, workerCount, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(workerCount, items.length) }, worker));
  return results;
}

async function loadChannelDetails(channelIds, part, token) {
  if (!channelIds.length) return [];
  const responses = await mapWithConcurrency(chunkItems(channelIds, 50), 4, (chunk) => authorizedYouTubeRequest("channels", {
    part,
    id: chunk.join(","),
    maxResults: 50
  }, token).catch(() => ({ items: [] })));
  return responses.flatMap((response) => response?.items || []);
}

async function loadSubscriptions(token) {
  const items = [];
  let pageToken = "";
  let totalResults = 0;
  const seenTokens = new Set();
  for (let page = 0; page < MAX_YOUTUBE_PAGES && items.length < MAX_SUBSCRIPTION_CHANNELS; page += 1) {
    const data = await authorizedYouTubeRequest("subscriptions", {
      part: "snippet",
      mine: true,
      maxResults: 50,
      order: "relevance",
      pageToken
    }, token);
    items.push(...(data.items || []));
    totalResults = Math.max(totalResults, Number(data.pageInfo?.totalResults) || 0, items.length);
    const nextToken = String(data.nextPageToken || "");
    if (!nextToken || seenTokens.has(nextToken)) break;
    seenTokens.add(nextToken);
    pageToken = nextToken;
  }
  return { items: items.slice(0, MAX_SUBSCRIPTION_CHANNELS), totalResults };
}

async function loadPlaylistVideoIds(playlistId, token) {
  const ids = [];
  let pageToken = "";
  let totalResults = 0;
  const seenTokens = new Set();
  for (let page = 0; page < MAX_YOUTUBE_PAGES && ids.length < MAX_PERSONALIZED_VIDEOS; page += 1) {
    const data = await authorizedYouTubeRequest("playlistItems", {
      part: "contentDetails,snippet",
      playlistId,
      maxResults: 50,
      pageToken
    }, token);
    ids.push(...playlistVideoIds(data));
    totalResults = Math.max(totalResults, Number(data.pageInfo?.totalResults) || 0, ids.length);
    const nextToken = String(data.nextPageToken || "");
    if (!nextToken || seenTokens.has(nextToken)) break;
    seenTokens.add(nextToken);
    pageToken = nextToken;
  }
  return { ids: [...new Set(ids)].slice(0, MAX_PERSONALIZED_VIDEOS), totalResults };
}

function channelThumbnailMap(channels) {
  return new Map((channels || []).map((channel) => {
    const thumbnails = channel?.snippet?.thumbnails || {};
    return [String(channel?.id || ""), String(thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url || "")];
  }));
}

async function loadAuthorizedVideoDetails(ids, token) {
  const uniqueIds = [...new Set(ids)].filter(Boolean).slice(0, MAX_PERSONALIZED_VIDEOS);
  if (uniqueIds.length === 0) return [];
  const responses = await mapWithConcurrency(chunkItems(uniqueIds, 50), 4, (chunk) => authorizedYouTubeRequest("videos", {
    part: "snippet,contentDetails,statistics",
    id: chunk.join(","),
    maxResults: 50
  }, token).catch(() => ({ items: [] })));
  return responses.flatMap((response) => response?.items || []);
}

async function buildPersonalizationSnapshot(token) {
  const [mine, subscriptions] = await Promise.all([
    authorizedYouTubeRequest("channels", { part: "contentDetails", mine: true }, token),
    loadSubscriptions(token)
  ]);
  const likesPlaylistId = String(mine.items?.[0]?.contentDetails?.relatedPlaylists?.likes || "");
  const subscriptionIds = [...new Set(subscriptions.items
    .map((item) => String(item?.snippet?.resourceId?.channelId || ""))
    .filter(Boolean))];
  const selectedSubscriptionIds = shuffledCopy(subscriptionIds).slice(0, MAX_SUBSCRIPTION_CHANNELS);

  const [likes, selectedChannels] = await Promise.all([
    likesPlaylistId ? loadPlaylistVideoIds(likesPlaylistId, token) : Promise.resolve({ ids: [], totalResults: 0 }),
    loadChannelDetails(selectedSubscriptionIds, "snippet,contentDetails", token).then((items) => ({ items }))
  ]);

  const likedIds = likes.ids;
  const uploadPlaylists = (selectedChannels.items || [])
    .map((channel) => String(channel?.contentDetails?.relatedPlaylists?.uploads || ""))
    .filter(Boolean);
  const uploadPages = await mapWithConcurrency(uploadPlaylists, PERSONALIZATION_WORKERS, (playlistId) => authorizedYouTubeRequest("playlistItems", {
    part: "contentDetails",
    playlistId,
    maxResults: UPLOADS_PER_CHANNEL
  }, token).catch(() => ({ items: [] })));
  const uploadIds = [...new Set(uploadPages.flatMap(playlistVideoIds))].slice(0, MAX_PERSONALIZED_VIDEOS);
  if (likedIds.length === 0 && uploadIds.length === 0) throw new Error("ยังไม่พบวิดีโอที่ชอบหรือคลิปใหม่จากช่องที่ติดตาม");

  const requestedIds = [...new Set([
    ...likedIds.slice(0, MAX_PERSONALIZED_VIDEOS),
    ...uploadIds.slice(0, MAX_PERSONALIZED_VIDEOS)
  ])].slice(0, MAX_PERSONALIZED_VIDEOS);
  const [likedDetails, subscriptionDetails] = await Promise.all([
    loadAuthorizedVideoDetails(requestedIds.filter((id) => likedIds.includes(id)), token),
    loadAuthorizedVideoDetails(requestedIds.filter((id) => uploadIds.includes(id)), token)
  ]);
  const allDetails = [...likedDetails, ...subscriptionDetails];
  const videoChannelIds = [...new Set(allDetails.map((item) => String(item?.snippet?.channelId || "")).filter(Boolean))];
  const channelDetails = await loadChannelDetails(videoChannelIds, "snippet", token);
  const thumbnails = channelThumbnailMap(channelDetails);
  const formatItems = (details, recommendationReason) => details.map((item) => {
    const video = formatAuthorizedVideo(item, thumbnails);
    return video ? { ...video, recommendationReason } : null;
  }).filter(Boolean);
  const likedItems = formatItems(likedDetails, "วิดีโอที่คุณชอบ");
  const subscriptionItems = formatItems(subscriptionDetails, "ใหม่จากช่องที่ติดตาม");
  const items = [...new Map([...likedItems, ...subscriptionItems].map((video) => [video.id, video])).values()];
  if (items.length === 0) throw new Error("วิดีโอจากบัญชีนี้ไม่พร้อมแสดงใน MyTube");
  return {
    items,
    likedItems,
    subscriptionItems,
    subscriptionCount: subscriptions.totalResults,
    likedCount: Math.max(likedIds.length, Number(likes.totalResults) || 0),
    updatedAt: new Date().toISOString()
  };
}

function updatePersonalizationPanel(message = "", isError = false) {
  const connected = hasYouTubeConnection();
  const isAccountView = ["subscriptions", "liked"].includes(activeView);
  elements.personalizationPanel.classList.toggle("connected", connected && !isError);
  elements.personalizationPanel.classList.toggle("error", isError);
  elements.personalizationTitle.textContent = connected
    ? (isAccountView ? "เชื่อม YouTube แบบอ่านอย่างเดียวทั่ว MyTube แล้ว" : "ฟีดสำหรับคุณจาก YouTube พร้อมแล้ว")
    : "เชื่อมข้อมูล YouTube แบบอ่านอย่างเดียว";
  elements.personalizationStatus.textContent = message || (connected
    ? `${formatCompactNumber(personalization.subscriptionCount)} ช่องที่ติดตาม • ${formatCompactNumber(personalization.likedCount)} วิดีโอที่ชอบ • อัปเดต${formatAge(personalization.updatedAt)}`
    : "ใช้สิทธิ์เดียวเพื่อเปิดการติดตามและวิดีโอที่ชอบในทุกหน้าของ MyTube");
  elements.connectYouTube.textContent = personalizationBusy ? "กำลังเชื่อม…" : connected ? "อัปเดตข้อมูล" : "เชื่อม YouTube";
  elements.accountYouTube.querySelector("span:nth-child(2)").textContent = connected ? "อัปเดตข้อมูล YouTube" : "เชื่อมข้อมูล YouTube แบบอ่านอย่างเดียว";
  elements.connectYouTube.disabled = personalizationBusy;
  elements.accountYouTube.disabled = personalizationBusy;
  elements.clearPersonalization.hidden = !connected || personalizationBusy;
}

function personalizationNeedsRefresh() {
  const updatedAt = Date.parse(personalization.updatedAt);
  return !Number.isFinite(updatedAt) || Date.now() - updatedAt >= PERSONALIZATION_REFRESH_MS;
}

function scheduleAutomaticPersonalizationSync() {
  window.clearTimeout(personalizationTimer);
  personalizationTimer = null;
  // Access tokens are intentionally kept in memory only. Do not trigger an
  // OAuth popup on a fresh page load just because a cached snapshot exists.
  // Automatic refresh is enabled after the user has connected in this
  // browser session and a usable token is available.
  if (!hasYouTubeConnection() || !youtubeAccessToken) return;
  const wait = personalizationNeedsRefresh() ? 1200 : PERSONALIZATION_REFRESH_MS;
  personalizationTimer = window.setTimeout(async () => {
    personalizationTimer = null;
    await connectYouTubePersonalization({ automatic: true });
    scheduleAutomaticPersonalizationSync();
  }, wait);
}

async function connectYouTubePersonalization({ automatic = false } = {}) {
  if (personalizationBusy) return;
  personalizationBusy = true;
  toggleAccountMenu(false);
  updatePersonalizationPanel(automatic ? "กำลังอัปเดตฟีด YouTube อัตโนมัติ…" : "เลือกบัญชีและอนุญาตสิทธิ์อ่าน YouTube ในหน้าต่าง Google");
  let finalMessage = "";
  let failed = false;
  try {
    const token = await requestYouTubeAccessToken({ silent: automatic });
    updatePersonalizationPanel("กำลังอ่านช่องที่ติดตามและวิดีโอที่คุณชอบ…");
    personalization = await buildPersonalizationSnapshot(token);
    if (!savePersonalization()) finalMessage = "สร้างฟีดแล้ว แต่เบราว์เซอร์ไม่อนุญาตให้บันทึกข้อมูลไว้";
    if (activeView === "home") await fetchVideos(videoRequestUrl());
    else if (["subscriptions", "liked"].includes(activeView)) activateView(activeView);
  } catch (error) {
    failed = !automatic;
    finalMessage = automatic ? "" : error.message || "เชื่อมข้อมูล YouTube ไม่สำเร็จ";
  } finally {
    personalizationBusy = false;
    updatePersonalizationPanel(finalMessage, failed);
    scheduleAutomaticPersonalizationSync();
  }
}

function clearPersonalizedFeed() {
  if (!window.confirm("ล้างข้อมูลฟีดสำหรับคุณที่เก็บในเบราว์เซอร์นี้หรือไม่?")) return;
  personalization = emptyPersonalization();
  safeStorageSet(PERSONALIZATION_KEY, "");
  safeStorageSet(LAST_HOME_ORDER_KEY, "");
  youtubeAccessToken = "";
  youtubeTokenExpiresAt = 0;
  window.clearTimeout(personalizationTimer);
  personalizationTimer = null;
  updatePersonalizationPanel("ล้างข้อมูลฟีดสำหรับคุณแล้ว");
  if (activeView === "home") fetchVideos(videoRequestUrl());
  else if (["subscriptions", "liked"].includes(activeView)) activateView(activeView);
}

async function handleGoogleCredential(result) {
  setAuthMessage("กำลังยืนยันบัญชี Google…");
  try {
    const response = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ credential: result.credential })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "เข้าสู่ระบบไม่สำเร็จ");
    unlockApp(data.user);
  } catch (error) {
    setAuthMessage(error.message || "เข้าสู่ระบบไม่สำเร็จ", true);
  }
}

function shouldRedirectGoogleSignIn() {
  const isAppleMobile = /iPad|iPhone|iPod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches === true;
  return location.protocol === "https:" && (isAppleMobile || isStandalone);
}

function consumeAuthError() {
  const url = new URL(location.href);
  const code = url.searchParams.get("auth_error");
  if (!code) return "";
  url.searchParams.delete("auth_error");
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  return code === "not_allowed"
    ? "บัญชี Google นี้ไม่ได้รับอนุญาต"
    : "ยืนยันบัญชี Google ไม่สำเร็จ กรุณาลองอีกครั้ง";
}

async function initializeAuth() {
  try {
    const sessionResponse = await fetch("/api/auth/session", { headers: { Accept: "application/json" } });
    const session = await sessionResponse.json().catch(() => ({}));
    if (session.authenticated) {
      unlockApp(session.user);
      return;
    }
    const configResponse = await fetch("/api/auth/config", { headers: { Accept: "application/json" } });
    const config = await configResponse.json().catch(() => ({}));
    if (!configResponse.ok || !config.clientId) throw new Error("Google Sign-In ยังไม่ได้ตั้งค่าใน Vercel");
    googleClientId = String(config.clientId);
    await loadGoogleIdentity();
    const redirectSignIn = shouldRedirectGoogleSignIn();
    window.google.accounts.id.initialize(redirectSignIn ? {
      client_id: config.clientId,
      ux_mode: "redirect",
      login_uri: `${location.origin}/api/auth/google`
    } : {
      client_id: config.clientId,
      callback: handleGoogleCredential,
      auto_select: true,
      use_fedcm_for_button: true,
      button_auto_select: true
    });
    window.google.accounts.id.renderButton(elements.googleButton, {
      type: "standard",
      theme: "filled_black",
      size: "large",
      text: "continue_with",
      shape: "pill",
      logo_alignment: "left",
      width: Math.min(420, elements.googleButton.clientWidth || 420)
    });
    const authError = consumeAuthError();
    setAuthMessage(authError || "เลือกบัญชี Google ที่ได้รับอนุญาต", Boolean(authError));
  } catch (error) {
    setAuthMessage(error.message || "เตรียม Google Sign-In ไม่สำเร็จ", true);
  }
}

elements.menuToggle.addEventListener("click", () => elements.body.classList.toggle("sidebar-collapsed"));
elements.accountButton.addEventListener("click", (event) => {
  event.stopPropagation();
  closeVideoMenu();
  toggleAccountMenu();
});
elements.mobileAccountButton.addEventListener("click", (event) => {
  event.stopPropagation();
  closeVideoMenu();
  toggleAccountMenu();
});
elements.accountMenu.addEventListener("click", (event) => event.stopPropagation());
elements.accountPrivacy.addEventListener("click", () => {
  toggleAccountMenu(false);
  elements.privacyDialog.showModal();
});
elements.accountLogout.addEventListener("click", () => performLogout(elements.accountLogout));
elements.connectYouTube.addEventListener("click", connectYouTubePersonalization);
elements.accountYouTube.addEventListener("click", connectYouTubePersonalization);
elements.clearPersonalization.addEventListener("click", clearPersonalizedFeed);
elements.videoMenu.addEventListener("click", async (event) => {
  event.stopPropagation();
  const action = event.target.closest("[data-video-menu-action]")?.dataset.videoMenuAction;
  const video = currentMenuVideo;
  if (!action || !video) return;
  if (action === "play") {
    closeVideoMenu();
    openVideo(video);
  } else if (action === "watch-later") {
    closeVideoMenu();
    toggleWatchLater(video);
  } else if (action === "copy") {
    try {
      await navigator.clipboard.writeText(canonicalWatchUrl(video.id));
      showToast("คัดลอกลิงก์วิดีโอแล้ว");
    } catch {
      showToast("คัดลอกลิงก์ไม่สำเร็จ");
    }
    closeVideoMenu();
  }
});
elements.videoMenuYouTube.addEventListener("click", () => closeVideoMenu());
document.addEventListener("click", () => {
  toggleAccountMenu(false);
  closeVideoMenu();
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!elements.accountMenu.hidden) {
    toggleAccountMenu(false);
    elements.accountButton.focus();
  } else if (!elements.videoMenu.hidden) {
    const trigger = currentMenuTrigger;
    closeVideoMenu();
    trigger?.focus();
  }
});
elements.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = elements.searchInput.value.trim();
  if (mobileViewport.matches && !elements.body.classList.contains("mobile-searching") && !query) {
    elements.body.classList.add("mobile-searching");
    elements.searchInput.focus();
    return;
  }
  elements.body.classList.remove("mobile-searching");
  if (!query) return activateView("home");
  activeView = "search";
  elements.body.dataset.view = "search";
  activeQuery = query;
  elements.navButtons.forEach((button) => button.classList.remove("active"));
  elements.chips.hidden = true;
  elements.historyTools.hidden = true;
  elements.importMessage.hidden = true;
  elements.title.textContent = `ผลค้นหา “${query}”`;
  elements.eyebrow.textContent = "SEARCH RESULTS";
  fetchVideos(videoRequestUrl());
});
elements.mobileSearchClose.addEventListener("click", () => {
  elements.body.classList.remove("mobile-searching");
  elements.searchInput.blur();
});

elements.mobileSearchClose.addEventListener("click", () => {
  elements.body.classList.remove("mobile-searching");
  elements.searchInput.blur();
});

function selectCategory(button) {
  activeCategory = button.dataset.category;
  [...elements.chips.querySelectorAll("[data-category]")].forEach((item) => item.classList.toggle("active", item === button));
  elements.title.textContent = activeCategory ? button.textContent : "กำลังมาแรงในไทย";
  fetchVideos(videoRequestUrl());
}

elements.chips.querySelectorAll("[data-category]").forEach((button) => {
  button.addEventListener("click", () => selectCategory(button));
});

elements.grid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-video-id]");
  const action = event.target.closest("[data-action]");
  if (!card || !action) return;
  const video = videos.find((item) => item.id === card.dataset.videoId);
  if (!video) return;
  if (action.dataset.action === "play") openVideo(video);
  if (action.dataset.action === "watch-later") toggleWatchLater(video);
  if (action.dataset.action === "options") {
    event.stopPropagation();
    openVideoMenu(video, action);
  }
});

elements.voiceSearch.addEventListener("click", startVoiceSearch);

elements.refresh.addEventListener("click", () => {
  if ((activeView === "search" && activeQuery) || activeView === "home") fetchVideos(videoRequestUrl());
  else if (["subscriptions", "liked"].includes(activeView)) connectYouTubePersonalization();
  else render();
});
elements.backHome.addEventListener("click", () => {
  if (activeView === "history" || activeView === "watch-later") openImportDialog(activeView);
  else if (["subscriptions", "liked"].includes(activeView)) connectYouTubePersonalization();
  else activateView("home");
});
elements.navButtons.forEach((button) => button.addEventListener("click", () => {
  toggleAccountMenu(false);
  closeVideoMenu();
  activateView(button.dataset.view);
}));
elements.historySearch.addEventListener("input", () => render());
elements.importLibrary.addEventListener("click", () => openImportDialog(activeView));
elements.clearLibrary.addEventListener("click", () => {
  const isWatchLater = activeView === "watch-later";
  const collection = isWatchLater ? watchLater : history;
  const label = isWatchLater ? "รายการดูภายหลัง" : "ประวัติ MyTube";
  if (collection.length === 0 || !window.confirm(`ล้าง${label}ทั้งหมดในเบราว์เซอร์นี้หรือไม่?`)) return;
  if (isWatchLater) watchLater = [];
  else history = [];
  videos = [];
  const saved = saveLocal();
  render();
  showImportMessage(saved ? `ล้าง${label}แล้ว` : `ล้างชั่วคราว แต่บันทึกถาวรไม่ได้`, !saved);
});
elements.closeImport.addEventListener("click", () => elements.importDialog.close());
elements.importDialog.addEventListener("click", (event) => { if (event.target === elements.importDialog) elements.importDialog.close(); });
elements.chooseImportFiles.addEventListener("click", () => elements.libraryFiles.click());
elements.libraryFiles.addEventListener("change", async () => {
  try {
    await importLibraryFiles([...elements.libraryFiles.files]);
  } catch {
    setImportDialogMessage("อ่านไฟล์ไม่ได้ กรุณาเลือก JSON หรือ CSV จาก Google Takeout", true);
  }
});
elements.applyImport.addEventListener("click", async () => {
  setImportDialogMessage("กำลังนำเข้า…");
  try {
    await importTextPayload();
  } catch {
    setImportDialogMessage("นำเข้าไม่สำเร็จ กรุณาตรวจลิงก์หรือไฟล์", true);
  }
});
elements.closePlayer.addEventListener("click", closeVideo);
elements.minimizePlayer.addEventListener("click", minimizeVideo);
elements.expandPlayer.addEventListener("click", expandVideo);
elements.shareCurrent.addEventListener("click", shareCurrentVideo);
elements.watchDialog.addEventListener("click", (event) => {
  if (elements.watchDialog.classList.contains("mini-player")) {
    if (event.target.closest("#close-player")) {
      closeVideo();
      return;
    }
    expandVideo();
    return;
  }
  if (event.target === elements.watchDialog) closeVideo();
});
const commentsTeaser = document.getElementById("comments-teaser");
if (commentsTeaser) {
  commentsTeaser.addEventListener("click", () => {
    const commentsSection = document.querySelector(".comments-section");
    commentsSection?.scrollIntoView({ behavior: "smooth" });
  });
}
elements.watchDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeVideo();
});
mobileViewport.addEventListener("change", (event) => {
  if (!event.matches && elements.watchDialog.classList.contains("mini-player")) expandVideo();
  if (!event.matches) elements.body.classList.remove("mobile-searching");
});
elements.favoriteCurrent.addEventListener("click", () => { if (currentVideo) toggleWatchLater(currentVideo); });
elements.loadMoreComments.addEventListener("click", () => {
  if (commentsVideoId) loadComments(commentsVideoId, { append: true });
});
elements.commentsOrder.addEventListener("change", () => {
  if (currentVideo) loadComments(currentVideo.id);
});
elements.privacyButton.addEventListener("click", () => elements.privacyDialog.showModal());
elements.closePrivacy.addEventListener("click", () => elements.privacyDialog.close());
elements.privacyDone.addEventListener("click", () => elements.privacyDialog.close());
elements.privacyDialog.addEventListener("click", (event) => { if (event.target === elements.privacyDialog) elements.privacyDialog.close(); });
elements.logoutButton.addEventListener("click", () => performLogout(elements.logoutButton));

const feedObserver = new IntersectionObserver((entries) => {
  if (entries.some((entry) => entry.isIntersecting)) loadNextVideoPage();
}, { rootMargin: "900px 0px" });
feedObserver.observe(elements.feedSentinel);

updatePersonalizationPanel();
initializeAuth();
