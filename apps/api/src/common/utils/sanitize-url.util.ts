/**
 * Centralized URL sanitization for logging.
 * Redacts sensitive query parameters to prevent token leakage in logs.
 *
 * @param url - The raw request URL (may contain query params with tokens)
 * @returns Sanitized URL safe for logging
 */
const SENSITIVE_PARAMS = ['token', 'authorization', 'access_token', 'code', 'secret'];

export function sanitizeUrlForLogs(url: string): string {
  try {
    const urlObj = new URL(url, 'http://localhost');
    let hadSensitive = false;
    for (const param of SENSITIVE_PARAMS) {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.set(param, '[REDACTED]');
        hadSensitive = true;
      }
    }
    if (hadSensitive) {
      return urlObj.pathname + urlObj.search;
    }
  } catch {
    // If URL parsing fails, do a regex fallback to catch obvious tokens
    return url.replace(/([?&])(token|authorization|access_token|code|secret)=[^&]*/gi, '$1$2=[REDACTED]');
  }
  return url;
}
