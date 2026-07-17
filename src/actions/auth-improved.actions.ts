"use server";

import { getCurrentUser } from "./auth.actions";

/**
 * Compatibility helpers used by the authentication test suite and callers
 * that need a normalized authentication status response.
 */
export async function getCurrentUserImproved() {
  return getCurrentUser();
}

export async function checkAuthStatus() {
  const user = await getCurrentUserImproved();

  return {
    authenticated: user !== null,
    user,
    timestamp: new Date().toISOString(),
  };
}
