const port = chrome.runtime.connect({ name: "inverse-lean-zoom" });
let enabled = false;
let currentScale = 1;

const hud = createHud();

port.onMessage.addListener((message) => {
  if (!message || typeof message.type !== "string") {
    return;
  }

  if (message.type === "settings") {
    enabled = Boolean(message.settings?.enabled);
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
