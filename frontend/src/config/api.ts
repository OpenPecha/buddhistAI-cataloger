/**
 * Centralized API configuration
 * Uses proxy in development (via vite.config.ts) and direct URL in production
 */
export const API_URL = import.meta.env.DEV 
  ? '/api'  // Use proxy in development
  : (import.meta.env.VITE_SERVER_URL || 'http://localhost:8000');  // Use direct URL in production

