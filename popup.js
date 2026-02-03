const enableToggle = document.getElementById("enableToggle");
const calibrateBtn = document.getElementById("calibrateBtn");
const sensitivity = document.getElementById("sensitivity");
const statusEl = document.getElementById("status");

init();

async function init() {
  const settings = await getSettings();
  syncUi(settings);

  enableToggle.addEventListener("change", async () => {
    const next = await updateSettings({ enabled: enableToggle.checked });
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
  if (typeof settings.k === "number") {
    sensitivity.value = String(settings.k);
  }

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
