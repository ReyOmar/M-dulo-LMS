/**
 * Runtime environment validation for the client.
 * Validates that required environment variables are set and have valid formats.
 * Called once at app startup to fail fast with clear error messages.
 */

const requiredVars = [
  'NEXT_PUBLIC_API_URL',
] as const;

function validateUrl(value: string, name: string): void {
  try {
    new URL(value);
  } catch {
    throw new Error(
      `❌ ENV ERROR: ${name}="${value}" is not a valid URL. ` +
      `Expected format: http://localhost:3200/api or https://your-domain.com/api`
    );
  }
}

export function validateEnv(): { apiUrl: string } {
  const missing = requiredVars.filter(
    (key) => !process.env[key]
  );

  if (missing.length > 0) {
    console.warn(
      `⚠️ Missing environment variables: ${missing.join(', ')}. ` +
      `Using default values. Set them in .env for production.`
    );
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3200/api';

  // Validate URL format (catches typos, dead tunnels, etc.)
  validateUrl(apiUrl, 'NEXT_PUBLIC_API_URL');

  return { apiUrl };
}

// Singleton — validated once, reused everywhere
let _env: ReturnType<typeof validateEnv> | null = null;

export function getEnv() {
  if (!_env) {
    _env = validateEnv();
  }
  return _env;
}
