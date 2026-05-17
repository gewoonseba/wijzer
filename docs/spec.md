# Wijzer — Technical Specification (MVP)

## Purpose

Wijzer is a personal web clipping application. Users submit any HTTP(S) URL plus optional markdown notes. The system extracts source material, runs a **clipping agent** to produce a markdown summary, and persists a **clip** for later reading.

Chat with saved clips is **out of scope** for MVP (`POST /api/chat` reserved for Phase 2).

## Core principles

1. **Agent-powered, not agent-unbounded** — The model chooses tools and writes summaries; code owns validation, fetch safety, persistence, and HTTP contracts.
2. **Evidence-guided extraction** — Deterministic URL hints inform tool choice; tools return structured evidence.
3. **Separate facts from inference** — Metadata fields record `extracted`, `inferred`, or `unknown` provenance.
4. **Notes are sacred** — User `notes` are stored verbatim and never merged into `content`.
5. **Clipping ≠ chat** — `clipAgent` creates clips; future `chatAgent` queries them.

## Data model: Clip

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Primary key |
| `url` | string | Original submitted URL |
| `finalUrl` | string | URL after redirects (if different) |
| `notes` | string | User markdown (unchanged) |
| `content` | string | Agent-generated markdown body |
| `metadata` | `ClipMetadata` | See below |
| `createdAt` | ISO 8601 string | Creation time |

### ClipMetadata

```ts
{
  kind: 'youtube' | 'article' | 'generic' | 'unknown'
  title: { value: string, source: 'extracted' | 'inferred' | 'unknown' }
  author?: { value: string, source: Provenance }
  siteName?: { value: string, source: Provenance }
  thumbnail?: string  // URL
  toolUsed: string    // e.g. clipYouTube
  extractionQuality: 'high' | 'medium' | 'low'
  confidence: { kind: 0-1, title: 0-1, author?: 0-1 }
  warnings: string[]
}
```

## HTTP API

### `POST /api/clips`

**Request**

```json
{ "url": "https://…", "notes": "## optional markdown" }
```

**Success:** `201` + Clip JSON

**Errors**

| Status | When |
|--------|------|
| 400 | Invalid body or blocked URL |
| 415 | Unsupported content type (fetch) |
| 422 | Extraction failed / empty content |
| 502 | Upstream fetch failure |
| 504 | Agent timeout |

### `GET /api/clips`

Returns `{ clips: Clip[] }` newest first.

### `GET /api/clips/[id]`

Returns Clip or `404`.

## Clipping pipeline

```
POST /api/clips
  → validateClipUrl (packages/content)
  → buildUrlHints
  → clipAgent.generate (packages/ai)
       → tool: clipYouTube | clipArticle | clipGenericUrl
       → structured output: content + metadataPatch + deterministic fields
  → ClipRepository.create
```

### `clipAgent`

- **Class:** `ToolLoopAgent` (AI SDK v6)
- **Model:** `WIJZER_CLIP_MODEL` or `anthropic/claude-sonnet-4.5` via AI Gateway
- **Tools:** three extractors (see below)
- **Output:** `Output.object(clipAgentResultSchema)`
- **Limits:** `stopWhen: stepCountIs(6)`; one primary tool + optional one fallback

### Extraction tools

| Tool | Package | Extractor |
|------|---------|-----------|
| `clipYouTube` | content | `extractYouTube` — oEmbed + transcript |
| `clipArticle` | content | `extractArticle` — Readability |
| `clipGenericUrl` | content | `extractGenericPage` — Readability + text fallback |

Tool results include `usable`, `quality`, `warnings`, and source text. YouTube without captions returns `usable: false` (API → 422 if agent cannot produce content).

### URL safety (`safeFetch`)

- Schemes: `http`, `https` only
- Block: localhost, private IPs, `.local`, `.internal`
- Max redirects: 5 (re-validate each target)
- Timeout: 15s
- Max body: 5 MB
- Allowed types: HTML/plain/xhtml/json

### URL hints (`buildUrlHints`)

Non-authoritative signals passed in the agent prompt: hostname, path, extension, `likelyKind`, `reasons[]`.

## Storage (MVP)

- **Interface:** `ClipRepository` in `packages/db`
- **Implementation:** `FileClipRepository` → `.data/clips.json` (gitignored)
- **Tests:** `InMemoryClipRepository`

## UI (MVP)

- Home: clip form + recent list
- Detail: metadata panel (with provenance labels), rendered `content` and `notes`
- Markdown: `react-markdown` + `rehype-sanitize`

## Environment

See root [README.md](../README.md).

## Phase 2 (not implemented)

- `POST /api/chat` + `chatAgent`
- Convex `ConvexClipRepository`
- Podcast/PDF tools
- Browser extension → same clip API
