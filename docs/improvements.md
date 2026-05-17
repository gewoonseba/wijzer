# Known issues and improvement areas

This document records **gaps and risks** identified during MVP review. It does **not** prescribe solutions yet — only what exists today and what may need attention before broader use.

Related: [SECURITY.md](../SECURITY.md) (local-only scope), [spec.md](spec.md) (current behavior).

---

## Clip timeout and cancellation

**Issue:** Clip creation is bounded by wall-clock timeout via `Promise.race` in `packages/ai/src/clip-timeout.ts`. `AbortSignal` is passed to AI SDK calls (`generateText`, `clipAgent.generate`) where supported.

**Remaining gap:** Outbound `fetch` in `safeFetch` and YouTube/oEmbed paths do not yet accept or honor `AbortSignal`. After a timeout, some background work may still run until those requests complete.

**Impact:** A timed-out API request may still consume resources briefly; the client receives `504` but work is not fully cancelled end-to-end.

---

## Authentication and API exposure

**Issue:** All clip routes are unauthenticated. Any client that can reach the Next.js server can read and create clips.

**Impact:** Safe for localhost-only MVP; unsafe on a shared or public URL without additional controls.

---

## Request and payload size

**Addressed (limits only):** `createClipRequestSchema` enforces max URL and notes lengths (`packages/core/src/limits.ts`).

**Remaining gaps:**

- No explicit cap on total HTTP body size before JSON parse
- Extracted evidence passed to the model can still be large (transcript/article text truncated in extractors, but gateway prompt includes stringified evidence)

**Impact:** Very large legitimate pages may still produce heavy prompts; maliciously large bodies outside schema fields are not separately rejected.

---

## Error responses

**Addressed:** Non-`WijzerError` failures return a generic `500` message; details are logged server-side only (`apps/web/lib/api-error.ts`).

**Remaining gap:** `WijzerError` messages are still returned to the client as-is (intentional for validation and extraction errors).

---

## File store concurrency

**Issue:** `FileClipRepository` uses read–modify–write on a single JSON file without file locking or a write queue.

**Impact:** Concurrent `POST /api/clips` requests can race; one clip may be lost. Unlikely when clicking sequentially on a laptop; possible under parallel clients or multiple server instances writing the same path.

---

## `safeFetch` and SSRF hardening

**Issue:** Current checks block many private IPv4 ranges, localhost-style hostnames, and re-validate redirect targets. Known limitations for a v1 local tool:

- IPv6 unique local / link-local addresses not comprehensively blocked
- DNS rebinding (hostname resolves to private IP after validation) not mitigated
- Missing `Content-Type` is treated as allowed (bounded by byte cap and extractors)

**Impact:** Acceptable for trusted local use; insufficient alone for an internet-facing URL fetch proxy.

---

## YouTube video ID validation

**Issue:** Video IDs are parsed from URL paths/query but not strictly validated against an expected charset/length before use in oEmbed URL construction.

**Impact:** Odd or malformed IDs may produce failed oEmbed calls rather than injection; tightening validation would harden edge cases.

---

## Metadata confidence scores

**Issue:** `confidence` values in `buildMetadataFromEvidence` are fixed heuristics, not model- or extractor-derived scores.

**Impact:** UI or API consumers should not treat them as calibrated probabilities. Documented here for honesty; labeling in UI is optional follow-up.

---

## Repository singleton and serverless

**Issue:** `getClipRepository()` returns a process-level singleton. Multiple Node processes (or serverless instances) each have separate memory and may write the same `WIJZER_CLIP_STORE_PATH` file.

**Impact:** Same as file concurrency — multiple writers to one JSON path without coordination.

---

## CI and regression checks

**Issue:** Pull request review noted that `pnpm build` was not always run in the review environment.

**Impact:** Regressions may slip through without a CI workflow on PRs. Adding CI is an operational improvement, not an application bug.

---

## AI Gateway and summarization modes

**Issue:** Without `AI_GATEWAY_API_KEY`, summarization uses a local template over extracted text (real extraction, non-LLM summary). With a key, behavior depends on `WIJZER_USE_AGENT` (agent vs deterministic pipeline).

**Impact:** Behavior differs by environment; easy to mistake “app works” for “AI summarization works” if the key is missing.

---

## Phase 2 areas (already planned, not issues per se)

- Convex-backed persistence and optional auth
- Chat API (`POST /api/chat`) and `chatAgent`
- Podcast/PDF extractors and paywalled article fetchers

See [convex-migration.md](convex-migration.md) and [apps/web/app/api/chat/README.md](../apps/web/app/api/chat/README.md).
