# Inverse Lean Zoom — Technical Architecture

## Project Overview

**Inverse Lean Zoom** is a Chrome extension (Manifest V3) that uses on-device face detection to dynamically zoom out the page when a user leans closer to the screen. All processing is local-only using MediaPipe WASM + bundled models; no data is sent to external services.

**Version:** 0.1.0  
**Core Technology:** MediaPipe Tasks Vision (FaceDetector), Chrome offscreen documents, content scripts

---

## Architecture Overview

The extension follows a **three-tier architecture** with isolated security boundaries:

```
┌─────────────────────────────────────────────────────────────────┐
│  CONTENT SCRIPTS (All Web Pages)                                │
│  • Apply CSS scaling transforms                                  │
│  • Render HUD indicators                                         │
│  • Manage video element pause/resume                             │
└─────────────────────────────────────────────────────────────────┘
                            ↑ broadcast
                            ↓ connect
┌─────────────────────────────────────────────────────────────────┐
│  SERVICE WORKER (background.js)                                 │
│  • Message relay hub                                             │
│  • Offscreen document lifecycle management                       │
│  • Settings persistence (chrome.storage.local)                   │
│  • Port connection management                                    │
└─────────────────────────────────────────────────────────────────┘
                            ↑ sendMessage
                            ↓ sendMessage
┌─────────────────────────────────────────────────────────────────┐
│  OFFSCREEN DOCUMENT (offscreen.js + offscreen.html)              │
│  • Webcam capture & video stream management                      │
│  • Face detection loop (15 fps by default)                       │
│  • Scale computation with hysteresis & EMA smoothing             │
│  • Lighting detection (low-light avoidance)                      │
│  • MediaPipe FaceDetector initialization                         │
└─────────────────────────────────────────────────────────────────┘
                            ↑ Popup.js
                            ↓ Popup.js
┌─────────────────────────────────────────────────────────────────┐
│  POPUP UI (popup.js + popup.html)                               │
│  • Enable/Disable toggle                                         │
│  • Calibration button                                            │
│  • Sensitivity slider (k parameter)                              │
│  • Video pause-on-lean toggle                                    │
│  • Camera status indicator                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
distance-lock/
├── manifest.json           # Extension config (MV3)
├── background.js          # Service worker: relay & lifecycle
├── offscreen.html         # Minimal container for offscreen context
├── offscreen.js           # Face detection loop (MediaPipe integration)
├── content.js             # Runs on all pages: apply scaling + HUD
├── content.css            # HUD styling
├── popup.html             # Popup UI structure
├── popup.css              # Popup styling
├── popup.js               # Popup event handling & settings sync
├── assets/
│   ├── mediapipe/
│   │   ├── vision_bundle.mjs              # MediaPipe JS SDK
│   │   ├── blaze_face_short_range.tflite  # Face detection model
│   │   └── wasm/
│   │       ├── vision_wasm_internal.js
│   │       └── vision_wasm_nosimd_internal.js
└── README.md
```

---

## Component Details

### 1. Manifest (`manifest.json`)

**Key Permissions:**

- `storage`: Save/retrieve settings (calibration baseline, sensitivity, etc.)
- `offscreen`: Create and manage offscreen documents for camera access
- `host_permissions: <all_urls>`: Content scripts run on all sites
- `script-src 'wasm-unsafe-eval'`: Required for MediaPipe WASM

**Registration:**

- **Background service worker:** `background.js` (handles messages, lifecycle)
- **Popup UI:** `popup.html` (user interface)
- **Content scripts:** `content.js` (applies transforms to all pages)

---

### 2. Service Worker (`background.js`)

**Responsibilities:**

1. **Lifecycle Management**
   - Creates/destroys the offscreen document on enable/disable
   - Handles `onStartup` to restore state
   - Prevents multiple concurrent offscreen creation attempts

2. **Message Relay**
   - Routes `scale-update` messages from offscreen to all content scripts
   - Routes `settings-update` messages from popup to offscreen
   - Routes `calibrate` requests from popup to offscreen

3. **Settings Persistence**
   - Manages default settings via `DEFAULT_SETTINGS` object
   - Uses `chrome.storage.local` to persist user configuration
   - Broadcasts settings changes to all listeners

4. **State Tracking**
   - Caches last `status` (cameraActive, lowLight) to reply to new connections

**Key Functions:**

- `ensureOffscreenDocument()`: Creates offscreen doc only when needed
- `broadcast(message)`: Sends message to all connected ports (content scripts)
- `handleSettingsUpdate(partial)`: Persists and broadcasts new settings

---

### 3. Offscreen Document (`offscreen.js`, `offscreen.html`)

**Why Offscreen?**

- Avoids CSP violations on web pages (MediaPipe WASM requires `wasm-unsafe-eval`)
- Centralizes camera permissions (user grants once, not per-site)
- Runs in isolated context with full API access

