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
    // Dynamically load Clarity script
    if (typeof window === 'undefined') return;

    // Initialize clarity queue if it doesn't exist
    const w = window as any;
    w.clarity = w.clarity || function (...args: any[]) {
      (w.clarity.q = w.clarity.q || []).push(args);
    };

    // Create and append Clarity script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.clarity.ms/tag/${projectId}`;
    script.onload = () => {
      console.log(`Microsoft Clarity initialized with project ID: ${projectId}`);
    };
    script.onerror = () => {
      console.error(`Failed to load Clarity script for project ID: ${projectId}`);
    };

    // Insert script early in document head if possible
    const target = document.head || document.documentElement;
    target.insertBefore(script, target.firstChild);
  } catch (error) {
    console.error('Failed to initialize Microsoft Clarity:', error);
  }
}

/**
 * Check if Clarity is available
 */
function isClarityAvailable(): boolean {
  return typeof window !== 'undefined' && !!(window as any).clarity;
}

/**
 * Set user identifier for Clarity sessions
 * Call this after user authentication
 *
 * @param userId - Unique user identifier (e.g., Auth0 sub)
 */
export function setClarityUserId(userId: string) {
  if (!isClarityAvailable()) {
    console.warn('Clarity not available yet, retrying in 100ms...');
    setTimeout(() => setClarityUserId(userId), 100);
    return;
  }

  try {
    // Clarity API: window.clarity('setUserId', userId)
    const w = window as any;
    w.clarity('setUserId', userId);
    console.log(`✓ Clarity user ID set to: ${userId}`);
  } catch (error) {
    console.error('Failed to set Clarity user ID:', error);
  }
}

/**
 * Set custom user metadata in Clarity
 * This appears alongside user sessions in the dashboard
 *
 * @param key - Metadata key (e.g., 'role', 'organization')
 * @param value - Metadata value
 */
export function setClarityMetadata(key: string, value: string) {
  if (!isClarityAvailable()) {
    console.warn('Clarity not available yet, metadata will not be set');
    return;
  }

  try {
    // Clarity API: window.clarity('tag', key, value)
    const w = window as any;
    w.clarity('tag', key, value);
    console.log(`✓ Clarity metadata set: ${key} = ${value}`);
  } catch (error) {
    console.error('Failed to set Clarity metadata:', error);
  }
}

/**
 * Track custom events in Clarity
 *
 * @param eventName - Event name
 * @param data - Optional event data
 */
export function trackClarityEvent(eventName: string, data?: Record<string, unknown>) {
  if (!isClarityAvailable()) {
    console.warn('Clarity not available, event will not be tracked');
    return;
  }

  try {
    const w = window as any;
    // Clarity API: window.clarity('event', name, [, value])
    const eventData = data ? JSON.stringify(data) : '';
    w.clarity('event', eventName, eventData);
    console.log(`✓ Clarity event tracked: ${eventName}`, data);
  } catch (error) {
    console.error('Failed to track Clarity event:', error);
  }
}
