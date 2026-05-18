export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { config } = await import('dotenv');
    const { resolve } = await import('node:path');
    config({ path: resolve(process.cwd(), '.env.local') });
    config({ path: resolve(process.cwd(), '../../.env.local') });
  }
}
