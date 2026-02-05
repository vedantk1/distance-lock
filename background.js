const ports = new Set();
const OFFSCREEN_URL = "offscreen.html";
let creatingOffscreen = null;
let lastStatus = {
  cameraActive: false,
  lowLight: false,
  cameraError: null,
};

const DEFAULT_SETTINGS = {
  enabled: false,
  alpha: 0.2,
  k: 1.2,
  minScale: 0.72,
  engageThreshold: 1.12,
  disengageThreshold: 1.06,
  maxScaleStep: 0.04,
  targetFps: 15,
  faceMetric: "bboxWidth",
  noFaceResetMs: 1500,
  lowLightLumaMin: 35,
  baseline: null,
  pauseVideoOnLean: true,
};

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
});

chrome.runtime.onStartup.addListener(async () => {
  const settings = await getSettings();
  if (settings.enabled) {
    await ensureOffscreenDocument();
    await sendSettingsToOffscreen(settings);
  }
});

chrome.runtime.onConnect.addListener(async (port) => {
  ports.add(port);
  port.onDisconnect.addListener(() => ports.delete(port));

  const settings = await getSettings();
  port.postMessage({ type: "settings", settings });
  port.postMessage({ type: "status-update", ...lastStatus });

  if (settings.enabled) {
    await ensureOffscreenDocument();
    await sendSettingsToOffscreen(settings);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== "string") {
    return;
  }

  if (message.type === "scale-update") {
    broadcast(message);
    return;
  }

  if (message.type === "status-update") {
    const nextStatus = { ...lastStatus };
    if (typeof message.cameraActive === "boolean") {
      nextStatus.cameraActive = message.cameraActive;
    }
    if (typeof message.lowLight === "boolean") {
      nextStatus.lowLight = message.lowLight;
    }
    if (message.cameraError !== undefined) {
      nextStatus.cameraError = message.cameraError;
    }
    lastStatus = nextStatus;
    broadcast(message);
    return;
  }

  if (message.type === "offscreen-ready") {
    getSettings().then((settings) => sendResponse({ settings }));
    return true;
  }

  if (message.type === "settings-update") {
    const partial = message.settings || {};
    if (Object.keys(partial).length === 0) {
      getSettings().then((settings) => sendResponse({ settings }));
    } else {
      handleSettingsUpdate(partial).then((settings) =>
        sendResponse({ settings }),
      );
    }
    return true;
  }

  if (message.type === "calibrate") {
    (async () => {
      try {
        await ensureOffscreenDocument();
        // Send calibrate to offscreen and wait for response
        const result = await chrome.runtime.sendMessage({ type: "calibrate" });
        if (result?.ok && typeof result.baseline === "number") {
          // Save baseline to settings
          await handleSettingsUpdate({ baseline: result.baseline });
        }
        sendResponse(
          result || { ok: false, error: "No response from offscreen" },
        );
      } catch (error) {
        console.warn("calibrate failed", error);
        sendResponse({ ok: false, error: error?.message || String(error) });
      }
    })();
    return true;
  }

  if (message.type === "request-permission") {
    // Open the permission page in a new tab to request camera access
    // Offscreen documents cannot show permission prompts
    chrome.tabs.create({
      url: chrome.runtime.getURL("permission.html"),
      active: true,
    });
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "permission-granted") {
    // Permission was granted from the permission page
    // If extension was waiting to be enabled, retry now
    getSettings().then(async (settings) => {
      if (settings.enabled) {
        await ensureOffscreenDocument();
        await sendSettingsToOffscreen(settings, true);
      }
    });
    sendResponse({ ok: true });
    return true;
  }
});

async function handleSettingsUpdate(partial) {
  const current = await getSettings();
  const next = { ...current, ...partial };
  await chrome.storage.local.set({ settings: next });

  broadcast({ type: "settings", settings: next });

  if (next.enabled) {
    await ensureOffscreenDocument();
    await sendSettingsToOffscreen(next, true);
    // Inject content script into tabs that don't have it yet
    if (!current.enabled && next.enabled) {
      await injectContentScriptIntoTabs();
    }
  } else {
    lastStatus = { ...lastStatus, cameraActive: false, cameraError: null };
    broadcast({ type: "status-update", ...lastStatus });
    await sendSettingsToOffscreen(next, false);
    await closeOffscreenDocument();
  }

  return next;
}

async function injectContentScriptIntoTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      // Skip chrome:// and other restricted URLs
      if (
        !tab.url ||
        tab.url.startsWith("chrome://") ||
        tab.url.startsWith("chrome-extension://") ||
        tab.url.startsWith("about:")
      ) {
        continue;
      }
      try {
        // Check if content script is already injected by looking for our port
        // If not connected, inject the script
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"],
        });
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ["content.css"],
        });
      } catch (e) {
        // Tab may not allow script injection (e.g., chrome web store)
        console.debug("Could not inject into tab", tab.id, e.message);
      }
    }
  } catch (e) {
    console.warn("Failed to inject content scripts:", e);
  }
}

async function getSettings() {
  const stored = await chrome.storage.local.get("settings");
  return { ...DEFAULT_SETTINGS, ...(stored.settings || {}) };
}

function broadcast(message) {
  for (const port of ports) {
    port.postMessage(message);
  }
}

async function sendSettingsToOffscreen(settings, ensure = true) {
  if (ensure) {
    await ensureOffscreenDocument();
  } else if (!(await hasOffscreenDocument())) {
    return;
  }

  chrome.runtime.sendMessage({ type: "settings-update", settings });
}

async function ensureOffscreenDocument() {
  if (await hasOffscreenDocument()) {
    return;
  }

  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ["USER_MEDIA"],
    justification:
      "Capture webcam frames for on-device face distance estimation.",
  });

  await creatingOffscreen;
  creatingOffscreen = null;
}

async function closeOffscreenDocument() {
  if (!(await hasOffscreenDocument())) {
    return;
  }

  await chrome.offscreen.closeDocument();
}

async function hasOffscreenDocument() {
  if (chrome.offscreen && chrome.offscreen.hasDocument) {
    try {
      return await chrome.offscreen.hasDocument();
    } catch (error) {
      console.warn("offscreen.hasDocument failed", error);
    }
  }

  if (!chrome.runtime.getContexts) {
    return false;
  }

  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)],
  });

  return contexts.length > 0;
}
