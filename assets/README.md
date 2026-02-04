# MediaPipe Assets

These assets are already placed locally so the extension can load them without a network call.

## Bundled files

- `assets/mediapipe/vision_bundle.mjs` (from `@mediapipe/tasks-vision@0.10.32`)
- `assets/mediapipe/wasm/` (from `@mediapipe/tasks-vision@0.10.32`)
- `assets/mediapipe/blaze_face_short_range.tflite` (MediaPipe face detector model)

## Version Information

- **MediaPipe Tasks Vision:** v0.10.32
- **Release Date:** November 2025
- **License:** Apache 2.0
- **Source:** https://www.npmjs.com/package/@mediapipe/tasks-vision/v/0.10.32

The model source URL used:

- `https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite`

These files are loaded by `offscreen.js` via `chrome.runtime.getURL(...)` so they must remain bundled in the extension.
