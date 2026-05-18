# @wijzer/db

Clip persistence layer.

## MVP

- **`FileClipRepository`** — default; stores clips in `.data/clips.json` at monorepo root
- **`InMemoryClipRepository`** — for tests only

## Usage

```ts
import { getClipRepository } from '@wijzer/db';

const clip = await getClipRepository().create(input);
```

Override path: `WIJZER_CLIP_STORE_PATH=/absolute/path/clips.json`

See [docs/convex-migration.md](../../docs/convex-migration.md) for Convex.
