const port = chrome.runtime.connect({ name: "inverse-lean-zoom" });
let enabled = false;
let currentScale = 1;
let pauseVideoOnLean = true;
let lastState = "ok";
const pausedVideos = new Set();

const hud = createHud();

port.onMessage.addListener((message) => {
  if (!message || typeof message.type !== "string") {
    return;
  }

  if (message.type === "settings") {
    enabled = Boolean(message.settings?.enabled);
    pauseVideoOnLean = Boolean(message.settings?.pauseVideoOnLean);
    if (!enabled) {
      resetScale();
    }
    return;
  }

  if (message.type === "scale-update") {
    if (typeof message.scale !== "number") {
      return;
    }

    if (!enabled) {
      resetScale();
      return;
    }

    applyScale(message.scale);
    updateHud(message);
    handleVideoPause(message.state);
  }
});

function applyScale(scale) {
  currentScale = scale;
  document.documentElement.style.transform = `scale(${scale})`;
  document.documentElement.style.transformOrigin = "center top";
}

function resetScale() {
  currentScale = 1;
  document.documentElement.style.transform = "";
  document.documentElement.style.transformOrigin = "";
  updateHud({ state: "disabled" });
}

function createHud() {
  const el = document.createElement("div");
  el.id = "ilz-hud";
  el.hidden = true;
  el.textContent = "Inverse Lean Zoom";
  document.documentElement.appendChild(el);
  return el;
}

function updateHud(message) {
  const state = message.state || "ok";
  if (state === "disabled") {
    hud.hidden = true;
    return;
  }

  hud.hidden = false;
  hud.dataset.state = state;

  if (state === "too-close") {
    hud.textContent = "Lean detected → zooming out";
  } else if (state === "low-light") {
    hud.textContent = "Lighting too low";
  } else if (state === "no-face") {
    hud.textContent = "No face detected";
  } else if (state === "uncalibrated") {
    hud.textContent = "Calibrate to start";
  } else {
    hud.textContent = `Neutral posture (${currentScale.toFixed(2)}x)`;
  }
}

function handleVideoPause(state) {
  const nextState = state || "ok";

  if (!pauseVideoOnLean) {
    lastState = nextState;
    return;
  }

  if (nextState === "too-close") {
    const videos = document.querySelectorAll("video");
    videos.forEach((video) => {
      if (!video.paused && !video.ended) {
        try {
          video.pause();
          pausedVideos.add(video);
        } catch (error) {
          // Ignore playback errors.
        }
      }
    });
  } else if (lastState === "too-close" && nextState !== "too-close") {
    pausedVideos.forEach((video) => {
      if (video.paused && !video.ended) {
        video.play().catch(() => {});
      }
    });
    pausedVideos.clear();
  }

  lastState = nextState;
}
