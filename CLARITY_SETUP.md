# Microsoft Clarity Integration Guide

## Overview

Microsoft Clarity is now integrated into the buddhistAI-cataloger frontend. Clarity provides:

- **Session Recordings**: Watch how users interact with your application
- **Heatmaps**: See where users click, move, and scroll
- **Rage Clicks**: Identify user frustration points
- **Dead Clicks**: Find unresponsive UI elements
- **Web Vitals**: Monitor Core Web Vitals
- **Free**: No cost, unlike some analytics tools

## Getting Started

### 1. Create a Clarity Project

1. Go to [clarity.microsoft.com](https://clarity.microsoft.com)
2. Sign in with a Microsoft account (create one if needed)
3. Create a new project
4. Copy your **Project ID** (looks like: `xyz123abc456`)

### 2. Add Project ID to Environment

Add your Clarity Project ID to your `.env` file:

```bash
VITE_CLARITY_PROJECT_ID=your_project_id_here
```

Or copy from `.env.example` and update:

```bash
cp .env.example .env
# Edit .env and add your VITE_CLARITY_PROJECT_ID
```

### 3. Start the App

```bash
cd frontend
npm run dev
```

Clarity will automatically initialize and start recording sessions.

## Features Implemented

### Core Analytics

- ✅ **Session Tracking**: Automatically tracks all user sessions
- ✅ **User Identification**: Tracks authenticated users by their Auth0 ID
- ✅ **Page View Tracking**: Records page navigations
- ✅ **Sensitive Data Masking**: Input fields are masked by default for privacy

### Configuration Options

Located in `src/lib/clarity.ts`:

```typescript
clarity.init(projectId, {
  enableWebVitals: true,              // Track Core Web Vitals
  maskAllInputs: true,                // Mask input fields for privacy
  maskAllImages: false,               // Don't mask images
  unMaskInputs: ['search', 'q'],     // Unmask specific non-sensitive inputs
});
```

## Tracking Custom Events

### Track User Actions

```typescript
import { trackClarityEvent } from '@/lib/clarity'

// Basic event
trackClarityEvent('user_action', { action: 'button_click' })

// With data
trackClarityEvent('form_submitted', { 
  formId: 'text-upload',
  fieldCount: 5 
})
```

### Set User Metadata

```typescript
import { setClarityMetadata } from '@/lib/clarity'

// After user login
setClarityMetadata('subscription_tier', 'premium')
setClarityMetadata('organization', 'OpenPecha')
```

### Examples in Code

**Track text outline generation:**
```typescript
trackClarityEvent('outline_generated', {
  textId: textId,
  sectionCount: outline.sections.length,
  duration: Date.now() - startTime
})
```

**Track annotation submissions:**
```typescript
trackClarityEvent('annotation_submitted', {
  type: 'segment',
  segmentId: segment.id
})
```

## Privacy & Compliance

### Data Masking

By default, Clarity masks all input fields to protect sensitive data:

```typescript
maskAllInputs: true  // Search boxes, password fields, etc.
```

To unmask specific non-sensitive search fields:

```typescript
unMaskInputs: ['search', 'q']  // Only these will be visible
```

### GDPR & Data Retention

- **Data Retention**: Configure in Clarity dashboard (default: 13 months)
- **Session Recording**: Users in regions requiring consent may need explicit opt-in
- **User Identification**: Uses anonymous Auth0 sub (not email/PII by default)

## Debugging

### Check if Clarity is Initialized

Open browser console and run:

```javascript
window.clarity
```

Should return an object with methods if initialized.

### View Project Dashboard

1. Go to [clarity.microsoft.com](https://clarity.microsoft.com)
2. Open your project
3. View real-time sessions and heatmaps

### Common Issues

**Project ID not set:**
```
Warning: Microsoft Clarity Project ID not configured. Add VITE_CLARITY_PROJECT_ID to .env
```
→ Add `VITE_CLARITY_PROJECT_ID` to `.env` file

**Clarity not tracking data:**
- Check Project ID is correct in Clarity dashboard
- Ensure `VITE_CLARITY_PROJECT_ID` is set in `.env`
- Clear browser cache and reload
- Check browser console for errors

## File Structure

```
frontend/
├── src/
│   ├── lib/
│   │   └── clarity.ts                 # Clarity initialization & utilities
│   ├── app/
│   │   └── OutlinerAuthBridge.tsx    # Sets user ID when authenticated
│   ├── PostHogPageViewTracker.tsx     # Tracks page views
│   └── main.tsx                       # Initializes Clarity
├── .env.example                       # Example configuration
└── CLARITY_SETUP.md                   # This file
```

## API Reference

### initializeClarity()

Initializes Microsoft Clarity with your project ID.

```typescript
initializeClarity()
```

Called automatically in `main.tsx`.

### trackClarityEvent(eventName, data?)

Track a custom event.

```typescript
trackClarityEvent('text_created', { textId: '123' })
```

### setClarityUserId(userId)

Set the current user ID (called automatically on login).

```typescript
setClarityUserId(user.sub)
```

### setClarityMetadata(key, value)

Set custom user metadata.

```typescript
setClarityMetadata('role', 'annotator')
```

## Monitoring & Analytics

### Key Metrics to Watch

1. **Session Count**: Total user sessions
2. **Rage Clicks**: Users clicking repeatedly on unresponsive elements
3. **Dead Clicks**: Users clicking on non-interactive elements
4. **Scroll Depth**: How far users scroll
5. **Web Vitals**: LCP, FID, CLS performance

### Heatmap Analysis

- **Click Heatmap**: Where users click most
- **Scroll Heatmap**: How far users scroll
- **Move Heatmap**: Where users move their mouse

## Next Steps

1. ✅ Add `VITE_CLARITY_PROJECT_ID` to `.env`
2. Run the app: `npm run dev`
3. Open Clarity dashboard to see live sessions
4. Add custom event tracking for key user actions
5. Review session recordings to identify UX improvements

## Support

- [Microsoft Clarity Docs](https://learn.microsoft.com/en-us/clarity/)
- [Clarity Troubleshooting](https://learn.microsoft.com/en-us/clarity/troubleshooting)
- Check browser console for any Clarity errors

## Configuration Reference

### Environment Variables

```bash
# Required
VITE_CLARITY_PROJECT_ID=your_project_id

# Optional (already configured)
VITE_POSTHOG_KEY=your_posthog_key
VITE_POSTHOG_HOST=your_posthog_host
```

### Masking Configuration

Edit `src/lib/clarity.ts` to adjust privacy settings:

```typescript
clarity.init(projectId, {
  enableWebVitals: true,              // Enable Core Web Vitals
  maskAllInputs: true,                // Mask all inputs
  maskAllImages: false,               // Show images
  unMaskInputs: ['search'],           // Specific inputs to show
});
```
