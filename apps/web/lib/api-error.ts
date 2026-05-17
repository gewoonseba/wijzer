import { WijzerError } from '@wijzer/core';

const GENERIC_INTERNAL_MESSAGE = 'An unexpected error occurred. Please try again.';

export function errorResponse(error: unknown): Response {
  if (error instanceof WijzerError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.statusCode },
    );
  }

  if (error instanceof Error) {
    console.error('[wijzer] Unhandled error:', error);
    return Response.json(
      { error: GENERIC_INTERNAL_MESSAGE, code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }

  console.error('[wijzer] Unknown error:', error);
  return Response.json(
    { error: GENERIC_INTERNAL_MESSAGE, code: 'INTERNAL_ERROR' },
    { status: 500 },
  );
}
