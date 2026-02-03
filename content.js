const port = chrome.runtime.connect({ name: "inverse-lean-zoom" });

port.onMessage.addListener((message) => {
  if (!message || message.type !== "scale-update") {
    return;
  }

  if (typeof message.scale !== "number") {
    return;
  }

  document.documentElement.style.transform = `scale(${message.scale})`;
  document.documentElement.style.transformOrigin = "center top";
});
