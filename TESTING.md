# Testing Guide — Inverse Lean Zoom

## Quick Start Testing

### 1. Load Extension in Chrome

```bash
# From the parent directory, enter the repository folder
cd "distance lock"
```

**In Chrome:**
1. Enable **Developer mode** (toggle in top-right)
2. Click **Load unpacked**
3. Select this repository folder (`distance lock/`)
4. Extension should appear with green indicator

**Verify:**
- ✅ Extension icon appears in toolbar
- ✅ No errors in extension card
- ✅ Status shows "Errors: 0"

---

## 2. Basic Functionality Test

### Test 1: Enable & Calibrate
1. Click extension icon in toolbar
2. Toggle **Enable** on
3. Allow camera permission when prompted
4. **Sit at comfortable distance**
5. Click **Calibrate**

**Expected:**
- Camera status changes: "Off" → "Starting…" → "On"
- Calibrated status changes: "No" → "Yes"
- Status shows: "Enabled"

### Test 2: Lean Detection
1. Open any website (e.g., https://example.com)
2. Look for small HUD in top-right corner
3. **Lean closer to screen**

**Expected:**
- HUD appears with "Lean detected → zooming out"
- HUD turns red background
- Page zooms out (shrinks)
- Scale shown in HUD (e.g., "0.85x")

### Test 3: Return to Neutral
1. **Lean back** to calibrated distance

**Expected:**
- HUD changes to "Neutral posture (1.00x)"
- HUD fades to low opacity
- Page returns to normal size

### Test 4: Video Pause
1. Open YouTube or any site with video
2. Start playing a video
3. **Lean in close**

**Expected:**
- Video automatically pauses
- Zoom effect applies
- When you lean back, video resumes playing

---

## 3. Edge Case Testing

### Test 5: No Face Detected
1. Enable extension
2. Cover camera or turn away
3. Wait 2 seconds

**Expected:**
- HUD shows "No face detected"
- Scale gradually returns to 1.0
- No errors in console

### Test 6: Low Light
1. Enable extension
2. Cover camera lens with finger (simulates darkness)

**Expected:**
- HUD shows "Lighting too low"
- Detection pauses
- Scale stays at 1.0

### Test 7: Multiple Tabs
1. Enable extension
2. Open 3-4 different websites in separate tabs
3. Lean in/out

**Expected:**
- All tabs zoom simultaneously
- HUD appears on all pages
- No lag or flicker

### Test 8: Disable Extension
1. Click extension icon
2. Toggle **Enable** off

**Expected:**
- Camera status changes to "Off"
- All pages return to normal size
- HUD disappears from all pages
- Camera light turns off

---

## 4. Settings Testing

### Test 9: Sensitivity Adjustment
1. Enable extension, calibrate
2. Set sensitivity slider to **minimum (0.8)**
3. Lean in

**Expected:** Gentle zoom effect (less aggressive)

4. Set sensitivity to **maximum (2.0)**
5. Lean in

**Expected:** Strong zoom effect (very aggressive)

### Test 10: Video Pause Toggle
1. Open YouTube video
2. Toggle **Pause Video On Lean** OFF
3. Lean in

**Expected:**
- Zoom applies
- Video keeps playing (not paused)

4. Toggle **Pause Video On Lean** ON
5. Lean in

**Expected:**
- Zoom applies
- Video pauses

---

## 5. Cross-Site Testing

Test on various types of websites:

### Test 11: Different Website Types
- ✅ Static sites (example.com)
- ✅ Social media (twitter.com, facebook.com)
- ✅ Video sites (youtube.com, vimeo.com)
- ✅ News sites (nytimes.com, bbc.com)
- ✅ Web apps (gmail.com, docs.google.com)
- ✅ Local HTML files opened from disk

**Expected:** Works consistently across all sites

### Test 12: Special Pages
Test on these (should handle gracefully):
- Chrome settings (`chrome://settings`)
- Chrome extensions (`chrome://extensions`)
- New tab page (`chrome://newtab`)

**Expected:** May not inject on chrome:// pages (normal behavior)

---

## 6. Performance Testing

### Test 13: CPU/Memory Usage
1. Enable extension
2. Open Chrome Task Manager: `Chrome Menu → More Tools → Task Manager`
3. Find "Extension: Inverse Lean Zoom"

**Expected:**
- CPU: < 5% when idle
- CPU: 10-15% during active detection
- Memory: < 50 MB

### Test 14: Frame Rate
1. Enable extension
2. Open website with animations
3. Lean in/out repeatedly

**Expected:**
- Smooth transitions (no stuttering)
- Page remains responsive
- No visual lag

---

## 7. Console Debugging

### Check for Errors

**Service Worker Console:**
1. Go to `chrome://extensions`
2. Find "Inverse Lean Zoom"
3. Click "service worker" link
4. Check console for errors

**Content Script Console:**
1. Open any webpage
2. Press `F12` (DevTools)
3. Check Console tab

**Expected:** No red errors (warnings OK)

### Useful Debug Commands

In content script console:
```javascript
// Check current scale
document.documentElement.style.transform

// Check if port connected
chrome.runtime.connect({ name: "test" })
```

---

## 8. Security Testing

### Test 15: Camera Privacy
1. Enable extension on one tab
2. Open new tab
3. Check if camera light is still on

**Expected:** Camera stays on (offscreen document persists)

4. Disable extension
5. Check camera light

**Expected:** Camera turns off immediately

### Test 16: Storage Inspection
1. Enable extension, calibrate
2. Open DevTools on background page
3. Run:
```javascript
chrome.storage.local.get('settings', (data) => {
  console.log(data);
});
```

**Expected:** Should show settings object with baseline, k, etc.

### Test 17: CSP Compliance
1. Open DevTools on any page
2. Check Console for CSP errors

**Expected:** No CSP violations

---

## 9. Recalibration Testing

### Test 18: Change Environment
1. Calibrate at comfortable distance
2. Lean in (should zoom out)
3. Move chair closer to screen
4. Click **Calibrate** again
5. Now neutral at new distance

**Expected:** Baseline updates, zoom resets

---

## 10. Stress Testing

### Test 19: Rapid Enable/Disable
1. Click extension icon
2. Toggle Enable on/off rapidly 10 times

**Expected:**
- No crashes
- Camera properly starts/stops
- No memory leaks

### Test 20: Many Tabs
1. Open 20+ tabs
2. Enable extension
3. Lean in/out

**Expected:**
- All tabs respond
- No browser slowdown
- Extension remains stable

---

## Automated Testing Checklist

Run through this checklist before each release:

- [ ] Extension loads without errors
- [ ] Camera permission granted
- [ ] Calibration captures baseline
- [ ] Lean in triggers zoom out
- [ ] Lean back returns to normal
- [ ] Video pause works on YouTube
- [ ] HUD displays correctly
- [ ] Sensitivity slider changes behavior
- [ ] Disable turns off camera
- [ ] No console errors on 5 different sites
- [ ] CPU usage < 15% during detection
- [ ] Memory usage < 50 MB
- [ ] Settings persist after browser restart
- [ ] Works on incognito mode (if allowed)
- [ ] Multiple tabs work simultaneously

---

## Known Issues to Check

- **Camera "Starting…" stuck:** Check camera permissions in `chrome://settings/content/camera`
- **No zoom effect:** Ensure calibration was done
- **Flickering:** Check lighting (may be too dark)
- **HUD not appearing:** Check if content script injected (F12 → Elements → search for `ilz-hud`)

---

## Testing Tools

### Useful Chrome URLs
- `chrome://extensions` — Extension management
- `chrome://inspect/#extensions` — Debug background pages
- `chrome://webrtc-internals` — Camera/video diagnostics
- `chrome://media-internals` — Media pipeline inspection

### DevTools Tips
```javascript
// In service worker console
chrome.storage.local.get(console.log)  // View all settings

// In content script console
document.querySelector('#ilz-hud')  // Find HUD element
```

---

## Reporting Issues

If you find bugs during testing:
1. Note browser version: `chrome://version`
2. Check console errors (all contexts)
3. Test in incognito mode (rule out conflicts)
4. Disable other extensions
5. Document steps to reproduce

---

## Next Steps After Testing

Once all tests pass:
1. ✅ Update version in `manifest.json`
2. ✅ Create git tag for release
3. ✅ Build extension package (if needed)
4. ✅ Submit to Chrome Web Store
