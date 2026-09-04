import { canonicalWatchUrl, privacyEmbedUrl } from "./video-utils.js";
import { mergeVideoCollections, parseLibraryText } from "./library-utils.js";

const WATCH_LATER_KEY = "mytube-private-watch-later-v3";
const LEGACY_FAVORITES_KEY = "mytube-private-favorites-v2";
const HISTORY_KEY = "mytube-private-history-v2";
const MAX_HISTORY = 1000;

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
  logoutButton: document.getElementById("logout-button"),
  menuToggle: document.getElementById("menu-toggle"),
  searchForm: document.getElementById("search-form"),
  searchInput: document.getElementById("search-input"),
  chips: document.getElementById("category-chips"),
  grid: document.getElementById("video-grid"),
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
  privacyDone: document.getElementById("privacy-done"),
  importDialog: document.getElementById("import-dialog"),
  closeImport: document.getElementById("close-import"),
  importTitle: document.getElementById("import-title"),
  importText: document.getElementById("import-text"),
  chooseImportFiles: document.getElementById("choose-import-files"),
  libraryFiles: document.getElementById("library-files"),
  applyImport: document.getElementById("apply-import"),
  importDialogMessage: document.getElementById("import-dialog-message")
};

let storageFailed = false;
let watchLater = loadWatchLater();
let history = loadJson(HISTORY_KEY, []);
let videos = [];
let currentVideo = null;
let activeCategory = "";
let activeView = "home";
let activeQuery = "";
let requestController = null;
let requestSerial = 0;
let importTarget = "history";

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
  const watchLaterButton = document.createElement("button");
  watchLaterButton.className = `favorite-button${isInWatchLater(video.id) ? " active" : ""}`;
  watchLaterButton.type = "button";
  watchLaterButton.dataset.action = "watch-later";
  watchLaterButton.textContent = isInWatchLater(video.id) ? "▣" : "□";
  watchLaterButton.setAttribute("aria-label", isInWatchLater(video.id) ? "นำออกจากดูภายหลัง" : "เพิ่มไปดูภายหลัง");
  body.append(avatar, copy, watchLaterButton);
  article.append(thumbnailButton, body);
  return article;
}

function configureEmptyState() {
  if (activeView === "watch-later") {
    elements.emptyTitle.textContent = "ยังไม่มีรายการดูภายหลังใน MyTube";
    elements.emptyCopy.textContent = "นำเข้ารายการ Watch Later เดิมจาก YouTube หรือกดปุ่ม □ บนวิดีโอเพื่อเก็บไว้ดูภายหลัง";
    elements.backHome.textContent = "นำเข้าจาก YouTube";
  } else if (activeView === "history") {
    elements.emptyTitle.textContent = "ยังไม่มีประวัติใน MyTube";
    elements.emptyCopy.textContent = "นำเข้าประวัติเดิมจาก YouTube หรือเปิดวิดีโอใน MyTube เพื่อเริ่มบันทึกประวัติ";
    elements.backHome.textContent = "นำเข้าจาก YouTube";
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
}

async function fetchVideos(url) {
  requestController?.abort();
  const controller = new AbortController();
  const requestId = ++requestSerial;
  const requestView = activeView;
  requestController = controller;
  showSkeletons();
  setStatus("กำลังโหลดวิดีโอ…");
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "โหลดรายการไม่สำเร็จ");
    if (requestId !== requestSerial || requestView !== activeView) return;
    videos = Array.isArray(data.items) ? data.items : [];
    render();
  } catch (error) {
    if (error.name === "AbortError") return;
    if (requestId !== requestSerial || requestView !== activeView) return;
    videos = [];
    render();
    setStatus(error.message || "โหลดรายการไม่สำเร็จ กรุณาลองใหม่", true);
  } finally {
    if (requestController === controller) requestController = null;
  }
}

