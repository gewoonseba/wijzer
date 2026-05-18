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
- [ ] In **every** `query` and `mutation` (and any `action` that returns sensitive data), load `await ctx.auth.getUserIdentity()` (see [Auth in Functions](https://docs.convex.dev/auth/functions-auth)) and **reject** if missing or not allowed.
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

## External review

_Convex documentation was cross-checked on 2026-05-18 via [Authentication](https://docs.convex.dev/auth), [Convex React](https://docs.convex.dev/client/react), [Next.js (App Router)](https://docs.convex.dev/client/nextjs), [Actions](https://docs.convex.dev/functions/actions), and [Auth in Functions](https://docs.convex.dev/auth/functions-auth). (Context7 quota was unavailable; sources are these official pages.)_

### Verdict

**Directionally correct.** The plan matches current Convex guidance: a single deployment as the real-time source of truth, client subscriptions via `ConvexProvider` + `ConvexReactClient`, `useQuery` / `useMutation` (and `useAction` where appropriate), actions for third-party / long-running work with writes through `ctx.runMutation` (prefer **internal** mutations when clients should not call the writer directly), and explicit authorization in functions rather than database RLS.

### Gaps / corrections

- **`getUserIdentity` is async** — Handlers should use `await ctx.auth.getUserIdentity()`; the [Auth in Functions](https://docs.convex.dev/auth/functions-auth) examples use `await`. The checklist in this doc is updated accordingly.
- **Client-triggered actions vs mutations** — [Actions](https://docs.convex.dev/functions/actions#calling-actions-from-clients) state that calling an action **directly from the client is often an anti-pattern**; the recommended pattern is a **mutation** that records intent (e.g. insert a task row) and **schedules** an **internal** action. For Wijzer’s “create from URL” pipeline, consider documenting both: direct `useAction` for prototypes vs **mutation + `ctx.scheduler.runAfter(0, internal…)`** for production enforcement (dedupe, invariants).
- **Multiple `runQuery` / `runMutation` from one action** — Same doc [best practices](https://docs.convex.dev/functions/actions#best-practices) recommend **avoiding several separate** `ctx.runQuery` / `ctx.runMutation` calls when a single **internal** query/mutation can batch work, to preserve transactional consistency and reduce overhead. Merging reads/writes into one internal function is preferred unless intentionally processing more than fits in one transaction.
- **"use node" file split** — Actions that need unsupported NPM packages or Node APIs go in a file with **`"use node"`** at the top; **other Convex functions cannot live in that file** ([Actions — Choosing the runtime](https://docs.convex.dev/functions/actions#choosing-the-runtime-use-node)). If the extraction stack needs Node-only libraries, plan an extra file or helpers accordingly.
- **Service / background callers** — [Authentication — Service Authentication](https://docs.convex.dev/auth#service-authentication) describes **public Convex functions** that verify a **shared secret** (e.g. env var) for non–end-user callers. Prefer that documented pattern when describing Modal, workflows, or cron-style access; align wording with “shared secret checked in code” rather than overloading “deploy keys” unless your team uses a specific Convex mechanism by that name.
- **Auth provider breadth** — The auth overview also lists **WorkOS AuthKit** alongside Clerk and Auth0 ([Authentication](https://docs.convex.dev/auth#third-party-authentication-platforms)); optional to mention in vendor comparisons.
- **Convex Auth library** — [Authentication — The Convex Auth Library](https://docs.convex.dev/auth#the-convex-auth-library): **beta**, may have breaking changes; fewer features than third-party integrations; **Next.js support is under active development** with experimental links to [labs.convex.dev/auth](https://labs.convex.dev/auth). If Wijzer chooses this path, call out beta/experiment status in the migration risks.
- **Next.js 15** — The [Next.js client doc](https://docs.convex.dev/client/nextjs#clerk) references **Next.js 15** and `npm create convex@latest -- -t nextjs-clerk`; good alignment with this monorepo’s stack—follow that quickstart when standardizing `ConvexClientProvider` + Clerk.

### Convex Auth setup (paste into migration / runbooks)

High-level steps **only as documented** on [Authentication](https://docs.convex.dev/auth) and [Next.js (App Router)](https://docs.convex.dev/client/nextjs):

1. **Choose an integration track**
   - **Third-party OIDC/JWT providers** (documented guides): [Clerk](https://docs.convex.dev/auth/clerk), [WorkOS AuthKit](https://docs.convex.dev/auth/authkit), [Auth0](https://docs.convex.dev/auth/auth0), or [Custom Auth / OIDC](https://docs.convex.dev/auth/advanced/custom-auth).
   - **Convex Auth** (in-product library): [The Convex Auth Library](https://docs.convex.dev/auth/convex-auth) — beta; npm package linked from that page; Next.js called out as evolving ([labs](https://labs.convex.dev/auth)).

2. **Configure the deployment** — Per-provider Convex docs: set **JWT / issuer / application ID** (and related settings) in the **Convex dashboard** so Convex validates incoming identity tokens (exact fields depend on Clerk vs Auth0 vs custom JWT).

3. **App Router client tree** — Use a **client** module (e.g. `ConvexClientProvider.tsx`) with `ConvexReactClient` and `ConvexProvider`, or a **provider-specific** wrapper as in the [Auth0 + Next.js example](https://docs.convex.dev/client/nextjs#client-side-only) (`Auth0Provider` + `ConvexProviderWithAuth0` from `convex/react-auth0`). For Clerk, follow [Clerk](https://docs.convex.dev/auth/clerk) and the [Next.js App Router](https://docs.convex.dev/client/nextjs) section (including `nextjs-clerk` template). Share **one** `ConvexReactClient` instance across the app to avoid reconnect churn.

4. **Server Components, Server Actions, Route Handlers** — [Next.js doc — Server and client side](https://docs.convex.dev/client/nextjs#server-and-client-side): use each vendor’s **Next.js SDK** to obtain suitable **OpenID JWTs** for server-side Convex calls; **additional `.env.local` vars** are required for hybrid setups.

5. **Identity in Convex functions** — In `query` / `mutation` / `action` handlers, use **`await ctx.auth.getUserIdentity()`** ([Auth in Functions](https://docs.convex.dev/auth/functions-auth)). A non-null identity includes at least **`subject`**, **`issuer`**, and **`tokenIdentifier`**; other claims depend on the provider ([User identity fields](https://docs.convex.dev/auth/functions-auth#user-identity-fields)).

6. **Passing tokens from React** — Documented pattern: **authenticated WebSocket / RPC** via the React integration (e.g. **Clerk** or **Auth0** + Convex provider components above) so subscriptions and mutations run **as the signed-in user** ([Next.js — Adding authentication](https://docs.convex.dev/client/nextjs#adding-authentication)). For **HTTP Actions**, the [Auth in Functions](https://docs.convex.dev/auth/functions-auth#http-actions) example uses an **`Authorization: Bearer <JWT>`** header.

7. **Backend / service jobs** — Use [Service Authentication](https://docs.convex.dev/auth#service-authentication): trusted callers invoke **public** functions that check a **shared secret** from the environment—**not** end-user JWTs.

### Risks (Turborepo, Next 15, multiple surfaces)

- **One `convex/` root vs many apps** — Turbo pipelines must run **`convex dev` / codegen** where `convex/` lives and ensure every consumer (`apps/web`, future apps) depends on **fresh `_generated` types** and the **same** `NEXT_PUBLIC_CONVEX_URL` per environment ([Deployment URLs](https://docs.convex.dev/client/react/deployment-urls) pattern).
- **SSR vs client reactivity** — [Next.js — Server rendering](https://docs.convex.dev/client/nextjs#server-rendering-ssr): reactive UI needs **Client Components** and a live client; preloading and server-side data fetch are **separate** concerns—read the dedicated [Server Rendering (App Router)](https://docs.convex.dev/client/nextjs/app-router/server-rendering) page to avoid duplicating auth/token bugs between RSC and hooks.
- **Token alignment across surfaces** — [Next.js](https://docs.convex.dev/client/nextjs#other-providers) states Convex expects **OIDC JWTs** on both client and server paths; each surface must obtain tokens the deployment trusts (**same issuer/audience** configuration as in the dashboard).
- **Convex Auth / Next** — If using **Convex Auth**, factor in **beta** and **in-progress Next.js** support ([Authentication — Convex Auth](https://docs.convex.dev/auth#the-convex-auth-library)).
- **Actions limits and idempotency** — [Actions — Limits](https://docs.convex.dev/functions/actions#limits): **10-minute** timeout; **no automatic retry** on failure (unlike mutations). Long extraction pipelines need explicit status fields, retries at the app level, and care with side effects (e.g. paid APIs).
- **Parallel actions** — [Actions](https://docs.convex.dev/functions/actions#calling-actions-from-clients): actions from one client are **parallelized** vs mutations’ ordering semantics—if steps must be sequential, enforce that in code (await in one action, or chain mutation → scheduled internal action).
