import Link from 'next/link';
import { ClipForm } from '@/components/clip-form';
import { getClipRepository } from '@wijzer/db';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const clips = await getClipRepository().list();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Wijzer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a link and your notes — we clip and summarize it for you.
        </p>
      </header>

      <section className="mb-12">
        <ClipForm />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Recent clips
        </h2>
        {clips.length === 0 ? (
          <p className="text-sm text-muted-foreground">No clips yet.</p>
        ) : (
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
                    {new Date(clip.createdAt).toLocaleString()} ·{' '}
                    {clip.metadata.kind}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
