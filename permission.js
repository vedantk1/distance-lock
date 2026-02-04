const grantBtn = document.getElementById("grantBtn");
const statusEl = document.getElementById("status");

grantBtn.addEventListener("click", async () => {
  grantBtn.disabled = true;
  grantBtn.textContent = "Requesting...";

  try {
    // Request camera permission - this will show the browser prompt
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });

    // Permission granted! Stop the stream immediately
    stream.getTracks().forEach((track) => track.stop());

    // Show success message
    statusEl.className = "status success";
    statusEl.textContent =
      "✓ Camera access granted! You can close this tab now.";
    grantBtn.textContent = "Permission Granted";

    // Notify background script that permission was granted
    chrome.runtime.sendMessage({ type: "permission-granted" });

    // Auto-close after 2 seconds
    setTimeout(() => {
      window.close();
    }, 2000);
  } catch (error) {
    console.error("Camera permission error:", error);

    statusEl.className = "status error";

    if (error.name === "NotAllowedError") {
      statusEl.textContent =
        "Camera access was denied. Please click the camera icon in your address bar to allow access, then try again.";
    } else if (error.name === "NotFoundError") {
      statusEl.textContent =
        "No camera found. Please connect a camera and try again.";
    } else if (error.name === "NotReadableError") {
      statusEl.textContent =
        "Camera is in use by another application. Please close it and try again.";
    } else {
      statusEl.textContent = `Error: ${error.message}`;
    }

    grantBtn.disabled = false;
    grantBtn.textContent = "Try Again";
  }
});

// Check if permission is already granted
async function checkExistingPermission() {
  try {
    const result = await navigator.permissions.query({ name: "camera" });
    if (result.state === "granted") {
      statusEl.className = "status success";
      statusEl.textContent =
        "✓ Camera access already granted! You can close this tab.";
      grantBtn.textContent = "Already Granted";
      grantBtn.disabled = true;

      // Notify and auto-close
      chrome.runtime.sendMessage({ type: "permission-granted" });
      setTimeout(() => window.close(), 1500);
    }
  } catch (e) {
    // permissions.query may not be supported for camera in all browsers
    console.log("Could not query camera permission:", e);
  }
}

checkExistingPermission();
