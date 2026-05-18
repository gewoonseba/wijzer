import { NotFoundError } from '@wijzer/core';
import { getClipRepository } from '@/lib/clip-store';
import { errorResponse } from '@/lib/api-error';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const clip = await getClipRepository().getById(id);

    if (!clip) {
      throw new NotFoundError('Clip not found');
    }

    return Response.json(clip);
  } catch (error) {
    return errorResponse(error);
  }
}
