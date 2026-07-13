import * as Clarity from 'clarity-js';

/**
 * Initialize Microsoft Clarity analytics
 * Clarity provides session recordings, heatmaps, and user behavior insights
 *
 * Requires VITE_CLARITY_PROJECT_ID environment variable
 * Get your Project ID from: https://clarity.microsoft.com
 */
export function initializeClarity() {
  const projectId = import.meta.env.VITE_CLARITY_PROJECT_ID;

  if (!projectId) {
    console.warn('Microsoft Clarity Project ID not configured. Add VITE_CLARITY_PROJECT_ID to .env');
    return;
  }

  try {
    Clarity.init(projectId, {
      // Only track in production and staging
      enableWebVitals: import.meta.env.PROD,
      // Mask sensitive data by default
      maskAllInputs: true,
      maskAllImages: false,
      unMaskInputs: ['search', 'q'], // Unmask non-sensitive inputs if needed
    });

    console.log(`Microsoft Clarity initialized with project ID: ${projectId}`);
  } catch (error) {
    console.error('Failed to initialize Microsoft Clarity:', error);
  }
}

/**
 * Track custom events in Clarity
 */
export function trackClarityEvent(eventName: string, data?: Record<string, unknown>) {
  try {
    if (typeof clarity.event === 'function') {
      clarity.event(eventName, data);
    }
  } catch (error) {
    console.error('Failed to track Clarity event:', error);
  }
}

/**
 * Set user identifier for Clarity sessions
 * Call this after user authentication
 */
export function setClarityUserId(userId: string) {
  try {
    if (typeof clarity.setUserId === 'function') {
      clarity.setUserId(userId);
    }
  } catch (error) {
    console.error('Failed to set Clarity user ID:', error);
  }
}

/**
 * Set custom user metadata in Clarity
 */
export function setClarityMetadata(key: string, value: string) {
  try {
    if (typeof clarity.metadata === 'function') {
      clarity.metadata(key, value);
    }
  } catch (error) {
    console.error('Failed to set Clarity metadata:', error);
  }
}
