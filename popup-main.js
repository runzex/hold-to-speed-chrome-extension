/* DEFAULT_SETTINGS is provided by constants.js */

const holdKeyDisplay = document.getElementById("holdKeyDisplay");
const increaseKeyDisplay = document.getElementById("increaseKeyDisplay");
const decreaseKeyDisplay = document.getElementById("decreaseKeyDisplay");
const resetKeyDisplay = document.getElementById("resetKeyDisplay");
const seekBackKeyDisplay = document.getElementById("seekBackKeyDisplay");
const seekForwardKeyDisplay = document.getElementById("seekForwardKeyDisplay");
const boostSpeedInput = document.getElementById("boostSpeedInput");
const stepInput = document.getElementById("stepInput");
const seekStepInput = document.getElementById("seekStepInput");
const captureHoldBtn = document.getElementById("captureHoldBtn");
const captureIncreaseBtn = document.getElementById("captureIncreaseBtn");
const captureDecreaseBtn = document.getElementById("captureDecreaseBtn");
const captureResetBtn = document.getElementById("captureResetBtn");
const captureSeekBackBtn = document.getElementById("captureSeekBackBtn");
const captureSeekForwardBtn = document.getElementById("captureSeekForwardBtn");
const saveBtn = document.getElementById("saveBtn");
const resetDefaultsBtn = document.getElementById("resetDefaultsBtn");
const statusEl = document.getElementById("status");

let pendingCaptureTarget = "";
let selectedKeys = {
  holdKeyCode: DEFAULT_SETTINGS.holdKeyCode,
  increaseKeyCode: DEFAULT_SETTINGS.increaseKeyCode,
  decreaseKeyCode: DEFAULT_SETTINGS.decreaseKeyCode,
  resetKeyCode: DEFAULT_SETTINGS.resetKeyCode,
  seekBackwardKeyCode: DEFAULT_SETTINGS.seekBackwardKeyCode,
  seekForwardKeyCode: DEFAULT_SETTINGS.seekForwardKeyCode,
};

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b91c1c" : "#15803d";
}

function renderKeyLabels() {
  holdKeyDisplay.value = selectedKeys.holdKeyCode;
  increaseKeyDisplay.value = selectedKeys.increaseKeyCode;
  decreaseKeyDisplay.value = selectedKeys.decreaseKeyCode;
  resetKeyDisplay.value = selectedKeys.resetKeyCode;
  seekBackKeyDisplay.value = selectedKeys.seekBackwardKeyCode;
  seekForwardKeyDisplay.value = selectedKeys.seekForwardKeyCode;
}

function parseNumberInRange(raw, min, max) {
  const val = Number.parseFloat(raw);
  if (!Number.isFinite(val)) return null;
  if (val < min || val > max) return null;
  return val;
}

function loadSettings() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (data) => {
    selectedKeys = {
      holdKeyCode: data.holdKeyCode || DEFAULT_SETTINGS.holdKeyCode,
      increaseKeyCode: data.increaseKeyCode || DEFAULT_SETTINGS.increaseKeyCode,
      decreaseKeyCode: data.decreaseKeyCode || DEFAULT_SETTINGS.decreaseKeyCode,
      resetKeyCode: data.resetKeyCode || DEFAULT_SETTINGS.resetKeyCode,
      seekBackwardKeyCode: data.seekBackwardKeyCode || DEFAULT_SETTINGS.seekBackwardKeyCode,
      seekForwardKeyCode: data.seekForwardKeyCode || DEFAULT_SETTINGS.seekForwardKeyCode,
    };
    renderKeyLabels();
    boostSpeedInput.value = String(data.boostRate || DEFAULT_SETTINGS.boostRate);
    stepInput.value = String(data.speedStep || DEFAULT_SETTINGS.speedStep);
    seekStepInput.value = String(data.seekStepSeconds || DEFAULT_SETTINGS.seekStepSeconds);
  });
}

function saveSettings() {
  const boostRate = parseNumberInRange(boostSpeedInput.value, 0.1, 16);
  const speedStep = parseNumberInRange(stepInput.value, 0.1, 4);
  const seekStepSeconds = parseNumberInRange(seekStepInput.value, 1, 120);

  if (
    !selectedKeys.holdKeyCode ||
    !selectedKeys.increaseKeyCode ||
    !selectedKeys.decreaseKeyCode ||
    !selectedKeys.resetKeyCode ||
    !selectedKeys.seekBackwardKeyCode ||
    !selectedKeys.seekForwardKeyCode
  ) {
    setStatus("Choose a key first.", true);
    return;
  }
  if (boostRate === null) {
    setStatus("Boost speed must be from 0.1 to 16.", true);
    return;
  }
  if (speedStep === null) {
    setStatus("Step must be from 0.1 to 4.", true);
    return;
  }
  if (seekStepSeconds === null) {
    setStatus("Seek step must be from 1 to 120 seconds.", true);
    return;
  }

  chrome.storage.sync.set(
    {
      holdKeyCode: selectedKeys.holdKeyCode,
      boostRate,
      increaseKeyCode: selectedKeys.increaseKeyCode,
      decreaseKeyCode: selectedKeys.decreaseKeyCode,
      resetKeyCode: selectedKeys.resetKeyCode,
      seekBackwardKeyCode: selectedKeys.seekBackwardKeyCode,
      seekForwardKeyCode: selectedKeys.seekForwardKeyCode,
      speedStep,
      seekStepSeconds,
    },
    () => {
      if (chrome.runtime.lastError) {
        setStatus(chrome.runtime.lastError.message || "Failed to save.", true);
        return;
      }
      setStatus("Saved.");
    }
  );
}

function startCapture(target) {
  pendingCaptureTarget = target;
  setStatus("Press any key now...");
}

function bindClick(el, handler) {
  if (!el) return;
  el.addEventListener("click", handler);
}

bindClick(captureHoldBtn, () => startCapture("holdKeyCode"));
bindClick(captureIncreaseBtn, () => startCapture("increaseKeyCode"));
bindClick(captureDecreaseBtn, () => startCapture("decreaseKeyCode"));
bindClick(captureResetBtn, () => startCapture("resetKeyCode"));
bindClick(captureSeekBackBtn, () => startCapture("seekBackwardKeyCode"));
bindClick(captureSeekForwardBtn, () => startCapture("seekForwardKeyCode"));

window.addEventListener("keydown", (e) => {
  if (!pendingCaptureTarget) return;

  e.preventDefault();
  e.stopPropagation();

  selectedKeys[pendingCaptureTarget] = e.code;
  pendingCaptureTarget = "";
  renderKeyLabels();
  setStatus(`Captured: ${e.code}`);
});

bindClick(saveBtn, saveSettings);

bindClick(resetDefaultsBtn, () => {
  chrome.storage.sync.set({ ...DEFAULT_SETTINGS }, () => {
    if (chrome.runtime.lastError) {
      setStatus(chrome.runtime.lastError.message || "Failed to reset defaults.", true);
      return;
    }
    loadSettings();
    setStatus("Defaults restored.");
  });
});

loadSettings();
