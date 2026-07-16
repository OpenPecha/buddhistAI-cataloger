import { useAuth0 } from '@auth0/auth0-react';
import { usePostHog } from 'posthog-js/react';
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom';
import { identifyClarityUser, trackClarityEvent } from '@/lib/clarity';

function PostHogPageViewTracker() {
  const location = useLocation();
  const posthog = usePostHog();
  const { isAuthenticated, user } = useAuth0();

  useEffect(() => {
    if (posthog) {
      posthog.capture('$pageview');
    }
    trackClarityEvent('page_view', { path: location.pathname });

    // Clarity recommends calling identify on each page when the user is logged in
    if (isAuthenticated && user?.email) {
      identifyClarityUser(
        user.email,
        user.name || user.nickname || undefined,
      );
    }
  }, [location, posthog, isAuthenticated, user?.email, user?.name, user?.nickname]);

  return null;
}

export default PostHogPageViewTracker


