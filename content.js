/* DEFAULT_SETTINGS is provided by constants.js */

let isBoosting = false;
let boostedVideo = null;
let prevRate = 1;
let boostTimer = null;
let lastSeenVideo = null;
const resetRateMemory = new WeakMap();

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
  for (const v of findVideosDeep(root)) {
    videoCache.add(v);
  }
}

function pruneVideoCache() {
  for (const v of videoCache) {
    if (!v.isConnected) videoCache.delete(v);
  }
  if (lastSeenVideo && !lastSeenVideo.isConnected) {
    lastSeenVideo = null;
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
      seekBackwardKeyCode: data.seekBackwardKeyCode || DEFAULT_SETTINGS.seekBackwardKeyCode,
      seekForwardKeyCode: data.seekForwardKeyCode || DEFAULT_SETTINGS.seekForwardKeyCode,
      speedStep: parseSettingNumber(data.speedStep, DEFAULT_SETTINGS.speedStep, 0.1, 4),
      seekStepSeconds: parseSettingNumber(
        data.seekStepSeconds,
        DEFAULT_SETTINGS.seekStepSeconds,
        1,
        120
      ),
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

function toggleResetPlaybackRate() {
  boostOff();
  const v = getVideo();
  if (!v) return;

  const currentRate = v.playbackRate;
  const isAtOne = Math.abs(currentRate - 1) < 0.01;
  const rememberedRate = resetRateMemory.get(v);

  if (!isAtOne) {
    resetRateMemory.set(v, currentRate);
    v.playbackRate = 1;
    flashHud();
    return;
  }

  if (Number.isFinite(rememberedRate) && Math.abs(rememberedRate - 1) >= 0.01) {
    v.playbackRate = rememberedRate;
  }

  flashHud();
}

function seekBySeconds(deltaSeconds) {
  const v = getVideo();
  if (!v) return false;
  if (!Number.isFinite(deltaSeconds) || deltaSeconds === 0) return false;

  const duration = Number.isFinite(v.duration) ? v.duration : Infinity;
  const nextTime = Math.max(0, Math.min(duration, v.currentTime + deltaSeconds));
  v.currentTime = nextTime;
  return true;
}

/* ---------- HUD ---------- */

// HUD_CSS has been migrated to content.css

function injectHudStyles() {
  // Styles are injected via content.css in manifest.json to avoid inline CSP blocking
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

function consumeShortcutEvent(e) {
  e.preventDefault();
  e.stopPropagation();
}

function handleKeyDown(e) {
  if (isTypingTarget(e.target)) return;

  const code = e.code;

  if (code === settings.holdKeyCode) {
    consumeShortcutEvent(e);
    if (e.repeat) return;
    boostOn();
    return;
  }

  const isManagedShortcut =
    code === settings.increaseKeyCode ||
    code === settings.decreaseKeyCode ||
    code === settings.resetKeyCode ||
    code === settings.seekBackwardKeyCode ||
    code === settings.seekForwardKeyCode;

  if (!isManagedShortcut) return;
  consumeShortcutEvent(e);
  if (e.repeat) return;

  if (code === settings.increaseKeyCode) {
    adjustPlaybackRate(settings.speedStep);
    return;
  }

  if (code === settings.decreaseKeyCode) {
    adjustPlaybackRate(-settings.speedStep);
    return;
  }

  if (code === settings.resetKeyCode) {
    toggleResetPlaybackRate();
    return;
  }

  if (code === settings.seekBackwardKeyCode) {
    seekBySeconds(-settings.seekStepSeconds);
    return;
  }

  if (code === settings.seekForwardKeyCode) {
    seekBySeconds(settings.seekStepSeconds);
  }
}

function handleKeyUp(e) {
  if (isTypingTarget(e.target)) return;
  if (e.code !== settings.holdKeyCode) return;
  consumeShortcutEvent(e);
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

  if (changes.seekBackwardKeyCode) {
    const key = changes.seekBackwardKeyCode.newValue;
    settings.seekBackwardKeyCode = key || DEFAULT_SETTINGS.seekBackwardKeyCode;
  }

  if (changes.seekForwardKeyCode) {
    const key = changes.seekForwardKeyCode.newValue;
    settings.seekForwardKeyCode = key || DEFAULT_SETTINGS.seekForwardKeyCode;
  }

  if (changes.speedStep) {
    settings.speedStep = parseSettingNumber(
      changes.speedStep.newValue,
      DEFAULT_SETTINGS.speedStep,
      0.1,
      4
    );
  }

  if (changes.seekStepSeconds) {
    settings.seekStepSeconds = parseSettingNumber(
      changes.seekStepSeconds.newValue,
      DEFAULT_SETTINGS.seekStepSeconds,
      1,
      120
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
  if (!message) return;

  if (message.type === "RESET_SPEED_NOW") {
    toggleResetPlaybackRate();
    return;
  }

  if (message.type === "SEEK_BY") {
    seekBySeconds(Number(message.delta));
  }
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
