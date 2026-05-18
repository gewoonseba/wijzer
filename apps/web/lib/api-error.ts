import { GatewayError } from '@ai-sdk/gateway';
import { WijzerError } from '@wijzer/core';

const GENERIC_INTERNAL_MESSAGE = 'An unexpected error occurred. Please try again.';
const LOG_PREFIX = '[wijzer:api]';

function formatExtra(extra?: Record<string, string>): string {
  if (!extra || Object.keys(extra).length === 0) {
    return '';
  }
  return (
    ' | ' +
    Object.entries(extra)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ')
  );
}

/**
 * Structured stderr line for API failures. Shows up in the terminal running
 * `next dev` / Node — not in the browser DevTools console.
 */
export function logWijzerApiError(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, string>,
): void {
  console.error(
    `${LOG_PREFIX} ${status} | ${code} | ${message}${formatExtra(extra)}`,
  );
}

function logInternalWithOptionalStack(
  status: number,
  code: string,
  message: string,
  err: unknown,
): void {
  logWijzerApiError(status, code, message);
  if (
    process.env.NODE_ENV === 'development' &&
    err instanceof Error &&
    err.stack
  ) {
    console.error(err.stack);
  }
}

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
    const status = httpStatusFromGatewayError(error);
    logWijzerApiError(status, 'AI_GATEWAY_ERROR', error.message, {
      gatewayType: error.type,
    });
    return Response.json(
      {
        error: error.message,
        code: 'AI_GATEWAY_ERROR',
        gatewayType: error.type,
        retryable: error.isRetryable,
      },
      { status },
    );
  }

  if (error instanceof WijzerError) {
    logWijzerApiError(error.statusCode, error.code, error.message);
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.statusCode },
    );
  }

  if (error instanceof Error) {
    logInternalWithOptionalStack(500, 'INTERNAL_ERROR', error.message, error);
    return Response.json(
      { error: GENERIC_INTERNAL_MESSAGE, code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }

  logWijzerApiError(500, 'INTERNAL_ERROR', String(error));
  return Response.json(
    { error: GENERIC_INTERNAL_MESSAGE, code: 'INTERNAL_ERROR' },
    { status: 500 },
  );
}
