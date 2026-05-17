import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Clip, CreateClipInput } from '@wijzer/core';
import type { ClipRepository } from './clip-repository.js';

type StoreFile = {
  clips: Clip[];
};

function findMonorepoRoot(): string {
  let dir = process.cwd();
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }
    dir = dirname(dir);
  }
  return process.cwd();
}

export class FileClipRepository implements ClipRepository {
  constructor(private readonly filePath: string) {}

  static defaultPath(): string {
    const envPath = process.env.WIJZER_CLIP_STORE_PATH;
    if (envPath) {
      return resolve(envPath);
    }
    return resolve(findMonorepoRoot(), '.data', 'clips.json');
  }

  private async readStore(): Promise<StoreFile> {
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as StoreFile;
      if (!Array.isArray(parsed.clips)) {
        return { clips: [] };
      }
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { clips: [] };
      }
      throw error;
    }
  }

  private async writeStore(store: StoreFile): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(store, null, 2), 'utf-8');
  }

  async create(input: CreateClipInput): Promise<Clip> {
    const store = await this.readStore();
    const clip: Clip = {
      id: randomUUID(),
      ...input,
      createdAt: new Date().toISOString(),
    };
    store.clips.unshift(clip);
    await this.writeStore(store);
    return clip;
  }

  async list(): Promise<Clip[]> {
    const store = await this.readStore();
    return [...store.clips].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  async getById(id: string): Promise<Clip | null> {
    const store = await this.readStore();
    return store.clips.find((c) => c.id === id) ?? null;
  }
}
