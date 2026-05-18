# Production hardening — patch list

Actionable backlog derived from the reliability/logging work on the clip pipeline
and PR review. Scope today is **local-first** per [SECURITY.md](../SECURITY.md); use
this list when you move toward **shared or hosted** deployment or want stricter
defaults everywhere.

How to use: implement as **small PRs** (one theme per PR); tick boxes in GitHub
when merged or consciously deferred.

---

## P0 — Env flags and silent wrong behavior

- [ ] **`WIJZER_MOCK_CLIP` guardrails** — Refuse mock clip mode when
      `NODE_ENV === 'production'` unless an explicit escape hatch is set (e.g.
      `WIJZER_ALLOW_MOCK_CLIP_IN_PRODUCTION=1`). Log once at startup when mock
      is active (dev/CI only by default).
- [ ] **CI / test assertion** — Add a test or build step that ensures mock cannot
      be enabled in production bundles without the escape hatch (e.g. integration
      test against `next start` with forbidden env combo).
- [ ] **Document posture** — Short “deployment posture” in README or SECURITY:
      allowed env vars per environment (dev / CI / prod).

## P1 — API errors and logging hygiene

- [ ] **Stable client errors for gateway failures** — Map `GatewayError` (and
      similar) to **stable** `code` + short user-facing `error` strings; keep
      detailed provider text in **server logs only** (optionally behind
      `x-request-id` correlation).
- [ ] **Validation log redaction** — Truncate or omit raw user URLs/notes in
      `[wijzer:api]` lines if logs are shipped to shared sinks; prefer issue
      codes + field paths only.
- [ ] **Unit tests for `errorResponse`** — Cover `GatewayError`, `WijzerError`,
      generic `Error`, and status mapping ([apps/web/lib/api-error.ts](../apps/web/lib/api-error.ts)).

## P1 — Observability and ops

- [ ] **Request correlation** — Generate a request id (header or internal) and
      include it on API logs and error JSON.
- [ ] **Health / readiness** — Add `GET /api/health` or `/api/ready` (disk
      writable for clip store; optional lazy gateway check behind flag).
- [ ] **Document limits** — POST body size, clip timeout, disk usage expectations;
      link from README.

## P2 — Security baseline (before public HTTP)

- [ ] **Authentication** on mutating routes if not localhost-only (API key or
      session).
- [ ] **Rate limiting** on `POST /api/clips` (per IP or per key).
- [ ] **Dependency & secret scanning** in CI (e.g. audit level policy, secret scan).
- [ ] **CORS / CSRF** if the UI and API diverge by origin or cookies are added.

## P2 — Data and concurrency

- [ ] **Clip store** — Replace or supplement JSON read–modify–write with a safe
      strategy for concurrent `POST` or multiple instances; until then, document
      **single-process** assumption at top of [packages/db/README.md](../packages/db/README.md).
- [ ] **Backup guidance** — Document backup/restore for `WIJZER_CLIP_STORE_PATH`
      / `.data/clips.json`.

## Harness and developer experience

- [ ] **`free-dev-port` safety** — Prefer `SIGTERM` or configurable port over
      unconditional `SIGKILL` on `:3000` ([scripts/free-dev-port.mjs](../scripts/free-dev-port.mjs));
      document behavior for local dev.
- [ ] **Readiness detection** — Reduce brittleness of “wait for `Ready`” in
      harness scripts (explicit port probe or Next-supported health URL).

---

## PR quality checklist (every PR)

Use in description or review template.

- [ ] **Intent** — What user-visible behavior or risk changes; what breaks if wrong.
- [ ] **Tests** — New logic covered or explicit “manual only” steps listed.
- [ ] **CI** — `pnpm exec turbo run build lint typecheck` and `pnpm run test:ci` green.
- [ ] **Env / security** — New vars in `.env.example`; dangerous flags noted in SECURITY or this doc.
- [ ] **Scope** — One theme; drive-by refactors split out.

---

## Phasing suggestion

| Phase | Patches | Goal |
|-------|---------|------|
| A | P0 mock + docs | No accidental mock in real deploys |
| B | P1 errors + tests | Predictable API + reviewable logging |
| C | P1 observability | Operations can debug without browser-only clues |
| D | P2 security + data | Safe enough for intentional public exposure |

---

## Related docs

- [SECURITY.md](../SECURITY.md) — current threat model (local-only MVP)
- [docs/improvements.md](improvements.md) — known limitations
- [docs/spec.md](spec.md) — API specification
