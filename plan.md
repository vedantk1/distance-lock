# Inverse Lean Zoom — Implementation Plan

## Goals
- Chrome extension only.
- Local-only webcam processing.
- Stable, smooth inverse-zoom effect.
- Minimal UI: Calibrate, Sensitivity, Enable.

## Deliverables
- `manifest.json`
- `content.js`
- `ui.html` / `ui.css` / `ui.js` (popup)
- `plan.md`

## Decisions (to avoid reinventing the wheel)
- Face detection: MediaPipe Tasks Vision `FaceDetector` (WASM, local-only).
  - Bundle the JS + WASM + model with the extension.
  - Alternative fallback: face-api.js (TFJS-based) if MediaPipe causes friction.

## Proposed Defaults (initial tuning)
- `alpha` (EMA): `0.2`
- `k` (aggressiveness): `1.2`
- `minScale`: `0.72`
- `engageThreshold`: `1.12`
- `disengageThreshold`: `1.06`
- `maxScaleStep`: `0.04` (4% per update)
- `targetFps`: `15`
- `faceMetric`: `bboxWidth`
- `noFaceResetMs`: `1500`
- `lowLightLumaMin`: `35` (0-255)
- `maxFaces`: `1` (largest face only)

## Behavior Spec (exact)
- Capture webcam frames at `targetFps` into a hidden `<video>` and `<canvas>`.
- Face metric: use face bbox width in pixels (largest face) as `S`.
- Smoothing: EMA on `S`:
  - `S_smooth = alpha * S + (1 - alpha) * S_smooth`
- Calibration: store baseline `B = S_smooth` when user clicks Calibrate.
- Closeness ratio: `r = S_smooth / B`.
- Hysteresis:
  - If `r > engageThreshold`, enter "too close" state.
  - Exit only when `r < disengageThreshold`.
- Scale mapping when too close:
  - `targetScale = clamp(1 / (r ^ k), minScale, 1.0)`
  - Otherwise `targetScale = 1.0`
- Rate limit: `scale = clamp(targetScale, scale - maxScaleStep, scale + maxScaleStep)`
- Apply: `document.documentElement.style.transform = scale(...)` and `transform-origin: center top`.
- No face detected:
  - If no face for `noFaceResetMs`, ease back to `1.0`.
  - Otherwise keep last scale (no extra punishment).
- Low light:
  - Compute average luma from the frame; if below `lowLightLumaMin`, pause detection and show a small HUD message.

## Extension File Structure (minimal)
- `manifest.json` (MV3)
- `content.js` (camera + detection + scaling)
- `content.css` (HUD styles)
- `popup.html` / `popup.css` / `popup.js` (Enable, Calibrate, Sensitivity)
- `assets/`
  - MediaPipe JS bundle
  - WASM files
  - Face detection model

## Steps
1. Lock the behavior spec + defaults (this doc).
2. Draft extension structure + manifest permissions.
3. Implement content script:
   - webcam capture
   - face detection (local)
   - compute scale
   - apply CSS transform
4. Implement popup UI and storage:
   - Enable toggle
   - Calibrate button
   - Sensitivity slider (maps to `k`)
5. Add overlay HUD and no-face/low-light handling.
6. Manual test on a few sites, refine thresholds.

## Open Questions
- Resolved: popup is top-right compact.
- Resolved: calibration is baseline-only.
