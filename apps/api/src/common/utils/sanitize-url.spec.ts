import { sanitizeUrlForLogs } from './sanitize-url.util';

describe('sanitizeUrlForLogs', () => {
  it('should redact token parameter', () => {
    const url = '/api/storage/download/private/file.pdf?token=eyJhbGciOiJIUzI1NiJ9.long.jwt';
    const result = sanitizeUrlForLogs(url);
    expect(result).not.toContain('eyJ');
    expect(result).toContain('token=');
    // URL API encodes brackets: [REDACTED] → %5BREDACTED%5D
    expect(result).toMatch(/token=%5BREDACTED%5D|token=\[REDACTED\]/);
  });

  it('should redact access_token parameter', () => {
    const url = '/ws?access_token=secret123&other=keep';
    const result = sanitizeUrlForLogs(url);
    expect(result).not.toContain('secret123');
    expect(result).toContain('other=keep');
  });

  it('should redact authorization parameter', () => {
    const url = '/api/auth?authorization=Bearer%20abc123';
    const result = sanitizeUrlForLogs(url);
    expect(result).not.toContain('abc123');
  });

  it('should redact code parameter', () => {
    const url = '/api/callback?code=auth_code_123&state=valid';
    const result = sanitizeUrlForLogs(url);
    expect(result).not.toContain('auth_code_123');
    expect(result).toContain('state=valid');
  });

  it('should redact secret parameter', () => {
    const url = '/api/webhook?secret=webhook_secret_abc';
    const result = sanitizeUrlForLogs(url);
    expect(result).not.toContain('webhook_secret_abc');
  });

  it('should leave safe URLs unchanged', () => {
    const url = '/api/cursos/abc123?page=1&limit=20';
    expect(sanitizeUrlForLogs(url)).toBe(url);
  });

  it('should handle URLs with no query params', () => {
    const url = '/api/health';
    expect(sanitizeUrlForLogs(url)).toBe(url);
  });

  it('should handle multiple sensitive params at once', () => {
    const url = '/api/endpoint?token=aaa&code=bbb&safe=keep';
    const result = sanitizeUrlForLogs(url);
    expect(result).toContain('safe=keep');
    expect(result).not.toContain('=aaa');
    expect(result).not.toContain('=bbb');
  });

  it('should handle empty string', () => {
    expect(sanitizeUrlForLogs('')).toBe('');
  });
});
