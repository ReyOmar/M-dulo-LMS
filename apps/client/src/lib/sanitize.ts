import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Returns an object compatible with React's dangerouslySetInnerHTML.
 *
 * @param dirty - Raw HTML string from the server
 * @returns Sanitized HTML object for use with dangerouslySetInnerHTML
 *
 * @example
 * <div dangerouslySetInnerHTML={sanitizeHTML(content)} />
 */
export function sanitizeHTML(dirty: string): { __html: string } {
  if (typeof window === 'undefined') {
    // SSR fallback — strip all tags
    return { __html: dirty.replace(/<[^>]*>/g, '') };
  }
  return { __html: DOMPurify.sanitize(dirty) };
}
