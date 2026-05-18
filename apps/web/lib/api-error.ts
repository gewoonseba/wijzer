import { GatewayError } from '@ai-sdk/gateway';
import { WijzerError } from '@wijzer/core';

const GENERIC_INTERNAL_MESSAGE = 'An unexpected error occurred. Please try again.';

function httpStatusFromGatewayError(error: GatewayError): number {
  const code = error.statusCode;
  if (code === 401 || code === 403 || code === 429) {
    return code;
  }
  if (code === 408) {
    return 504;
  }
  if (code >= 400 && code < 500) {
    return 502;
  }
  return 502;
}

export function errorResponse(error: unknown): Response {
  if (GatewayError.isInstance(error)) {
    return Response.json(
      {
        error: error.message,
        code: 'AI_GATEWAY_ERROR',
        gatewayType: error.type,
        retryable: error.isRetryable,
      },
      { status: httpStatusFromGatewayError(error) },
    );
  }

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
