# Convex migration guide

MVP stores clips in a JSON file via `FileClipRepository`. This document describes moving to [Convex](https://convex.dev) as the **shared backend and database** for Wijzer, with **real-time sync** across product surfaces and a path for **durable jobs** (Convex actions and/or Vercel Workflow).

Goals:

- One Convex **deployment** = one source of truth for clips (and future entities).
- **Multiple surfaces** (web app today; future apps, internal tools, etc.) all talk to the same Convex project.
- **Real-time by default** so every subscribed client stays in sync without manual polling or cache invalidation.
- Keep `@wijzer/core` as the canonical **`Clip` shape and Zod validation**; Convex schema validators should **stay in sync** when Zod types change.

## Architecture: one backend, many surfaces

| Concern | Approach |
|--------|----------|
| **Data** | Single Convex project (dev + prod deployments). All tables live here. |
| **Types / API** | Generated Convex `api` types consumed by any TypeScript surface in the monorepo (e.g. `apps/web`, future `apps/*`). |
| **Non-TS or legacy HTTP** | Optional: keep thin Next.js route handlers that proxy to Convex via `ConvexHttpClient` for REST-only clients. Prefer **Convex React / JS client** for first-party surfaces so you get subscriptions. |
| **Shared package (optional)** | A small workspace package (e.g. `packages/convex-client` or re-export from `convex/_generated`) can expose `ConvexProvider` setup and deployment URL helpers so every app configures auth + URL the same way. You can also add **`@wijzer/convex-api`** that re-exports `api`, `internal`, and `dataModel` so apps avoid deep relative imports into `convex/_generated`. |

Every first-party surface should use the **same** `NEXT_PUBLIC_CONVEX_URL` (or equivalent) for its deployment tier so they all read/write the same data and receive the same subscription updates.

**Turborepo** — Keep a **single** root `convex/` (or one agreed directory). Turbo tasks should run **`convex dev`** / codegen from that root so `_generated` stays in sync; every consumer must depend on **fresh types** and the **same** deployment URL per environment ([Deployment URLs](https://docs.convex.dev/client/react/deployment-urls)).

Add a Turbo pipeline task (e.g. `convex-codegen` or a task that **`dependsOn`** `convex dev` / `npx convex codegen` output) and wire **`typecheck`** / **`build`** for `apps/*` and any package importing **`api`** so **CI never sees stale `_generated`** files.

**Preview deployments** — Align each **Vercel preview** with a **non-production Convex deployment** (typically **dev**) and matching env vars so previews never read or write **prod** data by accident.

**Token alignment** — Convex expects **OIDC JWTs** the deployment trusts on both client and server paths. Each surface must use the **same issuer / audience** configuration as in the Convex dashboard ([Next.js — other providers](https://docs.convex.dev/client/nextjs#other-providers)).

## Real-time from the start

Convex subscriptions are the default way to keep UI and background views in sync.

**Recommended patterns**

1. **Reads** — Use `useQuery` (React) or the vanilla `ConvexReactClient` subscription APIs so list and detail views update automatically when any client creates or updates a clip.
2. **Writes** — Use `useMutation` from the client where possible so the optimistic path and automatic query refresh are consistent. For sensitive writes, you can still call a **mutation** from a trusted server using `ConvexHttpClient` if the operation must not run in the browser.
3. **Next.js App Router** — Wrap the client tree in `ConvexProvider` (typically in a client layout component). Interactive clip UI should be **Client Components** that subscribe via `useQuery`. Server Components can render static shells.
4. **Hooks stay on the client** — **`useQuery` and `useMutation` must not run in Server Components**; only in **`"use client"`** modules under `ConvexProvider`. Mistakes here are a common App Router footgun.
5. **SSR and RSC** — Reactive data still flows through the **live client**; server-side prefetch is a separate concern. Read [Server rendering](https://docs.convex.dev/client/nextjs#server-rendering-ssr) and [App Router server rendering](https://docs.convex.dev/client/nextjs/app-router/server-rendering) so you do not duplicate auth/token mistakes between RSC and hooks. After sign-in, the **client** must receive **fresh provider tokens** (IdP-specific).
6. **Avoid “HTTP-only reads” for primary UX** — Route handlers that return JSON snapshots do not push updates to other tabs or devices. Use them only for export, webhooks, or non-Convex clients. Server `fetch` to Convex is **not** reactive—fine for SEO shells, but **stale** unless the browser also subscribes.

If you temporarily keep `GET /api/clips` for compatibility, treat it as a **non-real-time** escape hatch, not the main data path for product UI.

**Next.js 15** — The Convex [Next.js doc](https://docs.convex.dev/client/nextjs#clerk) targets Next.js 15; the **`nextjs-clerk`** template (`npm create convex@latest -- -t nextjs-clerk`) is a good reference when wiring `ConvexClientProvider` + Clerk.

## Target schema

Align validators with `@wijzer/core` (`clipMetadataSchema`, etc.). Prefer **`v.union(v.literal(…), …)`** for enums so bad writes fail at the database layer—**update Convex validators when Zod enums change**.

**Identities** — Convex assigns **`_id`** to every document; keep **`publicId`** as the stable string in `@wijzer/core`’s **`Clip.id`** and in URLs. **`by_publicId`** is for **lookup only**; it does **not** enforce uniqueness. **Enforce unique `publicId`** in the **create** mutation (check-then-insert or idempotency via a **`jobs`** / **`clipCreates`** row). For updates, prefer **`_id`** when the handler already has it; use **`by_publicId`** (and later **`by_ownerSubject_publicId`**) for user-facing routes.

**Document size** — A single `clips` document with `content` + `metadata` is fine for MVP; if clips grow very large, revisit denormalization, attachments (e.g. Convex file storage), or truncation. Convex enforces **per-document and platform limits**—see [production](https://docs.convex.dev/production) and dashboard docs if you approach large payloads.

**Search (later)** — Prefer a **`searchIndex`** for full-text needs instead of **`filter()`** over large tables.

```ts
// convex/schema.ts (future) — mirrors @wijzer/core enums; keep in sync
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

const provenanceSource = v.union(
  v.literal('extracted'),
  v.literal('inferred'),
  v.literal('unknown'),
);
const clipKind = v.union(
  v.literal('youtube'),
  v.literal('article'),
  v.literal('generic'),
  v.literal('unknown'),
);
const extractionQuality = v.union(
  v.literal('high'),
  v.literal('medium'),
  v.literal('low'),
);
const provenanceField = v.object({
  value: v.string(),
  source: provenanceSource,
});

export default defineSchema({
  clips: defineTable({
    publicId: v.string(),
    url: v.string(),
    finalUrl: v.string(),
    notes: v.string(),
    content: v.string(),
    metadata: v.object({
      kind: clipKind,
      title: provenanceField,
      author: v.optional(provenanceField),
      siteName: v.optional(provenanceField),
      thumbnail: v.optional(v.string()),
      toolUsed: v.string(),
      extractionQuality,
      confidence: v.object({
        kind: v.number(),
        title: v.number(),
        author: v.optional(v.number()),
      }),
      warnings: v.array(v.string()),
    }),
    createdAt: v.number(),
    // When auth lands: ownerSubject — see “Adding authentication” below.
  })
    .index('by_createdAt', ['createdAt'])
    .index('by_publicId', ['publicId']),
});
```

**Indexes** — `by_createdAt` for newest-first lists; `by_publicId` for `getById` by public id. With tenancy, add **`by_ownerSubject_createdAt`** for per-user lists and **`by_ownerSubject_publicId`** for “my clip by public id” without scanning.

## Queries, mutations, and Convex actions

| Convex function kind | Role in Wijzer |
|---------------------|----------------|
| **Query** | `list` (sorted), `getByPublicId`, future filtered search. Subscribable; must be deterministic and fast. |
| **Mutation** | Insert/update clip rows; small, transactional. Good for persisting a completed extraction result. Prefer **internal** `internalMutation` when only server/action code should perform the write—expose a **narrow public** mutation or action that delegates. |
| **Action** | **Possible route** for the full or partial **clip pipeline**: HTTP fetch to URLs, calling external AI APIs, aggregating tool results. Actions use `fetch`, may use the **Node** runtime (`"use node"` — see below), and persist via **`ctx.runMutation`** (often an **`internalMutation`**). |

**Public vs internal API** — Implement **`internalQuery`** / **`internalMutation`** (and **`internalAction`** if needed) as the **batching surface** actions call. That keeps **`api.*`** small and avoids widening the public footprint for logic that only actions or schedules should trigger.

**Scheduler** — **`ctx.scheduler.runAfter`** / **`runAt`** must target **`internal*`** functions (e.g. `internal.clips.runExtraction`), **never** public `api` wrappers. Same rule as Convex’s scheduling model: schedule **`internal*`** entrypoints only (see [Scheduling](https://docs.convex.dev/scheduling)).

**Client-triggered actions** — Calling an action **directly from the browser is often an anti-pattern** ([Calling actions from clients](https://docs.convex.dev/functions/actions#calling-actions-from-clients)). Prefer a **mutation** that records intent (e.g. job/clip row + status) and **schedules** an **internal** action with `ctx.scheduler.runAfter(0, internal…)` for dedupe and invariants. Direct `useAction` can stay for **prototypes**; ship the mutation + scheduled internal action pattern for production.

**Idempotency** — Tie client entry to **mutations**: unique **`publicId`**, or a **`jobs`** table with **`idempotencyKey`**, before scheduling work so retries do not double-insert or double-charge APIs.

**Batching from actions** — Avoid many separate `ctx.runQuery` / `ctx.runMutation` calls from one action when a single **internal** query or mutation can do the work ([Actions — best practices](https://docs.convex.dev/functions/actions#best-practices)).

**`"use node"`** — Put Node-only actions in a file that starts with **`"use node"`**. **No other Convex functions** (queries/mutations) may live in that file ([Choosing the runtime](https://docs.convex.dev/functions/actions#choosing-the-runtime-use-node)). If the stack is **`fetch` + Web APIs** only, the default runtime may suffice—**validate** before assuming Node.

**Limits and ordering** — Actions have about a **10-minute** timeout, **no automatic retry** on failure (unlike mutations), and client-initiated actions may be **parallelized** vs mutation ordering ([Actions — limits](https://docs.convex.dev/functions/actions#limits)). Long pipelines need explicit **status fields**, app-level retries, and careful handling of paid API side effects. For strict sequencing, **await** inside one action or chain **mutation → scheduled internal action**.

**Phased extraction strategy**

1. **Short term** — Keep `createClipFromUrl` in the Next.js route (or a server action), then call a **mutation** to persist. Surfaces still get real-time updates via `useQuery` as soon as the row exists.
2. **Actions path** — Move extraction into a Convex **action** (e.g. internal `clips.runExtraction`) so all surfaces invoke the same server-side pipeline, secrets live in the Convex dashboard, and long-running work is centralized. Document env vars (model keys, gateway URLs) required in Convex for that path. Prefer **mutation + scheduled internal action** for client entry.
3. **Hybrid** — Action performs fetch + structured steps; heavy or experimental orchestration can later delegate a segment to **Vercel Workflow** (see below) while Convex remains the system of record for clip rows.

## Vercel Workflow (explore later)

[Vercel Workflow](https://vercel.com/docs/workflow) (WDK) is a **possible complement** when you need **durable, step-based orchestration** across long time horizons: retries with backoff, explicit steps, pause/resume, or coordination with non-Convex systems.

**When it is worth evaluating**

- Multi-step pipelines that exceed comfortable Convex action duration limits or need first-class **workflow UI / step logs** on Vercel.
- Chaining Convex writes from workflow steps (e.g. “extract → summarize → notify”) with strong guarantees between steps.

**Rough integration shapes** (not commitments — evaluate when you adopt workflows)

- Workflow runs steps on Vercel; a step calls **Convex mutations** via `ConvexHttpClient` or a small internal API to persist progress and final `clips` rows. Subscriptions still update all Convex-connected surfaces.
- Alternatively, Convex actions remain the orchestrator and Workflow is used only for isolated sub-jobs — choose based on where you want observability and state machine semantics to live.

**Calling Convex from workflows, cron, or schedules** — Prefer **[Service Authentication](https://docs.convex.dev/auth#service-authentication)**: public functions that verify a **shared secret** from the environment, not end-user JWTs—unless the caller runs **as** a user with a real token. The same pattern applies to **Convex crons** and **scheduled** jobs that are not tied to a logged-in identity (**`getUserIdentity()` is absent** on those entrypoints unless you bridge explicitly).

Document env, idempotency (e.g. dedupe by `publicId` or job id), and how partial failures surface in the UI (Convex fields like `status: "failed"` on a job or clip).

## Repository adapter and `CLIP_STORE`

Create `ConvexClipRepository` in `@wijzer/db` (or a dedicated package) implementing `ClipRepository` using **`ConvexHttpClient`** for **server-side** call sites (Next route handlers, scripts). **Browser-facing surfaces** should prefer the **Convex React client** + generated `api` for mutations/queries so subscriptions work.

When a route handler proxies “**as the user**,” pass **OIDC JWTs Convex accepts** into the HTTP client—not only session cookies—per your IdP + [Next.js hybrid](https://docs.convex.dev/client/nextjs#server-and-client-side) setup.

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
2. Wire Turbo so **`convex dev` / `npx convex codegen`** (or equivalent) runs where `convex/` lives and **`typecheck` / `build`** for consumers **depend on** up-to-date `_generated` types.
3. Implement `clips` **queries** and **mutations** (and optional **actions**) matching `ClipRepository` behavior and `@wijzer/core` types; use **`internal*`** for batch work from actions and schedules.
4. Add `ConvexProvider` to `apps/web` and migrate list/detail/create flows to **`useQuery` / `useMutation`** for real-time UX.
5. One-time import: read `.data/clips.json` and insert via a script or internal mutation (chunked writes).
6. Set env: `CLIP_STORE=convex`, `NEXT_PUBLIC_CONVEX_URL`, and deploy keys per Convex docs. Align all surfaces on the same deployment URL per environment (and **preview ↔ dev** Convex per above).
7. Deprecate file store in production; keep `FileClipRepository` for offline or e2e if useful.

**Local development** — Contributors should use **`npx convex dev`** against a dev deployment. **`convex deploy`** is for **production** (or explicit promotion), not day-to-day local iteration.

## Adding authentication (checklist for documentation and implementation)

When clips (or other records) must be **scoped to a user or organization**, plan the following. Convex does not use SQL-style RLS; **every query and mutation must enforce access** explicitly.

**Policy** — Treat **new tables as authenticated-only by default** unless you document a deliberate **public** query. “Default deny” reduces accidental data leaks.

### Convex Auth setup (official tracks)

High-level flow from [Authentication](https://docs.convex.dev/auth) and [Next.js (App Router)](https://docs.convex.dev/client/nextjs):

1. **Choose an integration**
   - **Third-party OIDC/JWT** (typical **production** default for Next.js 15 + multi-surface): [Clerk](https://docs.convex.dev/auth/clerk), [WorkOS AuthKit](https://docs.convex.dev/auth/authkit), [Auth0](https://docs.convex.dev/auth/auth0), or [Custom Auth / OIDC](https://docs.convex.dev/auth/advanced/custom-auth).
   - **Convex Auth library** ([convex-auth](https://docs.convex.dev/auth/convex-auth)): **beta**, possible breaking changes, fewer features than full IdP integrations; **Next.js support is still evolving** ([labs.convex.dev/auth](https://labs.convex.dev/auth))—good for **spikes**; third-party IdPs are often safer until this stabilizes.

2. **Configure the deployment** — Per provider: JWT issuer, application IDs, and related settings in the **Convex dashboard** so Convex validates incoming tokens.

3. **App Router client tree** — Client module with `ConvexReactClient` + `ConvexProvider`, or provider-specific wrappers (e.g. Auth0’s `ConvexProviderWithAuth0` from `convex/react-auth0` per [client-side example](https://docs.convex.dev/client/nextjs#client-side-only)). For Clerk, follow [Clerk + Convex](https://docs.convex.dev/auth/clerk) and the Next.js section. Use **one** `ConvexReactClient` instance app-wide.

4. **Server / hybrid** — For Server Components, Server Actions, and route handlers, use the vendor **Next.js SDK** to obtain **OIDC JWTs** Convex accepts; hybrid setups need **extra `.env.local`** variables ([server and client side](https://docs.convex.dev/client/nextjs#server-and-client-side)).

5. **Identity in functions** — In handlers, use **`await ctx.auth.getUserIdentity()`** ([Auth in Functions](https://docs.convex.dev/auth/functions-auth)). Non-null identities include at least **`subject`**, **`issuer`**, and **`tokenIdentifier`**; see [User identity fields](https://docs.convex.dev/auth/functions-auth#user-identity-fields). **Crons, schedules, and workflow steps** usually **do not** have a user identity—use **Service Authentication** or **internal** functions + shared secrets instead.

6. **HTTP Actions** — Use **`Authorization: Bearer <JWT>`** as in [HTTP Actions](https://docs.convex.dev/auth/functions-auth#http-actions).

7. **Service / background callers** — Use [Service Authentication](https://docs.convex.dev/auth#service-authentication): trusted jobs call **public** functions that verify a **shared secret** in env—**not** user JWTs (unless the job truly runs as that user). Applies to **Vercel Workflow**, **Convex cron**, and **`ctx.scheduler`**-driven **internal** chains that eventually expose a small public entry with a secret.

### Data model

- [ ] Add an **owner identifier** on `clips` (and any future tables), e.g. `ownerSubject: v.string()` aligned with `identity.subject`, or `userId` aligned with your IdP.
- [ ] Add **indexes** that include the owner field for efficient listing, e.g. `by_owner_createdAt: ['ownerSubject', 'createdAt']`, and **`by_ownerSubject_publicId`** for scoped lookup by public id.
- [ ] Decide **public vs private** clips and whether unauthenticated reads are allowed (probably not for per-user data).

### Convex functions

- [ ] In **every** `query` and `mutation` (and any `action` that reads or returns sensitive data), use **`await ctx.auth.getUserIdentity()`** and **reject** if missing or not allowed ([Auth in Functions](https://docs.convex.dev/auth/functions-auth)).
- [ ] Scope reads: `list` / `get` must filter by `ownerSubject` (or role-based rules for shared workspaces).
- [ ] Scope writes: `create` / `update` / `delete` must set or verify `ownerSubject` so users cannot read or overwrite others’ documents by guessing `publicId`.

### Multi-surface auth

- [ ] Each surface obtains tokens from the **same auth provider** Convex trusts (issuer/audience match dashboard config).
- [ ] Pass the token into `ConvexReactClient` / HTTP client so subscriptions and mutations run **as that user**.

### Next.js / API routes

- [ ] If REST routes remain, validate the session and either forward **OIDC JWTs** Convex accepts or stop proxying user-scoped reads/writes through unauthenticated routes.
- [ ] Remove or harden any **public** `getClipRepository()` paths that bypass user context.

### Migration of existing rows

- [ ] Backfill `ownerSubject` for existing clips (assign to a default system user, or mark as legacy and read-only) before enforcing strict checks in production.

### Testing

- [ ] Add tests or manual scripts for: authenticated list, cross-user `getById` denial, and subscription behavior under two different users.

---

## Summary

- Treat Convex as the **single real-time backend** for all surfaces; share deployment URL, Turbo/codegen discipline, **`internal*`** scheduling rules, and generated types across apps.
- Lead with **`useQuery` / `useMutation`** only in **Client Components**; use `ConvexHttpClient` on servers with **proper JWTs** when proxying as a user; separate **SSR/RSC** from live subscriptions deliberately.
- Use **actions** for external/slow extraction; prefer **mutation + scheduled internal action** over direct client `useAction` in production; batch work through **`internalQuery` / `internalMutation`**; respect **timeouts, no auto-retry, and parallelization** semantics.
- **Vercel Workflow** and **cron/scheduled** callers use the same **service shared-secret** pattern as workflows unless acting as a user.
- **Auth**: third-party IdP is the pragmatic default for prod Next + multi-surface; **Convex Auth** for spikes; configure dashboard + providers; **`await ctx.auth.getUserIdentity()`** on user-scoped paths; **default deny** on new tables.

## Plan changelog

- **2026-05-18** — Doc review against official Convex pages ([Auth](https://docs.convex.dev/auth), [React](https://docs.convex.dev/client/react), [Next.js](https://docs.convex.dev/client/nextjs), [Actions](https://docs.convex.dev/functions/actions), [Auth in Functions](https://docs.convex.dev/auth/functions-auth)). Findings folded into the main sections (actions vs mutations, `"use node"`, service auth, WorkOS AuthKit, Convex Auth beta, Turbo/SSR/token risks).
- **Plan update (convex-advisor)** — Tightened schema enums to match `@wijzer/core`; documented **`publicId` uniqueness** vs **`by_publicId`**; **`_id` vs `publicId`** updates; **`internal*`** batching + **scheduler targets internal only**; **preview ↔ dev Convex**; Turbo **dependsOn codegen**; **no hooks in RSC**; **document size** and **searchIndex** notes; **idempotency**; **cron/service auth** parity with Workflow; **`npx convex dev`** for local dev; **default deny** and **IdP vs Convex Auth** tradeoff.
