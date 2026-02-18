/* DEFAULT_SETTINGS is provided by constants.js */

let isBoosting = false;
let boostedVideo = null;
let prevRate = 1;
let boostTimer = null;
let lastSeenVideo = null;

let settings = { ...DEFAULT_SETTINGS };
let hudEl = null;
let hudValueEl = null;

/* ---------- video cache ---------- */

const videoCache = new Set();

function findVideosDeep(root) {
  const videos = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);

  let node = root;
  while (node) {
    if (node.tagName === "VIDEO") videos.push(node);
    if (node.shadowRoot) videos.push(...findVideosDeep(node.shadowRoot));
    node = walker.nextNode();
  }

  return videos;
}

function rebuildVideoCache() {
  videoCache.clear();
  for (const v of findVideosDeep(document)) videoCache.add(v);
}

function addVideosFromNode(root) {
  if (root.tagName === "VIDEO") videoCache.add(root);
  if (root.querySelectorAll) {
    for (const v of root.querySelectorAll("video")) videoCache.add(v);
  }
  if (root.shadowRoot) {
    for (const v of findVideosDeep(root.shadowRoot)) videoCache.add(v);
  }
}

function pruneVideoCache() {
  for (const v of videoCache) {
    if (!document.contains(v)) videoCache.delete(v);
  }
}

const videoCacheObserver = new MutationObserver((mutations) => {
  let changed = false;
  for (const m of mutations) {
    for (const added of m.addedNodes) {
      if (added.nodeType !== 1) continue;
      addVideosFromNode(added);
      changed = true;
    }
    if (m.removedNodes.length > 0) {
      pruneVideoCache();
      changed = true;
    }
  }
  if (changed) attachVideoListeners();
});

/* ---------- settings ---------- */

function parseSettingNumber(value, fallback, min, max) {
  if (!Number.isFinite(value)) return fallback;
  if (value < min || value > max) return fallback;
  return value;
}

function loadSettings() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (data) => {
    settings = {
      holdKeyCode: data.holdKeyCode || DEFAULT_SETTINGS.holdKeyCode,
      boostRate: parseSettingNumber(data.boostRate, DEFAULT_SETTINGS.boostRate, 0.1, 16),
      increaseKeyCode: data.increaseKeyCode || DEFAULT_SETTINGS.increaseKeyCode,
      decreaseKeyCode: data.decreaseKeyCode || DEFAULT_SETTINGS.decreaseKeyCode,
      resetKeyCode: data.resetKeyCode || DEFAULT_SETTINGS.resetKeyCode,
      speedStep: parseSettingNumber(data.speedStep, DEFAULT_SETTINGS.speedStep, 0.1, 4),
      hudX: parseSettingNumber(data.hudX, DEFAULT_SETTINGS.hudX, 0, 100000),
      hudY: parseSettingNumber(data.hudY, DEFAULT_SETTINGS.hudY, 0, 100000),
    };
    applyHudPosition();
  });
}

/* ---------- helpers ---------- */

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

function isVideoVisible(v) {
  if (!v) return false;
  const rect = v.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;

  const visibleX = Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0);
  const visibleY = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
  return visibleX > 0 && visibleY > 0;
}

function getVideo() {
  const vids = [...videoCache];
  if (vids.length > 0) {
    const chosen =
      vids.find((v) => !v.paused && isVideoVisible(v)) ||
      vids.find((v) => isVideoVisible(v)) ||
      vids.find((v) => !v.paused) ||
      vids[0];
    lastSeenVideo = chosen;
    return chosen;
  }
  return lastSeenVideo;
}

function eventVideoTarget(event) {
  if (!event || typeof event.composedPath !== "function") return null;
  const path = event.composedPath();
  for (const node of path) {
    if (node && node.tagName === "VIDEO") return node;
  }
  return null;
}

/* ---------- video event tracking ---------- */

const trackedVideos = new WeakSet();

function attachVideoListeners() {
  for (const v of videoCache) {
    if (trackedVideos.has(v)) continue;
    trackedVideos.add(v);
    v.addEventListener("ratechange", () => updateHudValue());
  }
}

