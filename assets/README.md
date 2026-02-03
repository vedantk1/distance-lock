# MediaPipe Assets

Place MediaPipe Tasks Vision assets here so the extension can load them locally.

## Required files
- `assets/mediapipe/vision_bundle.mjs`
- `assets/mediapipe/wasm/` (all wasm + js loader files from the package)
- `assets/mediapipe/blaze_face_short_range.tflite`

## How to get them
1. Download the `@mediapipe/tasks-vision` npm package and extract it.
2. Copy `vision_bundle.mjs` and the entire `wasm/` folder into `assets/mediapipe/`.
3. Download the face detector model `blaze_face_short_range.tflite` and place it in `assets/mediapipe/`.

These files are loaded by `offscreen.js` via `chrome.runtime.getURL(...)` so they must be bundled in the extension.
