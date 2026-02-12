# Inverse Lean Zoom

Inverse Lean Zoom is a Chrome extension (Manifest V3) that shrinks page scale when you lean toward your screen.

All face detection runs locally in an offscreen document using bundled MediaPipe WASM assets. No camera frames are uploaded.

## What it does

- Detects lean-in distance changes from webcam face size.
- Applies inverse page zoom (`scale(...)`) across tabs.
- Uses smoothing + hysteresis to avoid jitter and flicker.
- Supports one-click calibration for your neutral posture.
- Optionally pauses playing videos while you are too close.
- Optionally plays local sound cues for lean-in and max zoom-out.

## Privacy model

- Local-only processing: face detection runs on-device.
- No analytics, telemetry, or remote API calls for detection.
- Camera stream is used only inside the extension offscreen context.
- Only settings are stored in `chrome.storage.local`.

See also:
- [SECURITY.md](SECURITY.md)
- [SECURITY_AUDIT.md](SECURITY_AUDIT.md)

## Permissions (and why)

| Permission | Why it is needed |
| --- | --- |
| `storage` | Persist settings (enabled state, baseline, thresholds, toggles). |
| `offscreen` | Run camera + detection in an isolated offscreen document. |
| `tabs` | Discover open tabs when enabling so current tabs can be activated without reload. |
| `scripting` | Inject `content.js` and `content.css` into already-open tabs on enable. |
| `host_permissions: <all_urls>` | Apply zoom/HUD behavior on the sites you visit. |

## Install (load unpacked)

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click **Load unpacked**.
4. Select this repository folder.

## First-run setup

1. Click the extension icon.
2. Turn **Enable** on.
3. Grant camera access when prompted.
4. Sit at your normal distance and click **Calibrate**.

## Controls

| Control | Description |
| --- | --- |
| Enable | Turns the extension on/off. |
| Calibrate | Sets the current face width as baseline distance. |
| Sensitivity | Controls lean response aggressiveness (`k`). |
| Pause Video On Lean | Pauses playing videos while state is `too-close`. |
| Sound FX | Enables local cue sounds. |
| Sound Volume | Sets cue volume. |

### Advanced controls

| Control | Internal setting | Effect |
| --- | --- | --- |
| Max Zoom Out | `minScale` | Lower value allows more shrink. |
| Trigger Distance | `engageThreshold` | Ratio required to enter `too-close`. |
| Transition Speed | `maxScaleStep` | Max scale change per update. |
| Face Lost Timeout | `noFaceResetMs` | Delay before easing back when no face is detected. |
| Low Light Threshold | `lowLightLumaMin` | Minimum brightness before detection pauses. |

## How it works

1. `popup.js` updates settings and requests calibration.
2. `background.js` persists settings and coordinates contexts.
3. `offscreen.js` captures camera frames, runs MediaPipe face detection, and computes scale.
4. `content.js` applies transform + HUD in pages.

For implementation details, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Project layout

- `manifest.json`
- `background.js`
- `offscreen.html`, `offscreen.js`
- `popup.html`, `popup.css`, `popup.js`
- `content.js`, `content.css`
- `permission.html`, `permission.js`
- `assets/` (bundled MediaPipe JS/WASM/model)
- `LICENSE`

## Development

No build step is required right now; this repo is plain extension source.

Typical workflow:
1. Edit source files.
2. Open `chrome://extensions`.
3. Click **Reload** on the extension card.
4. Re-test in an existing tab and a new tab.

## Testing

Manual test coverage and release checklist are documented in [TESTING.md](TESTING.md).

## Troubleshooting

- Camera stuck at `Starting...`: grant camera permission and ensure camera is not in use by another app.
- No zoom effect: verify extension is enabled and calibration completed.
- No HUD on a page: restricted pages (for example `chrome://` pages) do not allow content script injection.
- Choppy behavior: reduce sensitivity or transition speed in Advanced Settings.

## Security reporting

If you find a vulnerability, use the process in [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE).

## Open-source notes

- Keep docs and permission rationale aligned with `manifest.json` when behavior changes.