function registerVideoTracking() {
  const events = ["play", "playing", "ratechange", "loadedmetadata"];
  for (const eventName of events) {
    window.addEventListener(
      eventName,
      (event) => {
        const v = eventVideoTarget(event);
        if (v) {
          lastSeenVideo = v;
          videoCache.add(v);
        }
        if (eventName === "ratechange") updateHudValue();
      },
      true
    );
  }
}

/* ---------- boost ---------- */

function boostOn() {
  if (isBoosting) return;
  const v = getVideo();
  if (!v) return;

  prevRate = v.playbackRate;
  v.playbackRate = settings.boostRate;
  boostedVideo = v;
  isBoosting = true;
  boostTimer = window.setInterval(() => {
    if (!isBoosting || !boostedVideo) return;
    if (Math.abs(boostedVideo.playbackRate - settings.boostRate) > 0.01) {
      boostedVideo.playbackRate = settings.boostRate;
    }
  }, 80);
}

function boostOff() {
  if (!isBoosting) return;
  if (boostedVideo) boostedVideo.playbackRate = prevRate;
  if (boostTimer) {
    window.clearInterval(boostTimer);
    boostTimer = null;
  }
  boostedVideo = null;
  isBoosting = false;
}

/* ---------- speed control ---------- */

function flashHud() {
  if (!hudEl) return;
  hudEl.classList.remove("__vsc-hud--flash");
  /* force reflow so re-adding the class restarts the animation */
  void hudEl.offsetWidth;
  hudEl.classList.add("__vsc-hud--flash");
}

function adjustPlaybackRate(delta) {
  const v = getVideo();
  if (!v) return;
  const nextRate = Math.min(16, Math.max(0.1, v.playbackRate + delta));
  v.playbackRate = nextRate;
  flashHud();
}

function resetPlaybackRate() {
  boostOff();
  const v = getVideo();
  if (!v) return;
  v.playbackRate = 1;
  flashHud();
}

/* ---------- HUD ---------- */

const HUD_CSS = `
.__vsc-hud {
  position: fixed;
  z-index: 2147483647;
  background: rgba(15, 23, 42, 0.32);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 10px;
  padding: 4px 6px;
  color: #ffffff;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  min-width: 64px;
  user-select: none;
  box-sizing: border-box;
  text-align: center;
  cursor: move;
  transition: background 0.15s ease;
}
.__vsc-hud__value {
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
}
@keyframes __vsc-flash {
  0%   { background: rgba(59, 130, 246, 0.55); }
  100% { background: rgba(15, 23, 42, 0.32); }
}
.__vsc-hud--flash {
  animation: __vsc-flash 0.3s ease-out;
}
`;

function injectHudStyles() {
  const style = document.createElement("style");
  style.textContent = HUD_CSS;
  (document.head || document.documentElement).appendChild(style);
}

function applyHudPosition() {
  if (!hudEl) return;
  const v = getVideo();
  if (!v) {
    hudEl.style.display = "none";
    return;
  }

  const rect = v.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0 || !isVideoVisible(v)) {
    hudEl.style.display = "none";
    return;
  }

  hudEl.style.display = "block";

  const maxX = Math.max(0, rect.width - hudEl.offsetWidth);
  const maxY = Math.max(0, rect.height - hudEl.offsetHeight);

  settings.hudX = Math.min(maxX, Math.max(0, settings.hudX));
  settings.hudY = Math.min(maxY, Math.max(0, settings.hudY));

  hudEl.style.left = `${rect.left + settings.hudX}px`;
  hudEl.style.top = `${rect.top + settings.hudY}px`;
}

function updateHudValue() {
  if (!hudValueEl) return;
  const v = getVideo();
  const rate = v ? v.playbackRate : 1;
  hudValueEl.textContent = rate.toFixed(2);
}

