import { notFound } from 'next/navigation';
import { ClipDetailClient } from '@/components/clip-detail-client';
import { getClipRepository } from '@/lib/clip-store';

export const dynamic = 'force-dynamic';

export default async function ClipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const clip = await getClipRepository().getById(id);

  if (!clip) {
    notFound();
  }

  return <ClipDetailClient publicId={id} initialClip={clip} />;
}
