/**
 * Compatibility shim.
 *
 * The real implementation now lives in `src/lib/auth/*`. This module re-exports
 * it so any older import path keeps working. New code should import from
 * `@/lib/auth/guard`, `@/lib/auth/session` and `@/lib/auth/users` directly.
 */

export {
  getCurrentUser,
  hasRole,
  requireApiUser,
  requirePageUser,
  authenticationRequired,
  unauthenticated,
  forbidden,
} from "@/lib/auth/guard";

export type { Role, SessionUser } from "@/lib/auth/session";