function createHud() {
  if (hudEl) return;

  injectHudStyles();

  hudEl = document.createElement("div");
  hudEl.className = "__vsc-hud";

  hudValueEl = document.createElement("div");
  hudValueEl.className = "__vsc-hud__value";

  let dragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  hudEl.addEventListener("mousedown", (e) => {
    const v = getVideo();
    if (!v) return;
    const rect = v.getBoundingClientRect();

    dragging = true;
    dragOffsetX = e.clientX - (rect.left + settings.hudX);
    dragOffsetY = e.clientY - (rect.top + settings.hudY);
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const v = getVideo();
    if (!v) return;
    const rect = v.getBoundingClientRect();
    const localX = e.clientX - rect.left - dragOffsetX;
    const localY = e.clientY - rect.top - dragOffsetY;
    const maxX = Math.max(0, rect.width - hudEl.offsetWidth);
    const maxY = Math.max(0, rect.height - hudEl.offsetHeight);

    settings.hudX = Math.min(maxX, Math.max(0, localX));
    settings.hudY = Math.min(maxY, Math.max(0, localY));
    applyHudPosition();
  });

  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    chrome.storage.sync.set({ hudX: settings.hudX, hudY: settings.hudY });
  });

  hudEl.addEventListener("animationend", () => {
    hudEl.classList.remove("__vsc-hud--flash");
  });

  hudEl.appendChild(hudValueEl);
  document.documentElement.appendChild(hudEl);
  applyHudPosition();
  updateHudValue();
}

/* ---------- keyboard ---------- */

function handleKeyDown(e) {
  if (isTypingTarget(e.target)) return;

  if (e.code === settings.holdKeyCode) {
    if (e.repeat) return;
    boostOn();
    return;
  }

  if (e.repeat) return;
  if (e.code === settings.increaseKeyCode) {
    adjustPlaybackRate(settings.speedStep);
    return;
  }

  if (e.code === settings.decreaseKeyCode) {
    adjustPlaybackRate(-settings.speedStep);
    return;
  }

  if (e.code === settings.resetKeyCode) {
    resetPlaybackRate();
  }
}

function handleKeyUp(e) {
  if (e.code !== settings.holdKeyCode) return;
  boostOff();
}

window.addEventListener("keydown", handleKeyDown, true);
window.addEventListener("keyup", handleKeyUp, true);

/* ---------- event-driven HUD positioning ---------- */

window.addEventListener("blur", boostOff);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) boostOff();
});
window.addEventListener("scroll", applyHudPosition, true);
window.addEventListener("resize", applyHudPosition);

/* ---------- storage sync ---------- */

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;

  if (changes.holdKeyCode) {
    const key = changes.holdKeyCode.newValue;
    settings.holdKeyCode = key || DEFAULT_SETTINGS.holdKeyCode;
  }

  if (changes.boostRate) {
    settings.boostRate = parseSettingNumber(
      changes.boostRate.newValue,
      DEFAULT_SETTINGS.boostRate,
      0.1,
      16
    );
  }

  if (changes.increaseKeyCode) {
    const key = changes.increaseKeyCode.newValue;
    settings.increaseKeyCode = key || DEFAULT_SETTINGS.increaseKeyCode;
  }

  if (changes.decreaseKeyCode) {
    const key = changes.decreaseKeyCode.newValue;
    settings.decreaseKeyCode = key || DEFAULT_SETTINGS.decreaseKeyCode;
  }

  if (changes.resetKeyCode) {
    const key = changes.resetKeyCode.newValue;
    settings.resetKeyCode = key || DEFAULT_SETTINGS.resetKeyCode;
  }

  if (changes.speedStep) {
    settings.speedStep = parseSettingNumber(
      changes.speedStep.newValue,
      DEFAULT_SETTINGS.speedStep,
      0.1,
      4
    );
  }

  if (changes.hudX) {
    settings.hudX = parseSettingNumber(changes.hudX.newValue, DEFAULT_SETTINGS.hudX, 0, 100000);
    applyHudPosition();
  }

  if (changes.hudY) {
    settings.hudY = parseSettingNumber(changes.hudY.newValue, DEFAULT_SETTINGS.hudY, 0, 100000);
    applyHudPosition();
  }

  boostOff();
  updateHudValue();
});

chrome.runtime.onMessage.addListener((message) => {
  if (!message || message.type !== "RESET_SPEED_NOW") return;
  resetPlaybackRate();
});

/* ---------- init ---------- */

createHud();
registerVideoTracking();
rebuildVideoCache();
attachVideoListeners();
loadSettings();

videoCacheObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

/* lightweight safety-net poll (every 2s instead of 300ms) */
setInterval(() => {
  updateHudValue();
  applyHudPosition();
}, 2000);
