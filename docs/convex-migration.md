# Convex migration guide

MVP stores clips in a JSON file via `FileClipRepository`. This document describes moving to [Convex](https://convex.dev) as the **shared backend and database** for Wijzer, with **real-time sync** across product surfaces and a path for **durable jobs** (Convex actions and/or Vercel Workflow).

Goals:

- One Convex **deployment** = one source of truth for clips (and future entities).
- **Multiple surfaces** (web app today; future apps, internal tools, etc.) all talk to the same Convex project.
- **Real-time by default** so every subscribed client stays in sync without manual polling or cache invalidation.
- Keep `@wijzer/core` as the canonical **`Clip` shape and Zod validation**; Convex schema and functions align with that model.

## Architecture: one backend, many surfaces

| Concern | Approach |
|--------|----------|
| **Data** | Single Convex project (dev + prod deployments). All tables live here. |
| **Types / API** | Generated Convex `api` types consumed by any TypeScript surface in the monorepo (e.g. `apps/web`, future `apps/*`). |
| **Non-TS or legacy HTTP** | Optional: keep thin Next.js route handlers that proxy to Convex via `ConvexHttpClient` for REST-only clients. Prefer **Convex React / JS client** for first-party surfaces so you get subscriptions. |
| **Shared package (optional)** | A small workspace package (e.g. `packages/convex-client` or re-export from `convex/_generated`) can expose `ConvexProvider` setup and deployment URL helpers so every app configures auth + URL the same way. |

Every first-party surface should use the **same** `NEXT_PUBLIC_CONVEX_URL` (or equivalent) for its deployment tier so they all read/write the same data and receive the same subscription updates.

## Real-time from the start

Convex subscriptions are the default way to keep UI and background views in sync.

**Recommended patterns**

1. **Reads** — Use `useQuery` (React) or the vanilla `ConvexReactClient` subscription APIs so list and detail views update automatically when any client creates or updates a clip.
2. **Writes** — Use `useMutation` from the client where possible so the optimistic path and automatic query refresh are consistent. For sensitive writes, you can still call a **mutation** from a trusted server using `ConvexHttpClient` if the operation must not run in the browser.
3. **Next.js App Router** — Wrap the client tree in `ConvexProvider` (typically in a client layout component). Server Components can render static shells; interactive clip lists should be client components that subscribe via `useQuery`.
4. **Avoid “HTTP-only reads” for primary UX** — Route handlers that return JSON snapshots do not push updates to other tabs or devices. Use them only for export, webhooks, or non-Convex clients.

If you temporarily keep `GET /api/clips` for compatibility, treat it as a **non-real-time** escape hatch, not the main data path for product UI.

## Target schema

Align validators with `@wijzer/core` (`clipMetadataSchema`, etc.). Use literals/unions in Convex where it helps (`kind`, `extractionQuality`, `provenance`).

```ts
// convex/schema.ts (future)
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  clips: defineTable({
    // Stable public id for URLs and @wijzer/core `Clip.id` (e.g. UUID from server).
    publicId: v.string(),
    url: v.string(),
    finalUrl: v.string(),
    notes: v.string(),
    content: v.string(),
    metadata: v.object({
      kind: v.string(),
      title: v.object({
        value: v.string(),
        source: v.string(), // extracted | inferred | unknown
      }),
      author: v.optional(
        v.object({
          value: v.string(),
          source: v.string(),
        }),
      ),
      siteName: v.optional(
        v.object({
          value: v.string(),
          source: v.string(),
        }),
      ),
      thumbnail: v.optional(v.string()),
      toolUsed: v.string(),
      extractionQuality: v.string(),
      confidence: v.object({
        kind: v.number(),
        title: v.number(),
        author: v.optional(v.number()),
      }),
      warnings: v.array(v.string()),
    }),
    createdAt: v.number(),
    // When auth lands: ownerSubject or userId — see “Adding authentication” below.
  })
    .index('by_createdAt', ['createdAt'])
    .index('by_publicId', ['publicId']),
});
```

**Indexes** — `by_createdAt` for newest-first lists; `by_publicId` for `getById` matching today’s string ids. If you add tenancy, add a compound index such as `by_user_createdAt`.

## Queries, mutations, and Convex actions

| Convex function kind | Role in Wijzer |
|---------------------|----------------|
| **Query** | `list` (sorted), `getByPublicId`, future filtered search. Subscribable; must be deterministic and fast. |
| **Mutation** | Insert/update clip rows; small, transactional. Good for persisting a completed extraction result. |
| **Action** | **Possible route** for the full or partial **clip pipeline**: HTTP fetch to URLs, calling external AI APIs, aggregating tool results. Actions can call `fetch`, use Node/runtime where configured, and call `internalMutation` to write results. Use when work is too slow or too external for a bare mutation. |

**Phased extraction strategy**

1. **Short term** — Keep `createClipFromUrl` in the Next.js route (or a server action), then call a **mutation** to persist. Surfaces still get real-time updates via `useQuery` as soon as the row exists.
2. **Actions path** — Move extraction into a Convex **action** (e.g. `clips.createFromUrlAction`) so all surfaces invoke the same server-side pipeline, secrets live in the Convex dashboard, and long-running work is centralized. Document env vars (model keys, gateway URLs) required in Convex for that path.
3. **Hybrid** — Action performs fetch + structured steps; heavy or experimental orchestration can later delegate a segment to **Vercel Workflow** (see below) while Convex remains the system of record for clip rows.

## Vercel Workflow (explore later)

[Vercel Workflow](https://vercel.com/docs/workflow) (WDK) is a **possible complement** when you need **durable, step-based orchestration** across long time horizons: retries with backoff, explicit steps, pause/resume, or coordination with non-Convex systems.

**When it is worth evaluating**

- Multi-step pipelines that exceed comfortable Convex action duration limits or need first-class **workflow UI / step logs** on Vercel.
- Chaining Convex writes from workflow steps (e.g. “extract → summarize → notify”) with strong guarantees between steps.

**Rough integration shapes** (not commitments — evaluate when you adopt workflows)

- Workflow runs steps on Vercel; a step calls **Convex mutations** via `ConvexHttpClient` or a small internal API to persist progress and final `clips` rows. Subscriptions still update all Convex-connected surfaces.
- Alternatively, Convex actions remain the orchestrator and Workflow is used only for isolated sub-jobs — choose based on where you want observability and state machine semantics to live.

Document env, idempotency (e.g. dedupe by `publicId` or job id), and how partial failures surface in the UI (Convex fields like `status: "failed"` on a job or clip).

## Repository adapter and `CLIP_STORE`

Create `ConvexClipRepository` in `@wijzer/db` (or a dedicated package) implementing `ClipRepository` using **`ConvexHttpClient`** for **server-side** call sites (Next route handlers, scripts). **Browser-facing surfaces** should prefer the **Convex React client** + generated `api` for mutations/queries so subscriptions work.

Wiring example for server-only paths:

```ts
// packages/db/src/index.ts (conceptual)
export function getClipRepository(): ClipRepository {
  if (process.env.CLIP_STORE === 'convex') {
    return new ConvexClipRepository(/* ConvexHttpClient + deployment */);
  }
  return new FileClipRepository(FileClipRepository.defaultPath());
}
```

Client components should **not** rely on `getClipRepository()`; they use `useMutation` / `useQuery` from `convex/react`.

## Migration steps

1. Add a `convex/` directory at the monorepo root (or agreed single location), link a Convex project, and deploy the schema.
2. Implement `clips` **queries** and **mutations** (and optional **actions**) matching `ClipRepository` behavior and `@wijzer/core` types.
3. Add `ConvexProvider` to `apps/web` and migrate list/detail/create flows to **`useQuery` / `useMutation`** for real-time UX.
4. One-time import: read `.data/clips.json` and insert via a script or internal mutation (chunked writes).
5. Set env: `CLIP_STORE=convex`, `NEXT_PUBLIC_CONVEX_URL`, and server deploy keys per Convex docs. Align all surfaces on the same deployment URL per environment.
6. Deprecate file store in production; keep `FileClipRepository` for offline or e2e if useful.

## Adding authentication (checklist for documentation and implementation)

When clips (or other records) must be **scoped to a user or organization**, plan the following. Convex does not use SQL-style RLS; **every query and mutation must enforce access** explicitly.

### Data model

- [ ] Add an **owner identifier** on `clips` (and any future tables), e.g. `ownerSubject: v.string()` from Convex Auth’s `identity.subject`, or `userId` aligned with your IdP.
- [ ] Add **indexes** that include the owner field for efficient listing, e.g. `by_owner_createdAt: ['ownerSubject', 'createdAt']`.
- [ ] Decide **public vs private** clips and whether unauthenticated reads are allowed (probably not for per-user data).

### Convex functions

- [ ] Configure **Convex Auth** (or custom JWT validation) per [Convex auth documentation](https://docs.convex.dev/auth).
- [ ] In **every** `query` and `mutation` (and any `action` that returns sensitive data), load `ctx.auth.getUserIdentity()` (or equivalent) and **reject** if missing or not allowed.
- [ ] Scope reads: `list` / `get` must filter by `ownerSubject` (or role-based rules for shared workspaces).
- [ ] Scope writes: `create` / `update` / `delete` must set or verify `ownerSubject` so users cannot read or overwrite others’ documents by guessing `publicId`.

### Multi-surface auth

- [ ] Each product surface must obtain a **valid token** for the same auth provider Convex trusts (same issuer/audience as configured in Convex dashboard).
- [ ] Pass the token into the Convex client (`ConvexReactClient` / HTTP client) so subscriptions and mutations run **as that user**.
- [ ] Service-to-service calls (e.g. Vercel Workflow, cron): use **Convex deploy keys** only for trusted internal mutations, or use a dedicated service identity pattern; never expose deploy keys to browsers.

### Next.js / API routes

- [ ] If REST routes remain, validate the session (e.g. Clerk, Auth.js) and either forward user credentials to Convex-compatible tokens or stop proxying user-scoped reads/writes through unauthenticated routes.
- [ ] Remove or harden any **public** `getClipRepository()` paths that bypass user context.

### Migration of existing rows

- [ ] Backfill `ownerSubject` for existing clips (assign to a default system user, or mark as legacy and read-only) before enforcing strict checks in production.

### Testing

- [ ] Add tests or manual scripts for: authenticated list, cross-user `getById` denial, and subscription behavior under two different users.

---

## Summary

- Treat Convex as the **single real-time backend** for all surfaces; share deployment URL and generated types across apps.
- Lead with **`useQuery` / `useMutation`** on clients; use `ConvexHttpClient` on servers or legacy HTTP where needed.
- Use **Convex actions** as the natural place to grow **URL fetch + AI extraction** so pipelines and secrets stay server-side and consistent.
- **Vercel Workflow** is an optional future layer for **durable multi-step orchestration** that still persists into Convex so subscriptions keep every surface in sync.
- **Auth** is explicit in Convex: schema fields + indexes + identity checks in every function + aligned tokens on every surface.