function activateView(view) {
  activeView = view;
  if (view === "watch-later" || view === "history") {
    requestSerial += 1;
    requestController?.abort();
    requestController = null;
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
  } else {
    activeQuery = "";
    elements.searchInput.value = "";
    elements.title.textContent = "กำลังมาแรงในไทย";
    elements.eyebrow.textContent = "MYTUBE • THAILAND";
    fetchVideos(`/api/feed?category=${encodeURIComponent(activeCategory)}`);
  }
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

function addHistory(video) {
  history = [{ ...video, watchedAt: new Date().toISOString() }, ...history.filter((item) => item.id !== video.id)].slice(0, MAX_HISTORY);
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
  updatePlayerWatchLater();
  elements.watchDialog.showModal();
}

function closeVideo() {
  elements.watchDialog.close();
  elements.player.src = "";
  currentVideo = null;
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
      publishedAt: item.publishedAt || details.publishedAt,
      thumbnail: details.thumbnail || item.thumbnail,
      duration: item.duration || details.duration,
      views: item.views === "0" ? details.views : item.views
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
  elements.authGate.hidden = true;
  elements.body.classList.remove("auth-pending");
  fetchVideos("/api/feed");
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
    await loadGoogleIdentity();
    window.google.accounts.id.initialize({
      client_id: config.clientId,
      callback: handleGoogleCredential,
      auto_select: true,
      use_fedcm_for_prompt: true
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
    setAuthMessage("เลือกบัญชี Google ที่ได้รับอนุญาต");
  } catch (error) {
    setAuthMessage(error.message || "เตรียม Google Sign-In ไม่สำเร็จ", true);
  }
}

elements.menuToggle.addEventListener("click", () => elements.body.classList.toggle("sidebar-collapsed"));
elements.accountButton.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleAccountMenu();
});
elements.accountMenu.addEventListener("click", (event) => event.stopPropagation());
elements.accountPrivacy.addEventListener("click", () => {
  toggleAccountMenu(false);
  elements.privacyDialog.showModal();
});
elements.accountLogout.addEventListener("click", () => performLogout(elements.accountLogout));
document.addEventListener("click", () => toggleAccountMenu(false));
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || elements.accountMenu.hidden) return;
  toggleAccountMenu(false);
  elements.accountButton.focus();
});
elements.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = elements.searchInput.value.trim();
  if (!query) return activateView("home");
  activeView = "search";
  activeQuery = query;
  elements.navButtons.forEach((button) => button.classList.remove("active"));
  elements.chips.hidden = true;
  elements.historyTools.hidden = true;
  elements.importMessage.hidden = true;
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
  if (action.dataset.action === "watch-later") toggleWatchLater(video);
});

elements.refresh.addEventListener("click", () => {
  if (activeView === "search" && activeQuery) fetchVideos(`/api/search?q=${encodeURIComponent(activeQuery)}`);
  else if (activeView === "home") fetchVideos(`/api/feed?category=${encodeURIComponent(activeCategory)}`);
  else render();
});
elements.backHome.addEventListener("click", () => {
  if (activeView === "history" || activeView === "watch-later") openImportDialog(activeView);
  else activateView("home");
});
elements.navButtons.forEach((button) => button.addEventListener("click", () => activateView(button.dataset.view)));
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
elements.watchDialog.addEventListener("click", (event) => { if (event.target === elements.watchDialog) closeVideo(); });
elements.favoriteCurrent.addEventListener("click", () => { if (currentVideo) toggleWatchLater(currentVideo); });
elements.privacyButton.addEventListener("click", () => elements.privacyDialog.showModal());
elements.closePrivacy.addEventListener("click", () => elements.privacyDialog.close());
elements.privacyDone.addEventListener("click", () => elements.privacyDialog.close());
elements.privacyDialog.addEventListener("click", (event) => { if (event.target === elements.privacyDialog) elements.privacyDialog.close(); });
elements.logoutButton.addEventListener("click", () => performLogout(elements.logoutButton));

initializeAuth();
