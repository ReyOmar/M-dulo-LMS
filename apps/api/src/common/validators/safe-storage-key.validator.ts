import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

/**
 * Custom class-validator decorator that rejects path traversal, absolute paths,
 * null bytes, and other dangerous patterns in storage file key fields.
 *
 * Use on any DTO field that represents a file path or storage key (e.g. logo_url,
 * firma_url, imagen_portada, favicon_url, login_fondo_url, url_archivo, etc.)
 *
 * Allows:
 * - null/undefined (for optional fields)
 * - Valid storage keys: "folder/filename.ext" or "filename.ext"
 * - Empty string (to clear a field)
 *
 * Rejects:
 * - Path traversal (../, ..\)
 * - Absolute paths (/etc, C:\)
 * - Null bytes
 * - HTML/script injection
 */
export function IsSafeStorageKey(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isSafeStorageKey',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} contiene caracteres o patrones no permitidos.`,
        ...validationOptions,
      },
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          // Allow null/undefined (handled by @IsOptional)
          if (value === null || value === undefined || value === '') return true;
          if (typeof value !== 'string') return false;

          // Block null bytes
          if (value.includes('\0')) return false;

          // Block path traversal
          if (value.includes('..')) return false;

          // Block absolute paths (Unix and Windows)
          if (/^[/\\]/.test(value)) return false;
          if (/^[A-Za-z]:[/\\]/.test(value)) return false;

          // Block HTML/script injection
          if (/<script/i.test(value)) return false;
          if (/javascript:/i.test(value)) return false;

          // Block suspicious protocols
          if (/^(data|blob|vbscript):/i.test(value)) return false;

          return true;
        },
      },
    });
  };
}
