# Wijzer

Save and summarize any link. Paste a URL and optional markdown notes; an AI clipping agent extracts source material and writes a personal reference summary.

## Quick start

```bash
pnpm install
cp .env.example apps/web/.env.local
# Add AI_GATEWAY_API_KEY to apps/web/.env.local
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `AI_GATEWAY_API_KEY` | Yes | [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) API key |
| `WIJZER_CLIP_STORE_PATH` | No | Path to clips JSON file (default: `.data/clips.json` at repo root) |
| `WIJZER_CLIP_MODEL` | No | Gateway model id (default: `anthropic/claude-sonnet-4.5`) |
| `WIJZER_CLIP_TIMEOUT_MS` | No | Clip agent timeout (default: `120000`) |

## Monorepo

| Package | Role |
|---------|------|
| `apps/web` | Next.js UI + clip API |
| `packages/core` | Types, Zod schemas, errors |
| `packages/content` | URL safety, hints, extractors |
| `packages/ai` | `clipAgent`, tools, `createClipFromUrl` |
| `packages/db` | `ClipRepository`, file storage |

## API

- `POST /api/clips` — `{ url, notes }` → create clip
- `GET /api/clips` — list clips
- `GET /api/clips/[id]` — get one clip

See [docs/spec.md](docs/spec.md) for full specification.

## Docs

- [Specification](docs/spec.md)
- [Convex migration](docs/convex-migration.md)
