// src/admin/auth/roleTools.ts
// ✅ type-only import so it's erased at runtime
import type { Role } from '../../auth/store';

type RoleLike = Role | string;

export const hasRole = (
  role: RoleLike | undefined,
  targets: (RoleLike | RegExp | string)[]
) => {
  if (!role) return false;
  return targets.some((t) => {
    if (t instanceof RegExp) return t.test(role);
    return t === role;
  });
};
