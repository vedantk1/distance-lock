# Inverse Lean Zoom (Chrome Extension)

Local-only extension that shrinks the page when you lean in.

## Privacy & Security

**🔒 100% Local Processing**

- All face detection runs on your device using MediaPipe WASM
- No images or data are ever sent to external servers
- No analytics, tracking, or telemetry
- Camera stream never leaves your browser

**Permissions Explained:**

- `storage`: Save your calibration baseline and preferences locally
- `offscreen`: Isolated camera access for face detection
- `<all_urls>`: Required to apply zoom effect on all websites you visit

For security details, see [SECURITY_AUDIT.md](SECURITY_AUDIT.md).

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this folder.

## First run

1. Click the extension icon.
2. Toggle **Enable**.
3. Click **Calibrate** while sitting at a comfortable distance.

## Controls

- **Sensitivity**: adjusts aggressiveness.
- **Pause Video On Lean**: pauses playing videos when you lean in.
- **Sound FX**: subtle local boing/snap cues for lean-in and max zoom-out.
- **Sound Volume**: controls cue loudness.

## Notes

- All processing is local (MediaPipe WASM + model bundled in `assets/`).
- If the camera indicator stays on “Starting…”, check camera permissions for the extension.

## File layout

- `manifest.json`
- `background.js`
- `offscreen.html` / `offscreen.js`
- `content.js` / `content.css`
- `popup.html` / `popup.css` / `popup.js`
- `assets/`
