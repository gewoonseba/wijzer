# Wijzer demo guide

## What you need

| Requirement | Purpose |
|-------------|---------|
| Node.js 20+ | Runtime |
| pnpm 9+ | Monorepo installs |
| **AI_GATEWAY_API_KEY** | Live clipping (agent calls Vercel AI Gateway) |

Without the API key you can still run the app and browse **seeded** clips, but `POST /api/clips` will fail when the agent runs.

## 1. One-time setup

```bash
git clone https://github.com/gewoonseba/wijzer.git
cd wijzer
git checkout cursor/wijzer-mvp-64b9   # or main after merge
pnpm install
cp .env.example apps/web/.env.local
```

Edit **`apps/web/.env.local`**:

```env
AI_GATEWAY_API_KEY=your_key_here
```

Create a key: [Vercel AI Gateway API keys](https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai-gateway%2Fapi-keys&title=AI+Gateway+API+Keys)

## 2. Run the app

```bash
pnpm dev
```

Open **http://localhost:3000**

## 3. Try a clip manually

1. Paste a URL (YouTube with captions works well for a first test).
2. Add markdown notes, e.g. `## Why I saved this\n\n- Point one`
3. Click **Clip** and wait (often 30–90 seconds).
4. You land on the clip detail page with **Clip** (AI summary) and **Your notes** (unchanged).

Example URLs:

- YouTube: `https://www.youtube.com/watch?v=jNQXAC9IVRw`
- Article: any public blog post URL

## 4. Record a demo video

With `pnpm dev` running on port 3000:

```bash
# Full flow: paste URL + notes → Clip → detail page
node scripts/record-demo-full.mjs
```

Output: `demo-output/wijzer-demo-full.webm` (or set `DEMO_OUT_DIR`).

Uses `https://www.youtube.com/watch?v=dQw4w9WgXcQ` by default (has captions).

## 5. Automated E2E verification

```bash
pnpm dev   # separate terminal
node scripts/e2e-live-clip.mjs
```

Checks `POST /api/clips` returns 201, preserves notes, and produces clip content.

## 5. Smoke tests (no API key)

```bash
pnpm verify:setup
pnpm build
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Auth / 401 on clip | Set `AI_GATEWAY_API_KEY` in `apps/web/.env.local` and restart `pnpm dev` |
| YouTube 422 | Video has no captions; try another URL |
| Localhost URL blocked | Expected — SSRF protection blocks private URLs |
| Empty clip list | Create a clip or run `node scripts/seed-demo-clip.mjs` |

## Cloud Agent / CI

If you use Cursor Cloud Agents, add **`AI_GATEWAY_API_KEY`** to the agent’s environment secrets. For **local** `pnpm dev`, the same key must be in **`apps/web/.env.local`** (Next.js does not read Cursor secrets automatically).
