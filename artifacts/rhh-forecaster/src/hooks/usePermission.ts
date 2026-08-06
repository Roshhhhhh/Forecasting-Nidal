import { useGetMe } from "@workspace/api-client-react";
import type { AuthUser } from "@workspace/api-client-react";

/**
 * The /api/auth/me response extends AuthUser with server-side permission data.
 * The generated AuthUser schema omits these fields, so we extend it here.
 */
type AuthUserWithPermissions = AuthUser & {
  roleId: number | null;
  permissions: string[];
};

/**
 * Returns true if the current user has the given permission key.
 * While the session is loading, returns false (safe default — hides actions).
 */
export function usePermission(key: string): boolean {
  const { data: me } = useGetMe();
  return (me as AuthUserWithPermissions | undefined)?.permissions?.includes(key) ?? false;
}

/**
 * Returns the full permissions array for the current user.
 */
export function usePermissions(): string[] {
  const { data: me } = useGetMe();
  return (me as AuthUserWithPermissions | undefined)?.permissions ?? [];
}