**State Machine:**

```
[Stopped] → (enabled) → [Starting] → [Running] → (disabled) → [Stopped]
```

**Core Loop (`processFrame`):**

1. Check if video is ready
2. Update lighting assessment (30 fps check with 500ms debounce)
3. If low-light detected → ease scale to 1.0 (pause zoom)
4. Run face detection on current video frame
5. Extract largest face bounding box width (`faceWidth`)
6. Update scale based on face width vs. baseline

**Key Algorithms:**

**Exponential Moving Average (EMA) Smoothing:**

```
S_smooth = alpha * S_new + (1 - alpha) * S_smooth_prev
alpha = 0.2 (default, configurable)
```

Reduces jitter from frame-to-frame variations.

**Hysteresis State Machine:**

```
r = S_smooth / baseline  (closeness ratio)

if state == "engaged":
  if r < disengageThreshold (1.06):
    state = "disengaged"
else:
  if r > engageThreshold (1.12):
    state = "engaged"
```

Prevents flickering when hovering near threshold.

**Scale Computation:**

```
if state == "engaged":
  targetScale = clamp(1 / r^k, minScale=0.72, 1.0)
  where k = sensitivity (aggressiveness, default 1.2)
else:
  targetScale = 1.0
```

**Rate Limiting:**

```
actualScale = clamp(
  targetScale,
  prevScale - maxScaleStep,
  prevScale + maxScaleStep
)
maxScaleStep = 0.04 (4% per frame)
```

Prevents jarring jumps; creates smooth transitions.

**Lighting Detection:**

1. Downsample frame to 32×24 pixels
2. Compute average luma (0.2126R + 0.7152G + 0.0722B)
3. If luma < `lowLightLumaMin` (35): pause detection, show warning
4. Check every 500ms to reduce overhead

**No-Face Handling:**

- If no face detected for > `noFaceResetMs` (1500ms): ease scale to 1.0
- Otherwise: maintain last scale (graceful degradation)

---

### 4. Content Scripts (`content.js`, `content.css`)

**Injected On:** All URLs (before document is idle)

**Responsibilities:**

1. **Connect to Service Worker**

   ```javascript
   const port = chrome.runtime.connect({ name: "inverse-lean-zoom" });
   ```

   Maintains persistent bidirectional communication.

2. **Apply Scaling**

   ```css
   document.documentElement.style.transform = `scale(${scale})`
   document.documentElement.style.transformOrigin = "center top"
   ```

   Scales entire page from top-center origin.

3. **Render HUD**
   - Fixed position indicator (top-right corner)
   - Shows state: "Calibrate to start", "Neutral posture", "Lean detected", "Lighting too low", etc.
   - Opacity & color vary by state (low opacity when neutral, high when active)

4. **Video Pause/Resume** (if `pauseVideoOnLean` enabled)
   - On "too-close" state: pause all playing `<video>` elements
   - Track paused videos in `pausedVideos` Set
   - Resume only those paused by extension when returning to neutral state

**HUD Styling** (`content.css`):

- Dark semi-transparent background with high z-index (2147483647)
- State-based color coding: green (ok) → red (too-close) → yellow (low-light)
- Smooth opacity transitions

---

### 5. Popup UI (`popup.js`, `popup.html`, `popup.css`)

**User Controls:**

| Control             | Purpose                           | Maps To                     |
| ------------------- | --------------------------------- | --------------------------- |
| Enable              | Toggle extension on/off           | `settings.enabled`          |
| Calibrate           | Set baseline (current face width) | `settings.baseline`         |
| Sensitivity         | Adjust zoom aggressiveness        | `settings.k` (0.8–2.0)      |
| Pause Video On Lean | Auto-pause videos when leaning in | `settings.pauseVideoOnLean` |

**Status Indicators:**

- Extension state (Disabled / Enabled / Enabled · Calibrate)
- Camera status (Off / Starting… / On)
- Calibration status (Yes / No)

**Event Flow:**

1. User toggles/adjusts control
2. `updateSettings(partial)` sends message to service worker
3. Service worker broadcasts to offscreen & all content scripts
4. Offscreen adjusts behavior; content scripts apply new settings

---

## Data Flow Examples

### Enabling the Extension

```
User clicks "Enable" toggle
    ↓
popup.js sends { type: "settings-update", settings: { enabled: true } }
    ↓
background.js receives, calls ensureOffscreenDocument()
    ↓
Offscreen document created, init() receives settings, calls start()
    ↓
start() initializes FaceDetector, captures webcam, starts loop
    ↓
offscreen.js sends { type: "scale-update", scale: 1.0, state: "uncalibrated" }
    ↓
background.js broadcasts to all connected content scripts
    ↓
content.js receives, HUD shows "Calibrate to start"
```

