const ports = new Set();

chrome.runtime.onConnect.addListener((port) => {
  ports.add(port);
  port.onDisconnect.addListener(() => ports.delete(port));
});

chrome.runtime.onMessage.addListener((message) => {
  if (!message || message.type !== "scale-update") {
    return;
  }

  for (const port of ports) {
    port.postMessage(message);
  }
});
