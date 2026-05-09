'use client';

import { useRouteGuard } from '@/hooks/useRouteGuard';
import { PageLoader } from '@/components/ui/PageLoader';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { allowed } = useRouteGuard();

  if (!allowed) {
    return <PageLoader message="Redirigiendo..." />;
  }

  return <>{children}</>;
}
