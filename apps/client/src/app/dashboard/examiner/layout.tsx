'use client';

import { useRouteGuard } from '@/hooks/useRouteGuard';
import { PageLoader } from '@/components/ui/PageLoader';

export default function ExaminerLayout({ children }: { children: React.ReactNode }) {
  const { allowed } = useRouteGuard();

  if (!allowed) {
    return <PageLoader message="Redirigiendo..." />;
  }

  return <>{children}</>;
}
