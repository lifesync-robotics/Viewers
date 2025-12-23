/**
 * Get Stage from Route Utility
 * 
 * Maps routes to stage IDs based on workflow-config.yaml
 * This ensures modes NEVER hardcode stage names
 */

import { getWorkflowConfig } from '../config';

/**
 * Get stage ID for the current route
 * Reads from workflow-config.yaml - NO HARDCODING!
 * 
 * @param route - Current route path (e.g., '/segmentation', '/planner')
 * @returns Stage ID from config, or null if not found
 */
export function getStageFromRoute(route: string): string | null {
  try {
    const configLoader = getWorkflowConfig();
    const stages = configLoader.getStages();
    
    // Normalize route (remove leading slash if present)
    const normalizedRoute = route.startsWith('/') ? route : `/${route}`;
    
    // Find stage by matching route
    const stage = stages.find(s => s.route === normalizedRoute);
    
    if (!stage) {
      console.warn(`⚠️ [getStageFromRoute] No stage found for route: ${route}`);
      return null;
    }
    
    console.log(`✅ [getStageFromRoute] Route ${route} → Stage ${stage.id}`);
    return stage.id;
  } catch (error) {
    console.error(`❌ [getStageFromRoute] Error mapping route to stage:`, error);
    return null;
  }
}

/**
 * Get current stage from window.location
 * Convenience function that uses current URL pathname
 * 
 * @returns Stage ID for current route, or null
 */
export function getCurrentStageFromURL(): string | null {
  const pathname = window.location.pathname;
  
  // Extract the main route segment (e.g., /segmentation from /segmentation?params)
  const routeMatch = pathname.match(/^\/([^\/\?]+)/);
  const route = routeMatch ? `/${routeMatch[1]}` : pathname;
  
  return getStageFromRoute(route);
}

/**
 * Get stage ID by checking both config and current URL
 * Use this in mode onModeEnter hooks
 * 
 * @param fallbackRoute - Optional fallback route if URL detection fails
 * @returns Stage ID
 */
export function getStageForMode(fallbackRoute?: string): string | null {
  // Try to get from current URL first
  let stageId = getCurrentStageFromURL();
  
  // If URL didn't work and fallback provided, try that
  if (!stageId && fallbackRoute) {
    stageId = getStageFromRoute(fallbackRoute);
  }
  
  return stageId;
}

