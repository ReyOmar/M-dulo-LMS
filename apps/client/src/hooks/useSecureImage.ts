'use client';

import { useState, useEffect } from 'react';

/**
 * Hook that loads a private image using fetch() + Authorization header
 * and returns a blob: URL safe for <img src>.
 *
 * This avoids exposing the JWT token in the URL (query string),
 * which would leak it in browser history, server logs, referer headers, etc.
 *
 * @param fileRef - Storage key (e.g. 'firmas/abc123.png') or full URL
 * @returns { src, loading, error } — src is null until loaded
 */
export function useSecureImage(fileRef: string | null | undefined) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileRef) {
      setSrc(null);
      return;
    }

    // External URLs don't need auth — use directly
    if (fileRef.startsWith('http://') || fileRef.startsWith('https://')) {
      setSrc(fileRef);
      return;
    }

    let revoked = false;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3200/api';
    const url = `${apiUrl}/storage/download/${fileRef}`;
    const token = localStorage.getItem('lms_token');

    if (!token) {
      setError('No authentication token');
      return;
    }

    setLoading(true);
    setError(null);

    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (revoked) return;
        const objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch((err) => {
        if (revoked) return;
        setError(err.message);
        setSrc(null);
      })
      .finally(() => {
        if (!revoked) setLoading(false);
      });

    return () => {
      revoked = true;
      // Clean up blob URL to prevent memory leaks
      setSrc((prev) => {
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [fileRef]);

  return { src, loading, error };
}