### Calibration Flow

```
User clicks "Calibrate" button
    ↓
popup.js sends { type: "calibrate" }
    ↓
background.js forwards to offscreen document
    ↓
offscreen.js: calibrate() sets baseline = currentSmoothedFaceWidth
    ↓
offscreen.js sends { type: "baseline-update", baseline: X }
    ↓
background.js persists to chrome.storage.local
    ↓
broadcast to all listeners
    ↓
popup.js shows "Calibrated: Yes"
```

### Detection Loop (Runs Every ~67ms @ 15fps)

```
Video frame ready
    ↓
Check lighting, potentially pause
    ↓
offscreen.js calls detector.detectForVideo(video, timestamp)
    ↓
FaceDetector returns detections array with bounding boxes
    ↓
Extract largest face bbox width
    ↓
Apply EMA: smoothedWidth = 0.2 * width + 0.8 * smoothedWidth_prev
    ↓
Compute closeness ratio: r = smoothedWidth / baseline
    ↓
Update hysteresis state machine
    ↓
Compute targetScale using power law: 1 / r^k
    ↓
Rate-limit: actualScale = clamp(targetScale, scale ± 0.04)
    ↓
Send { type: "scale-update", scale, state, ratio }
    ↓
(via background) → content scripts apply transform
```

---

## Settings & Defaults

All settings stored in `chrome.storage.local` under `settings` key.

```javascript
{
  enabled: false,              // Extension active
  alpha: 0.2,                  // EMA coefficient (0–1, lower = smoother)
  k: 1.2,                       // Sensitivity/aggressiveness (0.8–2.0)
  minScale: 0.72,              // Minimum scale (maximum zoom out)
  engageThreshold: 1.12,       // Ratio to enter "too close" state
  disengageThreshold: 1.06,    // Ratio to exit "too close" state (hysteresis)
  maxScaleStep: 0.04,          // Max scale change per frame (rate limit)
  targetFps: 15,               // Detection loop frequency
  faceMetric: "bboxWidth",     // Currently only bboxWidth supported
  noFaceResetMs: 1500,         // Time to reset scale when no face detected
  lowLightLumaMin: 35,         // Luma threshold (0–255) to pause detection
  baseline: null,              // Calibrated face width (pixels)
  pauseVideoOnLean: true       // Auto-pause videos when leaning in
}
```

---

## Performance & Optimization

| Aspect                 | Approach                         | Benefit                           |
| ---------------------- | -------------------------------- | --------------------------------- |
| **Face Detection**     | MediaPipe WASM (local)           | No network latency, privacy-first |
| **Detection Rate**     | 15 fps (configurable)            | Smooth perception (~67ms latency) |
| **Smoothing**          | EMA on face width                | Reduces jitter & flicker          |
| **Rate Limiting**      | 4% max scale step/frame          | Prevents jarring jumps            |
| **Lighting Check**     | 30 fps detection, 500ms debounce | Minimal overhead                  |
| **Offscreen Document** | Only active when enabled         | Reduced background resource use   |
| **HUD Rendering**      | CSS-only, no JS animation        | Smooth GPU-accelerated display    |

---

## Security & Privacy

1. **Local-only Processing:** All face detection runs on-device via MediaPipe WASM. No frames sent to servers.
2. **Offscreen Isolation:** Camera access confined to offscreen document; no web page can directly access the stream.
3. **CSP Compliance:** WASM sandbox enabled via `wasm-unsafe-eval` in extension pages only.
4. **Storage:** Settings stored locally in `chrome.storage.local`; no cloud sync.
5. **Permissions:** `host_permissions: <all_urls>` for content script injection, not for API access.

---

## Browser Compatibility

- **Target:** Chrome 109+ (Manifest V3, offscreen documents)
- **Offscreen API:** Requires Chrome 120+ for `offscreen.hasDocument()` fallback detection
- **MediaPipe:** WASM support on all modern browsers

---

## Key Design Decisions

1. **Offscreen Document for Camera:** Avoids per-site permission prompts and CSP violations.
2. **Service Worker as Relay:** Decouples offscreen (single instance) from multiple content scripts (one per page).
3. **Port Connections:** Persistent connections from content scripts allow async message handling without callback nesting.
4. **EMA + Hysteresis:** Combination prevents flicker while maintaining responsiveness.
5. **Rate Limiting:** Ensures smooth animations even with high face-width variance.
6. **Bundled MediaPipe:** Avoids network dependency and version mismatches.

---

## Future Enhancements

- Multi-face support (average/weighted nearest)
- Head pose angle detection (roll/pitch/yaw) for more nuanced gestures
- Adaptive FPS (slower in low-light, faster when leaning detected)
- Per-domain enable/disable rules
- Analytics dashboard (local storage only)
- Keyboard shortcuts (quick toggle, calibration)
