"use strict";

const STYLE_ID = "mytube-focus-style";
const DEFAULTS = Object.freeze({
  hideShorts: false,
  hideHomeFeed: false,
  hideRecommendations: false,
  hideComments: false,
  hideMerch: false,
  hidePromotions: true,
  hidePopups: true,
  focusMode: false
});

const SELECTORS = Object.freeze({
  shorts: [
    "ytd-reel-shelf-renderer",
    "ytd-rich-shelf-renderer[is-shorts]",
    "ytd-guide-entry-renderer a[href='/shorts']",
    "ytd-mini-guide-entry-renderer a[href='/shorts']",
    "ytd-video-renderer a[href^='/shorts/']",
    "ytd-rich-item-renderer:has(a[href^='/shorts/'])"
  ],
  homeFeed: [
    "ytd-browse[page-subtype='home'] #primary",
    "ytd-browse[page-subtype='home'] ytd-rich-grid-renderer"
  ],
  recommendations: [
    "ytd-watch-flexy #secondary",
    "ytd-watch-next-secondary-results-renderer"
  ],
  comments: [
    "ytd-watch-flexy ytd-comments#comments",
    "ytd-comments#comments"
  ],
  merch: [
    "ytd-merch-shelf-renderer",
    "ytd-product-list-renderer",
    "ytd-shopping-shelf-renderer"
  ],
  promotions: [
    "ytd-promoted-sparkles-web-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "ytd-ad-slot-renderer",
    "yt-ad-slot-renderer",
    "ytd-rich-item-renderer:has(ytd-ad-slot-renderer)",
    "ytd-rich-item-renderer:has(ytd-in-feed-ad-layout-renderer)",
    "ytd-rich-item-renderer:has(a[href*='/pagead/aclk'])",
    "ytd-rich-item-renderer:has(a[href*='googleadservices.com'])",
    "yt-lockup-view-model:has(a[href*='/pagead/aclk'])",
    "yt-lockup-view-model:has(a[href*='googleadservices.com'])"
  ],
  popups: [
    "ytd-mealbar-promo-renderer",
    "yt-mealbar-promo-renderer",
    "ytd-popup-container tp-yt-paper-dialog:has(ytd-mealbar-promo-renderer)"
  ]
});

function appendRule(lines, enabled, selectors) {
  if (enabled) {
    lines.push(`${selectors.join(",\n")} { display: none !important; }`);
  }
}

function applySettings(settings) {
  const values = { ...DEFAULTS, ...settings };
  const focus = values.focusMode;
  const lines = [];
  appendRule(lines, values.hideShorts || focus, SELECTORS.shorts);
  appendRule(lines, values.hideHomeFeed || focus, SELECTORS.homeFeed);
  appendRule(lines, values.hideRecommendations || focus, SELECTORS.recommendations);
  appendRule(lines, values.hideComments, SELECTORS.comments);
  appendRule(lines, values.hideMerch || focus, SELECTORS.merch);
  appendRule(lines, values.hidePromotions || focus, SELECTORS.promotions);
  appendRule(lines, values.hidePopups, SELECTORS.popups);

  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    (document.documentElement || document).appendChild(style);
  }
  style.textContent = lines.join("\n");
}

chrome.storage.sync.get(DEFAULTS, applySettings);
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") {
    return;
  }
  chrome.storage.sync.get(DEFAULTS, applySettings);
});
