const DEFAULTS = {
  holdKeyCode: "Backslash",
  boostRate: 3,
  increaseKeyCode: "BracketRight",
  decreaseKeyCode: "BracketLeft",
  resetKeyCode: "Backquote",
  speedStep: 0.25,
};

const holdKeyDisplay = document.getElementById("holdKeyDisplay");
const increaseKeyDisplay = document.getElementById("increaseKeyDisplay");
const decreaseKeyDisplay = document.getElementById("decreaseKeyDisplay");
const resetKeyDisplay = document.getElementById("resetKeyDisplay");
const boostSpeedInput = document.getElementById("boostSpeedInput");
const stepInput = document.getElementById("stepInput");
const captureHoldBtn = document.getElementById("captureHoldBtn");
const captureIncreaseBtn = document.getElementById("captureIncreaseBtn");
const captureDecreaseBtn = document.getElementById("captureDecreaseBtn");
const captureResetBtn = document.getElementById("captureResetBtn");
const saveBtn = document.getElementById("saveBtn");
const resetNowBtn = document.getElementById("resetNowBtn");
const statusEl = document.getElementById("status");

let pendingCaptureTarget = "";
let selectedKeys = {
  holdKeyCode: DEFAULTS.holdKeyCode,
  increaseKeyCode: DEFAULTS.increaseKeyCode,
  decreaseKeyCode: DEFAULTS.decreaseKeyCode,
  resetKeyCode: DEFAULTS.resetKeyCode,
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
}

function parseNumberInRange(raw, min, max) {
  const val = Number.parseFloat(raw);
  if (!Number.isFinite(val)) return null;
  if (val < min || val > max) return null;
  return val;
}

function loadSettings() {
  chrome.storage.sync.get(DEFAULTS, (data) => {
    selectedKeys = {
      holdKeyCode: data.holdKeyCode || DEFAULTS.holdKeyCode,
      increaseKeyCode: data.increaseKeyCode || DEFAULTS.increaseKeyCode,
      decreaseKeyCode: data.decreaseKeyCode || DEFAULTS.decreaseKeyCode,
      resetKeyCode: data.resetKeyCode || DEFAULTS.resetKeyCode,
    };
    renderKeyLabels();
    boostSpeedInput.value = String(data.boostRate || DEFAULTS.boostRate);
    stepInput.value = String(data.speedStep || DEFAULTS.speedStep);
  });
}

function saveSettings() {
  const boostRate = parseNumberInRange(boostSpeedInput.value, 0.1, 16);
  const speedStep = parseNumberInRange(stepInput.value, 0.1, 4);

  if (
    !selectedKeys.holdKeyCode ||
    !selectedKeys.increaseKeyCode ||
    !selectedKeys.decreaseKeyCode ||
    !selectedKeys.resetKeyCode
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

  chrome.storage.sync.set(
    {
      holdKeyCode: selectedKeys.holdKeyCode,
      boostRate,
      increaseKeyCode: selectedKeys.increaseKeyCode,
      decreaseKeyCode: selectedKeys.decreaseKeyCode,
      resetKeyCode: selectedKeys.resetKeyCode,
      speedStep,
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

captureHoldBtn.addEventListener("click", () => startCapture("holdKeyCode"));
captureIncreaseBtn.addEventListener("click", () => startCapture("increaseKeyCode"));
captureDecreaseBtn.addEventListener("click", () => startCapture("decreaseKeyCode"));
captureResetBtn.addEventListener("click", () => startCapture("resetKeyCode"));

window.addEventListener("keydown", (e) => {
  if (!pendingCaptureTarget) return;

  e.preventDefault();
  e.stopPropagation();

  selectedKeys[pendingCaptureTarget] = e.code;
  pendingCaptureTarget = "";
  renderKeyLabels();
  setStatus(`Captured: ${e.code}`);
});

saveBtn.addEventListener("click", saveSettings);

resetNowBtn.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0] && tabs[0].id;
    if (!tabId) {
      setStatus("No active tab found.", true);
      return;
    }

    chrome.tabs.sendMessage(tabId, { type: "RESET_SPEED_NOW" }, () => {
      if (chrome.runtime.lastError) {
        setStatus("Open a tab with a video first.", true);
        return;
      }
      setStatus("Reset to 1x.");
    });
  });
});

loadSettings();
