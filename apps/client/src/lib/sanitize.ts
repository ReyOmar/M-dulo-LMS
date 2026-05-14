import DOMPurify from 'dompurify';

/**
 * Restrictive DOMPurify configuration for LMS content.
 * Only allows safe HTML tags used in the rich text editor (Quill).
 * Blocks: forms, scripts, iframes, style tags, event handlers.
 */
const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: [
    // Block elements
    'p',
    'div',
    'br',
    'hr',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'blockquote',
    'pre',
    'code',
    // Inline formatting
    'b',
    'i',
    'u',
    's',
    'em',
    'strong',
    'sub',
    'sup',
    'mark',
    'small',
    'span',
    // Lists
    'ul',
    'ol',
    'li',
    // Links
    'a',
    // Media (images only)
    'img',
    // Tables
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'th',
    'td',
    'caption',
    'colgroup',
    'col',
  ],
  ALLOWED_ATTR: [
    'href',
    'target',
    'rel',
    'title',
    'alt',
    'src',
    'width',
    'height',
    'class',
    // F5.6: 'style' handled via hook sanitization below
    'colspan',
    'rowspan',
    'scope',
  ],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ['target'],
  // F5.6: Block protocols that could be abused
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
};

// F5.6: CSS properties that are safe for rich text styling
const SAFE_CSS_PROPS =
  /^(color|background-color|font-size|font-weight|font-style|text-align|text-decoration|margin|padding|border|line-height|display|width|height|max-width|min-height)$/i;
const DANGEROUS_CSS_VALUES = /expression|url\s*\(|javascript:|behavior|moz-binding|-o-link/i;

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
    // F5.6: Sanitize inline styles — only allow safe CSS properties
    if (node.hasAttribute && node.hasAttribute('style')) {
      const style = node.getAttribute('style') || '';
      if (DANGEROUS_CSS_VALUES.test(style)) {
        node.removeAttribute('style');
      } else {
        const safeParts = style
          .split(';')
          .map((s) => s.trim())
          .filter((s) => {
            const [prop] = s.split(':');
            return prop && SAFE_CSS_PROPS.test(prop.trim());
          });
        if (safeParts.length > 0) {
          node.setAttribute('style', safeParts.join('; '));
        } else {
          node.removeAttribute('style');
        }
      }
    }
  });

  const clean = DOMPurify.sanitize(dirty, {
    ...DOMPURIFY_CONFIG,
    ALLOWED_ATTR: [...DOMPURIFY_CONFIG.ALLOWED_ATTR, 'style'],
  });

  // Remove the hook to avoid stacking on repeated calls
  DOMPurify.removeHook('afterSanitizeAttributes');

  return { __html: clean };
}
