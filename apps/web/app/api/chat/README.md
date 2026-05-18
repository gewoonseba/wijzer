# Chat API (Phase 2)

The conversational API is **not implemented in MVP**.

Future endpoint: `POST /api/chat`

Planned behavior:

- `chatAgent` (`ToolLoopAgent`) with tools: `searchClips`, `getClipById`
- Uses the same `ClipRepository` (Convex-backed later)
- Streaming via `createAgentUIStreamResponse`

Clip creation remains on `POST /api/clips` via `clipAgent`.
