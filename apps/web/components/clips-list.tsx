'use client';

import type { Clip } from '@wijzer/core';
import { useQuery } from 'convex/react';
import Link from 'next/link';
import { api } from '../../../convex/_generated/api';
import { clipDocToClip } from '@/lib/convex-clip';
import { isConvexEnabled } from '@/components/convex-client-provider';

export function ClipsList({ initialClips }: { initialClips: Clip[] }) {
  const liveDocs = useQuery(api.clips.list, isConvexEnabled() ? {} : 'skip');
  const clips =
    liveDocs !== undefined
      ? liveDocs.map(clipDocToClip)
      : initialClips;

  if (clips.length === 0) {
    return <p className="text-sm text-muted-foreground">No clips yet.</p>;
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {clips.map((clip) => (
        <li key={clip.id}>
          <Link
            href={`/clips/${clip.id}`}
            className="block px-4 py-3 hover:bg-muted/60"
          >
            <p className="font-medium">{clip.metadata.title.value}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {clip.url}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(clip.createdAt).toLocaleString()} · {clip.metadata.kind}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
