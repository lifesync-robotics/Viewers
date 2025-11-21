/**
 * API Configuration Utility
 * Phase 4: Centralized API URL management
 * 
 * Uses webpack dev server proxy in development (relative paths)
 * Can be configured for production deployment
 */

/**
 * Get the base URL for SyncForge API
 * 
 * In development (webpack dev server):
 *   - Returns empty string '' to use relative paths
 *   - webpack proxy routes /api/* to localhost:3001
 * 
 * In production:
 *   - Can be configured via window.config.syncforge.apiUrl
 *   - Defaults to same origin (relative paths)
 */
export function getApiBaseUrl(): string {
  // Check for explicit configuration
  const globalConfig = (window as any).config || {};
  const configuredUrl = globalConfig.syncforge?.apiUrl;
  
  if (configuredUrl) {
    return configuredUrl;
  }
  
  // Default: use relative paths (works with webpack proxy and production)
  return '';
}

/**
 * Construct full API endpoint URL
 * @param path - API path (e.g., '/api/tracking/config')
 * @returns Full URL
 */
export function getApiUrl(path: string): string {
  const base = getApiBaseUrl();
  
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  // If base is empty, just return path (relative)
  if (!base) {
    return normalizedPath;
  }
  
  // Otherwise concatenate
  return `${base}${normalizedPath}`;
}

/**
 * Construct WebSocket URL for tracking
 * @param path - WebSocket path (e.g., '/ws/tracking')
 * @returns Full WebSocket URL
 */
export function getWsUrl(path: string): string {
  const base = getApiBaseUrl();
  
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  if (!base) {
    // Relative URL - determine protocol from current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}${normalizedPath}`;
  }
  
  // Convert HTTP/HTTPS to WS/WSS
  const wsBase = base
    .replace(/^http:/, 'ws:')
    .replace(/^https:/, 'wss:');
    
  return `${wsBase}${normalizedPath}`;
}

