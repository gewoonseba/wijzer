'use client';

import type { Clip } from '@wijzer/core';
import { useQuery } from 'convex/react';
import Link from 'next/link';
import { api } from '../../../convex/_generated/api';
import { ClipMetadataPanel } from '@/components/clip-metadata';
import { SafeMarkdown } from '@/components/safe-markdown';
import { clipDocToClip } from '@/lib/convex-clip';
import { isConvexEnabled } from '@/components/convex-client-provider';

export function ClipDetailClient({
  publicId,
  initialClip,
}: {
  publicId: string;
  initialClip: Clip;
}) {
  const liveDoc = useQuery(
    api.clips.getByPublicId,
    isConvexEnabled() ? { publicId } : 'skip',
  );
  const clip =
    liveDoc !== undefined
      ? liveDoc
        ? clipDocToClip(liveDoc)
        : null
      : initialClip;

  if (!clip) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-sm text-muted-foreground">Clip not found.</p>
        <Link href="/" className="mt-4 inline-block text-sm underline">
          ← Back
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back
      </Link>

      <header className="mt-4 mb-6">
        <h1 className="text-2xl font-semibold">{clip.metadata.title.value}</h1>
        <a
          href={clip.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block truncate text-sm text-muted-foreground underline"
        >
          {clip.url}
        </a>
        {clip.finalUrl !== clip.url ? (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            Resolved: {clip.finalUrl}
          </p>
        ) : null}
      </header>

      <ClipMetadataPanel metadata={clip.metadata} />

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Clip
        </h2>
        <SafeMarkdown content={clip.content} />
      </section>

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Your notes
        </h2>
        <SafeMarkdown content={clip.notes} />
      </section>
    </main>
  );
}
