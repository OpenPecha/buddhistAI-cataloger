# Microsoft Clarity - Troubleshooting Guide

## Verify Clarity is Loaded

### Step 1: Check Browser Console

Open your browser's Developer Tools (F12 or Right-click → Inspect):

```javascript
// In the Console tab, paste:
window.clarity
```

**Expected output:** An object or function, not `undefined`

If you see `undefined`, Clarity hasn't loaded yet.

### Step 2: Verify Project ID is Set

```javascript
console.log(import.meta.env.VITE_CLARITY_PROJECT_ID)
```

Should show your Clarity Project ID. If empty or undefined:
- Add `VITE_CLARITY_PROJECT_ID=your_id` to `.env`
- Restart dev server: `npm run dev`

### Step 3: Check Clarity Script in Network Tab

1. Open DevTools → Network tab
2. Refresh the page
3. Look for a request to `clarity.ms`
4. Should see status 200 (successful)

If you see 404 or the request is missing:
- Project ID is wrong
- Clarity service is down (rare)

---

## User Information Not Showing

### Issue: User ID is Not Being Set

**Symptom:** Sessions show in Clarity dashboard but no user ID attached

**Solution:**

1. **Check Auth0 is Working:**
   ```javascript
   // In console, when logged in:
   window.__AUTH0_USER__
   // Should show user object with 'sub' field
   ```

2. **Manually Set User ID for Testing:**
   ```javascript
   window.clarity('setUserId', 'test-user-123')
   ```
   - Check Clarity dashboard - should now show user ID

3. **Check Console Logs:**
   Open browser console and look for:
   ```
   ✓ Clarity user ID set to: auth0|xxxx...
   ```
   
   If you don't see this, Clarity might not be initialized yet.

4. **Add Debug Hook to Your App:**
   
   In any component:
   ```tsx
   import { useClarityDebug } from '@/hooks/useClarityDebug'
   
   export function MyComponent() {
     useClarityDebug()  // Logs debug info to console
     return <div>...</div>
   }
   ```

---

## Clarity Dashboard Shows No Data

### Issue: No Sessions Appearing in Dashboard

**Solutions:**

1. **Check Project ID Matches:**
   - In `.env`: `VITE_CLARITY_PROJECT_ID=abc123`
   - In Clarity Dashboard: Project Settings → Project ID should match

2. **Verify Script is Running:**
   ```javascript
   // In console:
   window.clarity('tag', 'test', 'value')
   window.clarity('event', 'test_event', 'test_data')
   ```

3. **Check Time Sync:**
   - Clarity dashboard shows UTC time
   - Your local session might not appear for 1-2 minutes
   - Try refreshing the dashboard

4. **Disable Ad Blockers:**
   - Clarity might be blocked by ad blockers
   - Try temporarily disabling them

---

## Common Error Messages

### "Clarity Project ID not configured"

**Fix:**
```bash
# Add to frontend/.env
VITE_CLARITY_PROJECT_ID=your_project_id

# Restart server
npm run dev
```

### "Failed to load Clarity script"

**Possible causes:**
- Invalid Project ID
- Network connectivity issue
- Clarity service temporarily down

**Fix:**
1. Verify Project ID is correct in Clarity dashboard
2. Try in a different browser
3. Check network tab for 404 errors

### "Clarity not available yet"

**Normal behavior** - Clarity takes 1-2 seconds to load

**Fix:**
- This is a warning, not an error
- First events might not be tracked, but all data after 2 seconds will be captured
- If it persists, check script loading in Network tab

---

## Testing User Identification

### Manual Test in Console

```javascript
// 1. Set user ID
window.clarity('setUserId', 'user-123')

// 2. Add metadata
window.clarity('tag', 'subscription', 'premium')
window.clarity('tag', 'role', 'annotator')

// 3. Track an event
window.clarity('event', 'test_event', 'test_value')

// 4. Refresh dashboard - should see new session with user info
```

### Automated Test (In App Component)

```tsx
import { useEffect } from 'react'
import { trackClarityEvent, setClarityUserId, setClarityMetadata } from '@/lib/clarity'

export function ClarityTestComponent() {
  useEffect(() => {
    // Simulate what OutlinerAuthBridge does
    setClarityUserId('test-user-' + Date.now())
    setClarityMetadata('test', 'component')
    trackClarityEvent('component_mounted', { timestamp: new Date().toISOString() })
  }, [])

  return <div>Check console and Clarity dashboard for events</div>
}
```

---

## Checking Clarity Dashboard

### Where to See User Info

