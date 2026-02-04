const enableToggle = document.getElementById("enableToggle");
const calibrateBtn = document.getElementById("calibrateBtn");
const pauseVideoToggle = document.getElementById("pauseVideoToggle");
const sensitivity = document.getElementById("sensitivity");
const statusEl = document.getElementById("status");
const cameraStatusEl = document.getElementById("cameraStatus");
const calibStatusEl = document.getElementById("calibStatus");

const port = chrome.runtime.connect({ name: "inverse-lean-zoom-popup" });
let cameraActive = false;

port.onMessage.addListener((message) => {
  if (!message || typeof message.type !== "string") {
    return;
  }

  if (message.type === "settings") {
    syncUi(message.settings);
    return;
  }

  if (message.type === "status-update") {
    if (typeof message.cameraActive === "boolean") {
      cameraActive = message.cameraActive;
      updateCameraStatus();
    }
  }
});

init();

async function init() {
  const settings = await getSettings();
  syncUi(settings);

  enableToggle.addEventListener("change", async () => {
    const next = await updateSettings({ enabled: enableToggle.checked });
    syncUi(next);
  });

  pauseVideoToggle.addEventListener("change", async () => {
    const next = await updateSettings({
      pauseVideoOnLean: pauseVideoToggle.checked,
    });
    syncUi(next);
  });

  sensitivity.addEventListener("input", async () => {
    const k = Number.parseFloat(sensitivity.value);
    const next = await updateSettings({ k });
    syncUi(next, true);
  });

  calibrateBtn.addEventListener("click", async () => {
    status("Calibrating…");
    await chrome.runtime.sendMessage({ type: "calibrate" });
    status("Baseline captured");
  });
}

async function getSettings() {
  const response = await chrome.runtime.sendMessage({ type: "settings-update", settings: {} });
  return response?.settings ?? {};
}

async function updateSettings(partial) {
  const response = await chrome.runtime.sendMessage({
    type: "settings-update",
    settings: partial,
  });
  return response?.settings ?? {};
}

function syncUi(settings, quiet = false) {
  if (!settings) {
    return;
  }

  enableToggle.checked = Boolean(settings.enabled);
  pauseVideoToggle.checked = Boolean(settings.pauseVideoOnLean);
  if (typeof settings.k === "number") {
    sensitivity.value = String(settings.k);
  }
  calibStatusEl.textContent = settings.baseline ? "Yes" : "No";
  updateCameraStatus();

  if (!quiet) {
    if (!settings.enabled) {
      status("Disabled");
    } else if (!settings.baseline) {
      status("Enabled · Calibrate");
    } else {
      status("Enabled");
    }
  }
}

function status(message) {
  statusEl.textContent = message;
}

function updateCameraStatus() {
  if (!enableToggle.checked) {
    cameraStatusEl.textContent = "Off";
    return;
  }

  cameraStatusEl.textContent = cameraActive ? "On" : "Starting…";
}
