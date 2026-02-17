const DEFAULTS = {
  holdKeyCode: "Backslash",
  boostRate: 3.0,
};

const keyInput = document.getElementById("keyInput");
const speedInput = document.getElementById("speedInput");
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");
const statusEl = document.getElementById("status");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b91c1c" : "#15803d";
}

function parseRate(value) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed <= 0 || parsed > 16) return null;
  return parsed;
}

function loadSettings() {
  chrome.storage.sync.get(DEFAULTS, (data) => {
    keyInput.value = data.holdKeyCode;
    speedInput.value = String(data.boostRate);
  });
}

function saveSettings() {
  const keyCode = keyInput.value.trim();
  const rate = parseRate(speedInput.value);

  if (!keyCode) {
    setStatus("Hold key is required.", true);
    return;
  }

  if (rate === null) {
    setStatus("Boost speed must be a number between 0.1 and 16.", true);
    return;
  }

  chrome.storage.sync.set(
    {
      holdKeyCode: keyCode,
      boostRate: rate,
    },
    () => {
      if (chrome.runtime.lastError) {
        setStatus(chrome.runtime.lastError.message || "Failed to save settings.", true);
        return;
      }
      setStatus("Saved.");
    }
  );
}

function resetDefaults() {
  chrome.storage.sync.set(DEFAULTS, () => {
    if (chrome.runtime.lastError) {
      setStatus(chrome.runtime.lastError.message || "Failed to reset settings.", true);
      return;
    }
    keyInput.value = DEFAULTS.holdKeyCode;
    speedInput.value = String(DEFAULTS.boostRate);
    setStatus("Defaults restored.");
  });
}

saveBtn.addEventListener("click", saveSettings);
resetBtn.addEventListener("click", resetDefaults);

loadSettings();
