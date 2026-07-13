import { usePostHog } from 'posthog-js/react';
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom';
import { trackClarityEvent } from '@/lib/clarity';

function PostHogPageViewTracker() {
const location=useLocation();
const posthog=usePostHog()

useEffect(()=>{
if(posthog){
    posthog.capture('$pageview')
}
// Track page view in Clarity
trackClarityEvent('page_view', { path: location.pathname })
},[location,posthog])

    return null;
}

export default PostHogPageViewTracker


