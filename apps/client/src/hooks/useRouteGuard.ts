'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useRole, Role } from '@/contexts/RoleContext';

/**
 * Route access control map.
 * Each key is a dashboard path prefix, and the value is the set of roles allowed.
 * Routes not listed here are accessible to all authenticated users.
 */
const ROUTE_PERMISSIONS: Record<string, Role[]> = {
  '/dashboard/admin': ['admin'],
  '/dashboard/examiner': ['admin', 'teacher'],
  '/dashboard/student': ['admin', 'student'],
  '/dashboard/mensajes': ['admin', 'teacher', 'student'],
};

/**
 * Role-based route guard hook.
 *
 * Reads the user's real role from RoleContext and checks it against
 * ROUTE_PERMISSIONS. If the user doesn't have access, they are
 * redirected to their default dashboard.
 *
 * Admin users have access to ALL routes (super-admin pattern).
 *
 * @returns { allowed: boolean } - Whether the current user is allowed on this route
 */
export function useRouteGuard(): { allowed: boolean } {
  const { role, user } = useRole();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!user || !pathname) return;

    // Find the matching permission entry (longest prefix match)
    const matchingPrefix = Object.keys(ROUTE_PERMISSIONS)
      .filter((prefix) => pathname.startsWith(prefix))
      .sort((a, b) => b.length - a.length)[0];

    if (!matchingPrefix) return; // No restriction on this route

    const allowedRoles = ROUTE_PERMISSIONS[matchingPrefix];
    if (!allowedRoles.includes(role)) {
      // Redirect to the user's default dashboard
      const defaultRoutes: Record<Role, string> = {
        admin: '/dashboard',
        teacher: '/dashboard',
        student: '/dashboard',
      };
      router.replace(defaultRoutes[role]);
    }
  }, [role, user, pathname, router]);

  // Check if current route is allowed (synchronous for conditional rendering)
  if (!pathname) return { allowed: true };

  const matchingPrefix = Object.keys(ROUTE_PERMISSIONS)
    .filter((prefix) => pathname.startsWith(prefix))
    .sort((a, b) => b.length - a.length)[0];

  if (!matchingPrefix) return { allowed: true };

  return { allowed: ROUTE_PERMISSIONS[matchingPrefix].includes(role) };
}
