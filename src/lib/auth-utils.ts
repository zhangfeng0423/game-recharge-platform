/**
 * Authentication utilities for client-side auth management
 */

/**
 * Force clear auth cache on client side
 */
export function forceClearAuthCacheClient(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("supabase.auth.token");
    sessionStorage.removeItem("supabase.auth.token");
  }
}

/**
 * Check if user has test session (development helper)
 */
export function hasTestUserSession(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const testToken = localStorage.getItem("test-user-token");
    return !!testToken;
  } catch {
    return false;
  }
}
