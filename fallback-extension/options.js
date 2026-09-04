"use strict";

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

const keys = Object.keys(DEFAULTS);
const form = document.getElementById("settings");
const status = document.getElementById("status");

function render(values) {
  for (const key of keys) {
    document.getElementById(key).checked = Boolean(values[key]);
  }
}

function showStatus(message) {
  status.textContent = message;
  window.setTimeout(() => {
    status.textContent = "";
  }, 1600);
}

chrome.storage.sync.get(DEFAULTS, render);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(
    keys.map((key) => [key, document.getElementById(key).checked])
  );
  await chrome.storage.sync.set(values);
  showStatus("Saved.");
});

document.getElementById("reset").addEventListener("click", async () => {
  await chrome.storage.sync.set(DEFAULTS);
  render(DEFAULTS);
  showStatus("Defaults restored.");
});
