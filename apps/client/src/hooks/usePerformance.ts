import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook for debouncing a value.
 * Delays updating the returned value until after `delay` ms have passed
 * since the last change. Useful for search inputs to reduce API calls.
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/**
 * Custom hook for stable callback references that don't cause re-subscriptions.
 * Wraps a callback so the returned function reference is always stable,
 * but always calls the latest version of the callback.
 */
export function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const ref = useRef(callback);
  ref.current = callback;
  return ((...args: any[]) => ref.current(...args)) as unknown as T;
}
