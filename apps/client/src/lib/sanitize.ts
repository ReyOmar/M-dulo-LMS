import DOMPurify from 'dompurify';

/**
 * Restrictive DOMPurify configuration for LMS content.
 * Only allows safe HTML tags used in the rich text editor (Quill).
 * Blocks: forms, scripts, iframes, style tags, event handlers.
 */
const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: [
    // Block elements
    'p', 'div', 'br', 'hr',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'pre', 'code',
    // Inline formatting
    'b', 'i', 'u', 's', 'em', 'strong', 'sub', 'sup', 'mark', 'small', 'span',
    // Lists
    'ul', 'ol', 'li',
    // Links
    'a',
    // Media (images only)
    'img',
    // Tables
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  ],
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'title', 'alt',
    'src', 'width', 'height',
    'class', 'style',
    'colspan', 'rowspan', 'scope',
  ],
  ALLOW_DATA_ATTR: false,
  // Force all links to open in new tab with noopener
  ADD_ATTR: ['target'],
};

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Returns an object compatible with React's dangerouslySetInnerHTML.
 *
 * Uses a restrictive allowlist of tags and attributes suitable for
 * rich text content from the course editor.
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

  // Apply hook to force target="_blank" and rel="noopener noreferrer" on links
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });

  const clean = DOMPurify.sanitize(dirty, DOMPURIFY_CONFIG);

  // Remove the hook to avoid stacking on repeated calls
  DOMPurify.removeHook('afterSanitizeAttributes');

  return { __html: clean };
}
