import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { sanitizeUrlForLogs } from '../utils/sanitize-url.util';

/**
 * Global exception filter that catches ALL unhandled exceptions and returns
 * a consistent JSON response format. Replaces the default NestJS error handler
 * which can leak stack traces or return HTML in production.
 *
 * Response format:
 * {
 *   statusCode: number,
 *   error: string,
 *   message: string,
 *   timestamp: string
 * }
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Ha ocurrido un error interno. Inténtalo de nuevo más tarde.';
    let error = 'Internal Server Error';

    // SEC: Sanitize URL before any logging to prevent token leakage
    const safeUrl = sanitizeUrlForLogs(request?.url || '');

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, any>;
        // Handle class-validator array messages
        if (Array.isArray(resp.message)) {
          message = resp.message.join('. ');
        } else {
          message = resp.message || message;
        }
        error = resp.error || error;
      }
    } else if (exception instanceof Error) {
      // Unexpected errors — log full stack but don't expose to client
      this.logger.error(
        `Unhandled exception on ${request.method} ${safeUrl}: ${exception.message}`,
        exception.stack,
      );
    } else {
      this.logger.error(`Unknown exception type on ${request.method} ${safeUrl}:`, exception);
    }

    // Extract correlation ID from request if available
    const requestId = request?.id || request?.headers?.['x-request-id'] || undefined;

    const responseBody = {
      statusCode: status,
      error,
      message,
      timestamp: new Date().toISOString(),
      ...(requestId && { requestId }),
    };

    // Only log non-4xx errors as errors (4xx are client errors, expected)
    if (status >= 500) {
      this.logger.error(`[${status}] ${request.method} ${safeUrl} — ${message}${requestId ? ` [${requestId}]` : ''}`);
    }

    response.status(status).send(responseBody);
  }
}
