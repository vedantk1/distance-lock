const enableToggle = document.getElementById("enableToggle");
const calibrateBtn = document.getElementById("calibrateBtn");
const pauseVideoToggle = document.getElementById("pauseVideoToggle");
const sensitivity = document.getElementById("sensitivity");
const sensitivityValue = document.getElementById("sensitivityValue");
const statusEl = document.getElementById("status");
const cameraStatusEl = document.getElementById("cameraStatus");
const calibStatusEl = document.getElementById("calibStatus");
const statePill = document.getElementById("statePill");
const scaleValue = document.getElementById("scaleValue");
const ratioValue = document.getElementById("ratioValue");
const lightValue = document.getElementById("lightValue");
const cameraHelp = document.getElementById("cameraHelp");
const requestPermissionBtn = document.getElementById("requestPermissionBtn");

const port = chrome.runtime.connect({ name: "inverse-lean-zoom-popup" });
let cameraActive = false;
let cameraError = null;
let lowLight = false;
let lastScale = null;
let lastRatio = null;
let lastState = "disabled";
let currentSettings = {};

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
    }
    if (message.cameraError !== undefined) {
      cameraError = message.cameraError;
    }
    if (typeof message.lowLight === "boolean") {
      lowLight = message.lowLight;
    }
    updateStatusUi();
    return;
  }

  if (message.type === "scale-update") {
    if (typeof message.scale === "number") {
      lastScale = message.scale;
    }
    if (typeof message.ratio === "number") {
      lastRatio = message.ratio;
    }
    if (message.state) {
      lastState = message.state;
    }
    updateStatusUi();
    return;
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

  requestPermissionBtn.addEventListener("click", async () => {
    // Open permission page in a new tab to request camera access
    await chrome.runtime.sendMessage({ type: "request-permission" });
    status("Opening permission page...");
  });
}

async function getSettings() {
  const response = await chrome.runtime.sendMessage({
    type: "settings-update",
    settings: {},
  });
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

  currentSettings = settings;
  enableToggle.checked = Boolean(settings.enabled);
  pauseVideoToggle.checked = Boolean(settings.pauseVideoOnLean);
  if (typeof settings.k === "number") {
    sensitivity.value = String(settings.k);
    sensitivityValue.textContent = settings.k.toFixed(2);
  }
  calibStatusEl.textContent = settings.baseline ? "Yes" : "No";
  updateStatusUi();

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

  if (cameraError && cameraError.code === "permission") {
    cameraStatusEl.textContent = "Permission denied";
    cameraHelp.style.display = "block";
    status("Allow camera access");
    return;
  }

  if (cameraError && cameraError.code === "no-camera") {
    cameraStatusEl.textContent = "No camera";
    cameraHelp.style.display = "none";
    status("No camera detected");
    return;
  }

  if (cameraError && cameraError.code === "in-use") {
    cameraStatusEl.textContent = "In use";
    cameraHelp.style.display = "none";
    status("Camera busy");
    return;
  }

  cameraHelp.style.display = "none";
  cameraStatusEl.textContent = cameraActive ? "On" : "Starting…";
}

function updateStatusUi() {
  updateCameraStatus();
  updateLightingStatus();
  updateStatePill();
  updateScaleValues();
}

function updateLightingStatus() {
  lightValue.textContent = !enableToggle.checked
    ? "—"
    : lowLight
      ? "Low"
      : "OK";
}

function updateStatePill() {
  const enabled = enableToggle.checked;
  const calibrated = Boolean(currentSettings.baseline);
  let label = "Disabled";
  let kind = "";

  if (!enabled) {
    label = "Disabled";
    kind = "";
  } else if (cameraError && cameraError.code === "permission") {
    label = "Camera blocked";
    kind = "bad";
  } else if (cameraError && cameraError.code === "no-camera") {
    label = "No camera";
    kind = "bad";
  } else if (cameraError && cameraError.code === "in-use") {
    label = "Camera busy";
    kind = "warn";
  } else if (!calibrated || lastState === "uncalibrated") {
    label = "Needs calibration";
    kind = "warn";
  } else if (lastState === "too-close") {
    label = "Too close";
    kind = "bad";
  } else if (lastState === "no-face") {
    label = "No face";
    kind = "warn";
  } else if (lastState === "low-light" || lowLight) {
    label = "Low light";
    kind = "warn";
  } else {
    label = "Neutral";
    kind = "ok";
  }

  statePill.textContent = label;
  statePill.className = `pill ${kind}`.trim();
}

function updateScaleValues() {
  if (!enableToggle.checked) {
    scaleValue.textContent = "—";
    ratioValue.textContent = "—";
    return;
  }

  if (typeof lastScale === "number") {
    scaleValue.textContent = `${lastScale.toFixed(2)}x`;
  } else {
    scaleValue.textContent = "—";
  }

  if (typeof lastRatio === "number") {
    ratioValue.textContent = `${lastRatio.toFixed(2)}x`;
  } else {
    ratioValue.textContent = "—";
  }
}
