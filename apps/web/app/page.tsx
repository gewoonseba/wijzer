import { ClipForm } from '@/components/clip-form';
import { ClipsList } from '@/components/clips-list';
import { getClipRepository } from '@/lib/clip-store';

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
        <ClipsList initialClips={clips} />
      </section>
    </main>
  );
}
