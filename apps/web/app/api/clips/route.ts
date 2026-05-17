import { createClipFromUrl } from '@wijzer/ai';
import { createClipRequestSchema } from '@wijzer/core';
import { getClipRepository } from '@wijzer/db';
import { errorResponse } from '@/lib/api-error';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET() {
  const clips = await getClipRepository().list();
  return Response.json({ clips });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createClipRequestSchema.safeParse(body);

    if (!parsed.success) {
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
