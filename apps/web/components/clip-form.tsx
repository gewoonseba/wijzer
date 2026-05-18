'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ClipForm() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setStatus('Fetching page and building your clip…');

    try {
      const res = await fetch('/api/clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, notes }),
      });

      const data = (await res.json()) as {
        id?: string;
        error?: string;
        metadata?: { warnings?: string[] };
      };

      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        setStatus(null);
        return;
      }

      if (data.id) {
        setStatus('Done — opening your clip…');
        router.push(`/clips/${data.id}`);
        router.refresh();
      }
    } catch {
      setError('Network error — could not create clip');
      setStatus(null);
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
        <Input
          id="url"
          type="url"
          required
          placeholder="https://..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="notes" className="mb-1 block text-sm font-medium">
          Notes <span className="font-normal text-muted-foreground">(markdown)</span>
        </label>
        <textarea
          id="notes"
          rows={6}
          placeholder="Your thoughts…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={loading}
          className="flex min-h-[120px] w-full rounded-3xl border border-transparent bg-input/50 px-3 py-2 font-mono text-sm text-foreground transition-[color,box-shadow,background-color] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {loading ? (
        <div
          className="rounded-3xl border border-border bg-muted/40 px-4 py-3"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm font-medium">Clipping…</p>
          <p className="mt-1 text-sm text-muted-foreground">{status}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            This usually takes 15–90 seconds depending on the page and AI
            summarization.
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={loading}>
        {loading ? 'Clipping…' : 'Clip'}
      </Button>
    </form>
  );
}
