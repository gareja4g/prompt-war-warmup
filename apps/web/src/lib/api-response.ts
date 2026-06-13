import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Success response
// ---------------------------------------------------------------------------

/**
 * Returns a JSON success response.
 *
 * @example
 * return successResponse({ user }, 201);
 */
export function successResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

// ---------------------------------------------------------------------------
// Error response
// ---------------------------------------------------------------------------

/**
 * Returns a JSON error response.
 *
 * @example
 * return errorResponse('Email already in use', 409, 'CONFLICT');
 */
export function errorResponse(
  message: string,
  status = 400,
  code?: string,
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        ...(code ? { code } : {}),
      },
    },
    { status },
  );
}

// ---------------------------------------------------------------------------
// Paginated response
// ---------------------------------------------------------------------------

/**
 * Returns a paginated JSON response with metadata.
 *
 * @example
 * return paginatedResponse(entries, 150, 2, 20);
 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): NextResponse {
  const totalPages = Math.ceil(total / pageSize);
  const hasMore = page * pageSize < total;

  return NextResponse.json({
    success: true,
    data,
    pagination: {
      total,
      page,
      pageSize,
      totalPages,
      hasMore,
    },
  });
}

// ---------------------------------------------------------------------------
// No-content response
// ---------------------------------------------------------------------------

/**
 * Returns a 204 No Content response for DELETE operations.
 */
export function noContentResponse(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

// ---------------------------------------------------------------------------
// Created response
// ---------------------------------------------------------------------------

/**
 * Returns a 201 Created response.
 */
export function createdResponse<T>(data: T): NextResponse {
  return successResponse(data, 201);
}