1. Go to [clarity.microsoft.com](https://clarity.microsoft.com)
2. Open your project
3. Click **"Sessions"** in the left menu
4. **User Column** should show user ID if properly set

### What User Info Should Look Like

```
Session Details:
├── User ID: auth0|12345abcde
├── Session Start: 2:30 PM
├── Duration: 2 min 15 sec
├── Pages: 3
├── Interactions: 45
└── Metadata:
    ├── email: user@example.com
    ├── name: John Doe
    └── role: annotator
```

---

## Advanced Debugging

### Enable Verbose Logging

Create a test component:

```tsx
import { useEffect } from 'react'

export function ClarityVerboseDebug() {
  useEffect(() => {
    const w = window as any

    // Intercept Clarity calls
    const originalClarity = w.clarity
    w.clarity = function (...args: any[]) {
      console.log('🎯 Clarity API Called:', args)
      return originalClarity?.(...args)
    }

    // Log every 5 seconds
    const interval = setInterval(() => {
      console.log('Clarity status check:', {
        loaded: !!w.clarity,
        time: new Date().toISOString(),
      })
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  return null
}
```

### Check Network Requests

In DevTools Network tab, filter for:
- `clarity.ms` - Main Clarity script
- `ca.clarity.ms` - Clarity analytics/data collection

Should see multiple requests as you interact with the app.

---

## Clarity Script Loading Sequence

```
1. Page loads
   ↓
2. Clarity script loads (index.html comment)
   ↓
3. window.clarity becomes available
   ↓
4. React app mounts (main.tsx)
   ↓
5. initializeClarity() called
   ↓
6. User logs in
   ↓
7. OutlinerAuthBridge sets user ID (500ms delay)
   ↓
8. Clarity dashboard shows user session with ID
```

---

## Environment-Specific Issues

### Development (localhost)

- Check `.env` file (not `.env.example`)
- Server running? Check port 3000
- Clear browser cache (Ctrl+Shift+Delete)

### Production Build

```bash
# Build frontend
npm run build

# Test production build locally
npm run preview

# Check that VITE_CLARITY_PROJECT_ID is set in production env
```

### Docker/Container

Ensure environment variable is passed:

```bash
docker run -e VITE_CLARITY_PROJECT_ID=your_id myapp
```

---

## Still Not Working?

### Verification Checklist

- [ ] `.env` file has `VITE_CLARITY_PROJECT_ID=your_id`
- [ ] Server restarted after `.env` change
- [ ] Browser console shows no errors
- [ ] `window.clarity` exists in console
- [ ] User is authenticated (logged in)
- [ ] Waited 2+ seconds after login
- [ ] Checked Clarity dashboard (not cached - refresh page)
- [ ] Browser ad blocker is disabled
- [ ] Network tab shows `clarity.ms` requests with 200 status

### Next Steps

1. **Check Clarity Logs:**
   ```javascript
   // View all Clarity-related messages
   console.log('%cClarity Debug', 'color: blue')
   console.log(window.clarity)
   ```

2. **Test Different Browser:**
   - Chrome, Firefox, Safari - see if issue persists
   - Helps isolate browser-specific problems

3. **Review Network Requests:**
   - DevTools → Network → filter "clarity"
   - Any 404 or failed requests?

4. **Contact Clarity Support:**
   - [Microsoft Clarity Docs](https://learn.microsoft.com/en-us/clarity/)
   - Check Project Settings → Support

---

## Performance Tips

### Optimize Clarity for Production

```typescript
// In src/lib/clarity.ts
clarity.init(projectId, {
  enableWebVitals: true,          // ✓ Essential
  maskAllInputs: true,            // ✓ Privacy
  maskAllImages: false,           // ✓ OK to show images
  unMaskInputs: ['search'],       // Selective unmasking
  
  // Advanced (optional)
  // disableWindowsEvents: false,   // Include window resize, etc.
  // enableClickAnalysis: true,     // Analyze clicks (slight perf hit)
});
```

### Reduce Events Being Tracked

```typescript
// Only track important events
trackClarityEvent('critical_action', data)  // ✓ Do this
// Avoid tracking every keystroke or mouse move
```

---

## Quick Reference

| Issue | Quick Fix |
|-------|-----------|
| No data in dashboard | Check Project ID matches |
| No user ID | Wait 2 sec after login, refresh dashboard |
| Clarity not loaded | Add VITE_CLARITY_PROJECT_ID to .env, restart server |
| Script 404 error | Invalid Project ID |
| Ad blocker interference | Disable ad blocker |
| Delayed data | Wait 1-2 min, Clarity batches requests |
| Old sessions showing | Clear browser cache, Clarity cache TTL set to 13mo |

---

## Need Help?

- **Microsoft Clarity Docs**: https://learn.microsoft.com/en-us/clarity/
- **Browser Console**: Press F12, check Console tab for errors
- **Clarity Dashboard**: https://clarity.microsoft.com
- **Network Tab**: DevTools → Network, filter "clarity"
