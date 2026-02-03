import { FaceDetector, FilesetResolver } from "./assets/mediapipe/vision_bundle.mjs";

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
};

const state = {
  settings: { ...DEFAULT_SETTINGS },
  detector: null,
  running: false,
  starting: null,
  stream: null,
  video: null,
  canvas: null,
  ctx: null,
  lumaCanvas: null,
  lumaCtx: null,
  intervalId: null,
  lastFaceTs: 0,
  lastLumaCheck: 0,
  lowLight: false,
  smoothSize: null,
  scale: 1,
  tooClose: false,
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== "string") {
    return;
  }

  if (message.type === "settings-update") {
    state.settings = { ...state.settings, ...message.settings };
    if (state.settings.enabled) {
      start().then(() => sendResponse({ ok: true }));
    } else {
      stop().then(() => sendResponse({ ok: true }));
    }
    return true;
  }

  if (message.type === "calibrate") {
    calibrate();
    sendResponse({ ok: true });
    return;
  }
});

init();

async function init() {
  const response = await chrome.runtime.sendMessage({ type: "offscreen-ready" });
  if (response && response.settings) {
    state.settings = { ...state.settings, ...response.settings };
  }

  if (state.settings.enabled) {
    await start();
  }
}

async function start() {
  if (state.running) {
    return;
  }

  if (!state.starting) {
    state.starting = startInternal();
  }

  await state.starting;
  state.starting = null;
}

async function startInternal() {
  await ensureDetector();
  await ensureCamera();
  startLoop();
  state.running = true;
}

async function stop() {
  state.running = false;
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }

  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
    state.stream = null;
  }

  if (state.video) {
    state.video.srcObject = null;
  }

  state.scale = 1;
  state.tooClose = false;
  state.smoothSize = null;
  sendScaleUpdate({ state: "disabled" });
}

async function ensureDetector() {
  if (state.detector) {
    return;
  }

  const wasmRoot = chrome.runtime.getURL("assets/mediapipe/wasm");
  const modelPath = chrome.runtime.getURL(
    "assets/mediapipe/blaze_face_short_range.tflite"
  );

  const vision = await FilesetResolver.forVisionTasks(wasmRoot);
  state.detector = await FaceDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: modelPath,
    },
    runningMode: "VIDEO",
    minDetectionConfidence: 0.5,
    minSuppressionThreshold: 0.3,
  });
}

async function ensureCamera() {
  if (state.stream && state.video) {
    return;
  }

  state.video = document.createElement("video");
  state.video.playsInline = true;
  state.video.muted = true;

  state.canvas = document.createElement("canvas");
  state.ctx = state.canvas.getContext("2d", { willReadFrequently: true });

  state.lumaCanvas = document.createElement("canvas");
  state.lumaCanvas.width = 32;
  state.lumaCanvas.height = 24;
  state.lumaCtx = state.lumaCanvas.getContext("2d", {
    willReadFrequently: true,
  });

  state.stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
    audio: false,
  });

  state.video.srcObject = state.stream;
  await state.video.play();
}

function startLoop() {
  if (state.intervalId) {
    clearInterval(state.intervalId);
  }

  const intervalMs = Math.max(1000 / state.settings.targetFps, 16);
  state.intervalId = setInterval(processFrame, intervalMs);
}

function processFrame() {
  if (!state.running || !state.detector || !state.video) {
    return;
  }

  if (state.video.readyState < 2) {
    return;
  }

  const now = performance.now();
  updateLighting(now);

  if (state.lowLight) {
    easeToScale(1, "low-light", null);
    return;
  }

  const results = state.detector.detectForVideo(state.video, now);
  const detections = results?.detections ?? results ?? [];
  const faceWidth = getLargestFaceWidth(detections);

  if (!faceWidth) {
    handleNoFace(now);
    return;
  }

  state.lastFaceTs = now;
  updateScale(faceWidth);
}

function updateLighting(now) {
  if (!state.lumaCtx || !state.video) {
    return;
  }

  if (now - state.lastLumaCheck < 500) {
    return;
  }

  state.lastLumaCheck = now;
  const { lumaCanvas, lumaCtx, video } = state;
  lumaCtx.drawImage(video, 0, 0, lumaCanvas.width, lumaCanvas.height);
  const frame = lumaCtx.getImageData(0, 0, lumaCanvas.width, lumaCanvas.height);
  const avgLuma = averageLuma(frame.data);
  state.lowLight = avgLuma < state.settings.lowLightLumaMin;
}

function averageLuma(data) {
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    total += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }
  return total / (data.length / 4);
}

function handleNoFace(now) {
  if (now - state.lastFaceTs > state.settings.noFaceResetMs) {
    easeToScale(1, "no-face", null);
  } else {
    sendScaleUpdate({ state: "no-face" });
  }
}

function updateScale(size) {
  const { settings } = state;
  if (!settings.baseline) {
    easeToScale(1, "uncalibrated", null);
    return;
  }

  if (state.smoothSize === null) {
    state.smoothSize = size;
  } else {
    state.smoothSize =
      settings.alpha * size + (1 - settings.alpha) * state.smoothSize;
  }

  const r = state.smoothSize / settings.baseline;
  if (state.tooClose) {
    if (r < settings.disengageThreshold) {
      state.tooClose = false;
    }
  } else if (r > settings.engageThreshold) {
    state.tooClose = true;
  }

  let targetScale = 1;
  if (state.tooClose) {
    targetScale = clamp(1 / Math.pow(r, settings.k), settings.minScale, 1);
  }

  easeToScale(targetScale, state.tooClose ? "too-close" : "ok", r);
}

function easeToScale(targetScale, stateLabel, ratio) {
  const step = state.settings.maxScaleStep;
  const next = clamp(
    targetScale,
    state.scale - step,
    state.scale + step
  );
  state.scale = next;
  sendScaleUpdate({ state: stateLabel, ratio });
}

function sendScaleUpdate(extra) {
  chrome.runtime.sendMessage({
    type: "scale-update",
    scale: state.scale,
    ...extra,
  });
}

function calibrate() {
  if (state.smoothSize) {
    state.settings.baseline = state.smoothSize;
    chrome.runtime.sendMessage({
      type: "baseline-update",
      baseline: state.settings.baseline,
    });
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getLargestFaceWidth(detections) {
  let maxWidth = 0;
  for (const detection of detections) {
    const box = detection.boundingBox || detection.bounding_box;
    if (!box) {
      continue;
    }
    const width = box.width ?? box.w ?? 0;
    if (width > maxWidth) {
      maxWidth = width;
    }
  }
  return maxWidth;
}
