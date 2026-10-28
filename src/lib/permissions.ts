/**
 * Permission utilities for role-based access control
 */

export type UserRole = "USER" | "MERCHANT" | "ADMIN";

export interface Permission {
  resource: string;
  action: string;
}

/**
 * Check if user has permission for specific action
 */
export function hasPermission(
  userRole: UserRole,
  resource: string,
  action: string,
): boolean {
  const permissions = getPermissionsForRole(userRole);
  return permissions.some(
    (p) => p.resource === resource && p.action === action,
  );
}

/**
 * Check admin permission
 */
export function checkAdminPermission(userRole: UserRole): boolean {
  return userRole === "ADMIN";
}

/**
 * Check merchant permission
 */
export function checkMerchantPermission(userRole: UserRole): boolean {
  return userRole === "MERCHANT" || userRole === "ADMIN";
}

/**
 * Verify game ownership for merchant
 */
export function verifyGameOwnership(
  merchantId: string,
  gameMerchantId: string,
  userRole: UserRole,
): boolean {
  if (userRole === "ADMIN") return true;
  return merchantId === gameMerchantId;
}

/**
 * Verify SKU ownership for merchant
 */
export function verifySkuOwnership(
  merchantId: string,
  gameMerchantId: string,
  userRole: UserRole,
): boolean {
  if (userRole === "ADMIN") return true;
  return merchantId === gameMerchantId;
}

/**
 * Get all permissions for a role
 */
function getPermissionsForRole(role: UserRole): Permission[] {
  switch (role) {
    case "ADMIN":
      return [
        { resource: "users", action: "read" },
        { resource: "users", action: "write" },
        { resource: "games", action: "read" },
        { resource: "games", action: "write" },
        { resource: "orders", action: "read" },
        { resource: "orders", action: "write" },
        { resource: "analytics", action: "read" },
      ];
    case "MERCHANT":
      return [
        { resource: "games", action: "read" },
        { resource: "games", action: "write" },
        { resource: "orders", action: "read" },
        { resource: "analytics", action: "read" },
      ];
    case "USER":
      return [
        { resource: "games", action: "read" },
        { resource: "orders", action: "read" },
      ];
    default:
      return [];
  }
}
