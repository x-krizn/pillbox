# Pillbox PWA - Deployment Guide

## Files Included

✅ **index.html** - Main application file (26KB)  
✅ **manifest.json** - PWA manifest with app metadata (514B)  
✅ **sw.js** - Service worker for offline functionality (2.0KB)  
✅ **icon-192.png** - App icon 192×192 (1.4KB)  
✅ **icon-512.png** - App icon 512×512 (31KB)

**STATUS:** ROBUST - All files follow PWA standards (Tier 1: MDN/W3C specs)

---

## Deployment Instructions

### Option 1: GitHub Pages (Recommended)

1. Create a new GitHub repository
2. Upload all 5 files to the root directory
3. Enable GitHub Pages in Settings → Pages
4. Set source to "main" branch, "/" (root) folder
5. Access via: `https://yourusername.github.io/repo-name/`

**HTTPS Required:** PWAs require HTTPS (GitHub Pages provides this automatically)

### Option 2: Netlify/Vercel

1. Create account on Netlify or Vercel
2. Drag and drop all 5 files
3. Deploy
4. Access via provided HTTPS URL

### Option 3: Local Testing

```bash
# Using Python 3
python3 -m http.server 8000

# Using Node.js
npx http-server -p 8000
```

Then visit: `http://localhost:8000`

**LIMITATION:** Service Workers require HTTPS in production. Local testing works on localhost only.

---

## Installation on Devices

### Desktop (Chrome/Edge/Brave)

1. Visit your deployed URL
2. Look for install icon in address bar (⊕ or computer icon)
3. Click "Install Pillbox"
4. App launches in standalone window

### iOS (Safari)

1. Visit your deployed URL
2. Tap Share button (square with arrow)
3. Scroll down, tap "Add to Home Screen"
4. Tap "Add"
5. App icon appears on home screen

### Android (Chrome)

1. Visit your deployed URL
2. Chrome will show "Add to Home Screen" banner
3. Tap "Install"
4. App icon appears in app drawer

---

## Technical Details

### PWA Compliance Checklist

✅ HTTPS (required for production)  
✅ Web App Manifest with name, icons, display mode  
✅ Service Worker for offline functionality  
✅ Icons in 192×192 and 512×512 sizes  
✅ Start URL defined  
✅ Display mode: standalone  
✅ Theme color: #000000 (black)

### Service Worker Features

- **Offline Mode:** App works without internet connection
- **Caching Strategy:** Cache-first with network fallback
- **Auto-update:** Service worker updates on new deployment
- **Assets Cached:** HTML, manifest, icons

### Browser Compatibility

**ROBUST:**
- Chrome/Edge (Desktop & Mobile) - Full support
- Safari iOS 11.3+ - Full support (with "Add to Home Screen")
- Firefox - Full support
- Samsung Internet - Full support

**FRAGILE:**
- Safari macOS - PWA support added in macOS Sonoma (14.0+)
- Older browsers - May work but no install prompt

---

## Verification

After deployment, test PWA compliance:

1. Visit: https://www.pwabuilder.com/
2. Enter your deployed URL
3. Check PWA score and requirements

Or use Chrome DevTools:
1. Open your deployed site
2. F12 → Application tab
3. Check "Manifest" and "Service Workers" sections

---

## File Integrity

```
index.html      - PWA-ready HTML with external manifest/SW references
manifest.json   - Valid W3C manifest format
sw.js          - Cache-first service worker strategy
icon-192.png   - PNG, 192×192px, "WHEN" pixel art logo
icon-512.png   - PNG, 512×512px, "WHEN" pixel art logo
```

**VERIFIED:** All files use standard PWA architecture (no vendor lock-in)

---

## Troubleshooting

### "Add to Home Screen" not appearing

**INFERRED causes:**
- Not using HTTPS (required)
- Manifest or Service Worker not loading (check browser console)
- Icons missing or wrong size
- Already installed

**Fix:** Check DevTools → Console for errors

### Service Worker not registering

**OBSERVED behavior:** Service Workers are blocked on:
- HTTP sites (except localhost)
- Private/incognito mode (some browsers)

**Fix:** Use HTTPS or localhost for testing

### App not working offline

**INFERRED:** Service Worker may not be activated yet
**Fix:** 
1. Close all tabs with the app
2. Reopen the app
3. Check DevTools → Application → Service Workers → Status should be "activated"

---

## Notes

- **Persistence:** App data is stored in IndexedDB (preserved across sessions)
- **Updates:** To update the PWA, deploy new files and increment cache version in sw.js
- **Uninstall:** Remove from home screen or app drawer like any other app

**DEPLOYMENT READY** - All files are standards-compliant PWA components.
