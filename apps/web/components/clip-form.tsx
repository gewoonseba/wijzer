'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ClipForm() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, notes }),
      });

      const data = (await res.json()) as { id?: string; error?: string };

      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }

      if (data.id) {
        router.push(`/clips/${data.id}`);
        router.refresh();
      }
    } catch {
      setError('Network error — could not create clip');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="url" className="mb-1 block text-sm font-medium">
          URL
        </label>
        <input
          id="url"
          type="url"
          required
          placeholder="https://..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
      </div>

      <div>
        <label htmlFor="notes" className="mb-1 block text-sm font-medium">
          Notes <span className="font-normal text-[var(--muted)]">(markdown)</span>
        </label>
        <textarea
          id="notes"
          rows={6}
          placeholder="Your thoughts…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] disabled:opacity-50"
      >
        {loading ? 'Clipping…' : 'Clip'}
      </button>
    </form>
  );
}
