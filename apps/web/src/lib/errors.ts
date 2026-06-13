import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Base error class
// ---------------------------------------------------------------------------

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;

    // Maintain proper prototype chain in ES5 transpilation targets
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
    };
  }
}

// ---------------------------------------------------------------------------
// Specific error types
// ---------------------------------------------------------------------------

export class ValidationError extends AppError {
  public readonly fields?: Record<string, string[]>;

  constructor(
    message = 'Validation failed',
    fields?: Record<string, string[]>,
  ) {
    super(message, 'VALIDATION_ERROR', 422);
    this.fields = fields;
  }
}

export class AuthError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 'AUTH_ERROR', 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 'NOT_FOUND', 404);
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter?: number;

  constructor(retryAfter?: number) {
    super('Too many requests. Please slow down.', 'RATE_LIMIT_EXCEEDED', 429);
    this.retryAfter = retryAfter;
  }
}

export class AIError extends AppError {
  constructor(message = 'AI service encountered an error') {
    super(message, 'AI_ERROR', 503);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 'CONFLICT', 409);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable') {
    super(message, 'SERVICE_UNAVAILABLE', 503);
  }
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

// ---------------------------------------------------------------------------
// API error handler
// ---------------------------------------------------------------------------

/**
 * Converts any caught error into a structured NextResponse JSON error.
 * Safe to use in Next.js route handlers and server actions.
 */
export function handleAPIError(error: unknown): NextResponse {
  // Known application errors
  if (isAppError(error)) {
    const body: Record<string, unknown> = {
      success: false,
      error: {
        message: error.message,
        code: error.code,
      },
    };

    if (error instanceof ValidationError && error.fields) {
      body['error'] = {
        ...(body['error'] as object),
        fields: error.fields,
      };
    }

    if (error instanceof RateLimitError && error.retryAfter) {
      return NextResponse.json(body, {
        status: error.statusCode,
        headers: {
          'Retry-After': String(error.retryAfter),
          'X-RateLimit-Reset': String(error.retryAfter),
        },
      });
    }

    return NextResponse.json(body, { status: error.statusCode });
  }

  // Zod validation errors (duck-typed)
  if (
    error !== null &&
    typeof error === 'object' &&
    'issues' in error &&
    Array.isArray((error as { issues: unknown[] }).issues)
  ) {
    const zodError = error as { issues: Array<{ path: (string | number)[]; message: string }> };
    const fields: Record<string, string[]> = {};

    for (const issue of zodError.issues) {
      const key = issue.path.join('.') || 'root';
      if (!fields[key]) fields[key] = [];
      fields[key]!.push(issue.message);
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          fields,
        },
      },
      { status: 422 },
    );
  }

  // Prisma unique constraint violation
  if (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  ) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'A record with this information already exists.',
          code: 'CONFLICT',
        },
      },
      { status: 409 },
    );
  }

  // Prisma not-found
  if (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: string }).code === 'P2025'
  ) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'The requested record was not found.',
          code: 'NOT_FOUND',
        },
      },
      { status: 404 },
    );
  }

  // Generic / unknown errors — never leak stack traces in production
  console.error('[AppError] Unhandled error in route handler:', error);

  return NextResponse.json(
    {
      success: false,
      error: {
        message:
          process.env.NODE_ENV === 'development' && error instanceof Error
            ? error.message
            : 'An unexpected error occurred. Please try again.',
        code: 'INTERNAL_SERVER_ERROR',
      },
    },
    { status: 500 },
  );
}
