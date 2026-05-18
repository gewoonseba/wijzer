import { createClipFromUrl } from '@wijzer/ai';
import { createClipRequestSchema } from '@wijzer/core';
import { getClipRepository } from '@/lib/clip-store';
import { errorResponse, logWijzerApiError } from '@/lib/api-error';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET() {
  const clips = await getClipRepository().list();
  return Response.json({ clips });
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      logWijzerApiError(400, 'INVALID_JSON', 'Request body is not valid JSON');
      return Response.json(
        { error: 'Invalid JSON body', code: 'INVALID_JSON' },
        { status: 400 },
      );
    }

    const parsed = createClipRequestSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const detail = issue
        ? `${issue.path.join('.') || 'body'}: ${issue.message}`
        : 'Request body failed validation';
      logWijzerApiError(400, 'VALIDATION_ERROR', detail, {
        issueCount: String(parsed.error.issues.length),
      });
      return Response.json(
        { error: 'Invalid request body', code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }

    const clipInput = await createClipFromUrl({
      url: parsed.data.url,
      notes: parsed.data.notes,
    });

    const clip = await getClipRepository().create(clipInput);

    return Response.json(clip, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
