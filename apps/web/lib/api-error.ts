import { WijzerError } from '@wijzer/core';

export function errorResponse(error: unknown): Response {
  if (error instanceof WijzerError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.statusCode },
    );
  }

  if (error instanceof Error) {
    return Response.json(
      { error: error.message, code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }

  return Response.json(
    { error: 'Unknown error', code: 'INTERNAL_ERROR' },
    { status: 500 },
  );
}
