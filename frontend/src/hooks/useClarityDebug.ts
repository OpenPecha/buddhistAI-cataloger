import { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

/**
 * Debug hook to verify Clarity is initialized and tracking user info
 * Log output can be viewed in browser console
 */
export function useClarityDebug() {
  const { user, isAuthenticated } = useAuth0();

  useEffect(() => {
    const debugClarity = () => {
      const w = window as any;

      console.group('🔍 Clarity Debug Info');

      // Check if Clarity is loaded
      if (w.clarity) {
        console.log('✓ Clarity is loaded');
      } else {
        console.warn('✗ Clarity is NOT loaded');
      }

      // Check if user is authenticated
      console.log('Auth Status:', {
        isAuthenticated,
        userId: user?.sub,
        email: user?.email,
        name: user?.name,
      });

      // Try to access clarity data
      try {
        // This may not work depending on Clarity version, but worth trying
        if (w.clarity && w.clarity.q) {
          console.log('Clarity Queue:', w.clarity.q);
        }
      } catch (e) {
        console.log('Could not access clarity queue');
      }

      console.groupEnd();
    };

    // Run debug on first mount and when auth changes
    debugClarity();

    // Also run after a delay to ensure Clarity script has loaded
    const timeout = setTimeout(debugClarity, 2000);

    return () => clearTimeout(timeout);
  }, [isAuthenticated, user]);
}

/**
 * Log Clarity info to console (can be called manually)
 */
export function logClarityInfo() {
  const w = window as any;

  console.group('📊 Clarity Information');
  console.log('Clarity object exists:', !!w.clarity);

  if (w.clarity) {
    console.log('Clarity is available as window.clarity');
    console.log(
      'Usage examples:',
      `
      window.clarity('identify', 'user-id', undefined, undefined, 'Friendly Name')
      window.clarity('set', 'key', 'value')
      window.clarity('event', 'event-name')
    `
    );
  } else {
    console.warn('Clarity not loaded yet. Check VITE_CLARITY_PROJECT_ID in .env');
  }

  console.groupEnd();
}
