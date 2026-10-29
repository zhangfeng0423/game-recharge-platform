/**
 * Enhanced Safe Action Client with better error handling
 */

import { createSafeActionClient } from "next-safe-action";

export const actionClient = createSafeActionClient({
  handleServerError: (error) => {
    console.error("Action error:", error);
    return {
      message: "An unexpected error occurred",
    };
  },
});

export const actionClientWithMeta = createSafeActionClient({
  handleServerError: (error) => {
    console.error("Action error:", error);
    return {
      message: "An unexpected error occurred",
    };
  },
});
