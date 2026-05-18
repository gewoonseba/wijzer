export class WijzerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = 'WijzerError';
  }
}

export class InvalidUrlError extends WijzerError {
  constructor(message = 'Invalid or blocked URL') {
    super(message, 'INVALID_URL', 400);
    this.name = 'InvalidUrlError';
  }
}

export class UnsupportedContentTypeError extends WijzerError {
  constructor(message = 'Unsupported content type') {
    super(message, 'UNSUPPORTED_CONTENT_TYPE', 415);
    this.name = 'UnsupportedContentTypeError';
  }
}

export class ExtractionError extends WijzerError {
  constructor(message: string, code = 'EXTRACTION_FAILED') {
    super(message, code, 422);
    this.name = 'ExtractionError';
  }
}

export class UpstreamFetchError extends WijzerError {
  constructor(message = 'Failed to fetch remote content') {
    super(message, 'UPSTREAM_FETCH', 502);
    this.name = 'UpstreamFetchError';
  }
}

export class ClipTimeoutError extends WijzerError {
  constructor(message = 'Clip creation timed out') {
    super(message, 'TIMEOUT', 504);
    this.name = 'ClipTimeoutError';
  }
}

export class NotFoundError extends WijzerError {
  constructor(message = 'Not found') {
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}
