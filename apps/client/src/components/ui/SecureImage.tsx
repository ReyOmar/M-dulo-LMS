'use client';

import { useSecureImage } from '@/hooks/useSecureImage';
import { Loader2 } from 'lucide-react';

interface SecureImageProps {
  fileRef: string | null | undefined;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}

/**
 * Renders a private image by fetching it with Authorization header.
 * Uses blob: URL internally — never exposes JWT in <img src> URL.
 */
export function SecureImage({ fileRef, alt, className, fallback }: SecureImageProps) {
  const { src, loading, error } = useSecureImage(fileRef);

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${className || ''}`}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !src) {
    return fallback ? <>{fallback}</> : null;
  }

  return <img src={src} alt={alt} className={className} />;
}
