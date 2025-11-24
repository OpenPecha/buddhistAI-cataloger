/**
 * Centralized API configuration
 * 
 * Development: Uses /api proxy (configured in vite.config.ts)
 * Production: 
 *   - Default: Uses /api (requires server-side proxy configuration)
 *   - If VITE_SERVER_URL is set and VITE_USE_DIRECT_URL=true: Uses VITE_SERVER_URL directly
 * 
 * For Render: Configure redirects/rewrites in Render dashboard to proxy /api/* to your backend service
 */
export const API_URL = import.meta.env.DEV 
  ? '/api'  // Use proxy in development
  : (import.meta.env.VITE_USE_DIRECT_URL === 'true' && import.meta.env.VITE_SERVER_URL
      ? import.meta.env.VITE_SERVER_URL  // Use direct URL if explicitly enabled
      : '/api');  // Default to /api in production (requires server proxy config)

