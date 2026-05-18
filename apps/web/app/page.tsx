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
        <p className="mt-1 text-sm text-[var(--muted)]">
          Paste a link and your notes — we clip and summarize it for you.
        </p>
      </header>

      <section className="mb-12">
        <ClipForm />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
          Recent clips
        </h2>
        {clips.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No clips yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
            {clips.map((clip) => (
              <li key={clip.id}>
                <Link
                  href={`/clips/${clip.id}`}
                  className="block px-4 py-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                >
                  <p className="font-medium">{clip.metadata.title.value}</p>
                  <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                    {clip.url}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
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
