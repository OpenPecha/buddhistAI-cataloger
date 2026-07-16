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
 * Identify a logged-in user in Clarity via the Identify API.
 * Call after authentication (and ideally on each page load).
 *
 * @see https://learn.microsoft.com/en-us/clarity/setup-and-installation/identify-api
 *
 * @param userId - Stable unique ID (user email)
 * @param friendlyName - Optional display name shown in the Clarity dashboard
 */
export function identifyClarityUser(userId: string, friendlyName?: string) {
  if (!userId) return;

  if (!isClarityAvailable()) {
    console.warn('Clarity not available yet, retrying identify in 100ms...');
    setTimeout(() => identifyClarityUser(userId, friendlyName), 100);
    return;
  }

  try {
    // window.clarity("identify", custom-id, custom-session-id, custom-page-id, friendly-name)
    const w = window as any;
    w.clarity('identify', userId, undefined, undefined, friendlyName);
    console.log(
      `✓ Clarity identify: id=${userId}` +
        (friendlyName ? `, name=${friendlyName}` : ''),
    );
  } catch (error) {
    console.error('Failed to identify Clarity user:', error);
  }
}

/** @deprecated Prefer identifyClarityUser — kept for any remaining callers */
export function setClarityUserId(userId: string, friendlyName?: string) {
  identifyClarityUser(userId, friendlyName);
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
