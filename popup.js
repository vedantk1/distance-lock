const enableToggle = document.getElementById("enableToggle");
const calibrateBtn = document.getElementById("calibrateBtn");
const pauseVideoToggle = document.getElementById("pauseVideoToggle");
const soundToggle = document.getElementById("soundToggle");
const soundVolumeInput = document.getElementById("soundVolume");
const soundVolumeValue = document.getElementById("soundVolumeValue");
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

// Advanced settings elements
const advancedToggle = document.getElementById("advancedToggle");
const advancedArrow = document.getElementById("advancedArrow");
const advancedPanel = document.getElementById("advancedPanel");
const minScaleInput = document.getElementById("minScale");
const minScaleValue = document.getElementById("minScaleValue");
const engageThresholdInput = document.getElementById("engageThreshold");
const engageThresholdValue = document.getElementById("engageThresholdValue");
const maxScaleStepInput = document.getElementById("maxScaleStep");
const maxScaleStepValue = document.getElementById("maxScaleStepValue");
const noFaceResetMsInput = document.getElementById("noFaceResetMs");
const noFaceResetMsValue = document.getElementById("noFaceResetMsValue");
const lowLightLumaMinInput = document.getElementById("lowLightLumaMin");
const lowLightLumaMinValue = document.getElementById("lowLightLumaMinValue");
const resetAdvancedBtn = document.getElementById("resetAdvanced");

const ADVANCED_DEFAULTS = {
  minScale: 0.72,
  engageThreshold: 1.12,
  maxScaleStep: 0.04,
  noFaceResetMs: 1500,
  lowLightLumaMin: 35,
};

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

  soundToggle.addEventListener("change", async () => {
    const next = await updateSettings({
      soundEnabled: soundToggle.checked,
    });
    syncUi(next, true);
  });

  soundVolumeInput.addEventListener("input", async () => {
    const soundVolume = Number.parseFloat(soundVolumeInput.value);
    soundVolumeValue.textContent = `${Math.round(soundVolume * 100)}%`;
    const next = await updateSettings({ soundVolume });
    syncUi(next, true);
  });

  sensitivity.addEventListener("input", async () => {
    const k = Number.parseFloat(sensitivity.value);
    const next = await updateSettings({ k });
    syncUi(next, true);
  });

  calibrateBtn.addEventListener("click", async () => {
    status("Calibrating…");
    calibrateBtn.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage({ type: "calibrate" });
      if (response?.ok) {
        status("Calibrated!");
        // Refresh settings to update UI
        const settings = await getSettings();
        syncUi(settings);
      } else {
        status(response?.error || "Calibration failed");
      }
    } catch (error) {
      status("Calibration failed: " + error.message);
    } finally {
      calibrateBtn.disabled = false;
    }
  });

  requestPermissionBtn.addEventListener("click", async () => {
    // Open permission page in a new tab to request camera access
    await chrome.runtime.sendMessage({ type: "request-permission" });
    status("Opening permission page...");
  });

  // Advanced settings toggle
  advancedToggle.addEventListener("click", () => {
    const isOpen = advancedPanel.style.display !== "none";
    advancedPanel.style.display = isOpen ? "none" : "grid";
    advancedArrow.classList.toggle("open", !isOpen);
  });

  // Advanced settings sliders
  minScaleInput.addEventListener("input", async () => {
    const minScale = Number.parseFloat(minScaleInput.value);
    minScaleValue.textContent = `${Math.round(minScale * 100)}%`;
    await updateSettings({ minScale });
  });

  engageThresholdInput.addEventListener("input", async () => {
    const engageThreshold = Number.parseFloat(engageThresholdInput.value);
    engageThresholdValue.textContent = `${engageThreshold.toFixed(2)}x`;
    // Auto-calculate disengage threshold (slightly lower)
    const disengageThreshold = Math.max(1.01, engageThreshold - 0.06);
    await updateSettings({ engageThreshold, disengageThreshold });
  });

  maxScaleStepInput.addEventListener("input", async () => {
    const maxScaleStep = Number.parseFloat(maxScaleStepInput.value);
    maxScaleStepValue.textContent = `${Math.round(maxScaleStep * 100)}%`;
    await updateSettings({ maxScaleStep });
  });

  noFaceResetMsInput.addEventListener("input", async () => {
    const noFaceResetMs = Number.parseInt(noFaceResetMsInput.value, 10);
    noFaceResetMsValue.textContent = `${(noFaceResetMs / 1000).toFixed(1)}s`;
    await updateSettings({ noFaceResetMs });
  });

  lowLightLumaMinInput.addEventListener("input", async () => {
    const lowLightLumaMin = Number.parseInt(lowLightLumaMinInput.value, 10);
    lowLightLumaMinValue.textContent = String(lowLightLumaMin);
    await updateSettings({ lowLightLumaMin });
  });

  // Reset advanced settings
  resetAdvancedBtn.addEventListener("click", async () => {
    const disengageThreshold = ADVANCED_DEFAULTS.engageThreshold - 0.06;
    await updateSettings({ ...ADVANCED_DEFAULTS, disengageThreshold });
    const settings = await getSettings();
    syncUi(settings);
    status("Advanced settings reset");
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
  soundToggle.checked = settings.soundEnabled !== false;
  if (typeof settings.soundVolume === "number") {
    soundVolumeInput.value = String(settings.soundVolume);
    soundVolumeValue.textContent = `${Math.round(settings.soundVolume * 100)}%`;
  }
  soundVolumeInput.disabled = !soundToggle.checked;
  if (typeof settings.k === "number") {
    sensitivity.value = String(settings.k);
    sensitivityValue.textContent = settings.k.toFixed(2);
  }
  calibStatusEl.textContent = settings.baseline ? "Yes" : "No";

  // Sync advanced settings
  if (typeof settings.minScale === "number") {
    minScaleInput.value = String(settings.minScale);
    minScaleValue.textContent = `${Math.round(settings.minScale * 100)}%`;
  }
  if (typeof settings.engageThreshold === "number") {
    engageThresholdInput.value = String(settings.engageThreshold);
    engageThresholdValue.textContent = `${settings.engageThreshold.toFixed(2)}x`;
  }
  if (typeof settings.maxScaleStep === "number") {
    maxScaleStepInput.value = String(settings.maxScaleStep);
    maxScaleStepValue.textContent = `${Math.round(settings.maxScaleStep * 100)}%`;
  }
  if (typeof settings.noFaceResetMs === "number") {
    noFaceResetMsInput.value = String(settings.noFaceResetMs);
    noFaceResetMsValue.textContent = `${(settings.noFaceResetMs / 1000).toFixed(1)}s`;
  }
  if (typeof settings.lowLightLumaMin === "number") {
    lowLightLumaMinInput.value = String(settings.lowLightLumaMin);
    lowLightLumaMinValue.textContent = String(settings.lowLightLumaMin);
  }

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
