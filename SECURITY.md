# Security — local-only MVP

Wijzer in this repository is intended for **local, single-user** use on your machine (e.g. `pnpm dev` on `localhost`). It is **not** hardened for shared or public deployment.

## Current exposure

| Surface | Risk on a shared host |
|---------|------------------------|
| `GET /api/clips` | Anyone who can reach the app can list all clips |
| `POST /api/clips` | Anyone can create clips (triggers outbound fetches and optional AI calls) |
| `.data/clips.json` | All clip content stored in plaintext on disk |

There is **no authentication**, **no authorization**, and **no rate limiting** in the MVP.

## Local use expectations

- Run the web app bound to **localhost** only unless you understand the risks.
- Do not expose port 3000 to your LAN or the internet without additional controls.
- Treat `.data/clips.json` as sensitive if your notes or clipped content are private.
- Keep `AI_GATEWAY_API_KEY` in `apps/web/.env.local` (gitignored), not in committed files.

## Out of scope for this MVP

- User accounts and per-user clip isolation
- Encrypted storage
- Production SSRF hardening beyond current `safeFetch` (see [docs/improvements.md](docs/improvements.md))

For a future hosted deployment, review [docs/improvements.md](docs/improvements.md) and [docs/convex-migration.md](docs/convex-migration.md) before going public.
