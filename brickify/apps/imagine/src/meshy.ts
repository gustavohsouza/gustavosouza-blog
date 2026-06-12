/**
 * Client for the Meshy image-to-3D API (https://docs.meshy.ai).
 *
 * Cost control: generation only runs with a user-provided API key, and a
 * local monthly counter enforces a soft cap so a forgotten tab can't burn
 * through credits. If the API blocks browser calls (CORS), the UI suggests
 * a proxy base URL or the upload-a-mesh fallback.
 */

const DEFAULT_BASE = 'https://api.meshy.ai/openapi/v1';

export interface GenerationProgress {
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | string;
  progress: number; // 0..100
}

export interface MeshyOptions {
  apiKey: string;
  baseUrl?: string;
  onProgress?: (p: GenerationProgress) => void;
  signal?: AbortSignal;
}

const USAGE_KEY = 'brickify-meshy-usage';

export function monthlyUsage(): { month: string; count: number } {
  const month = new Date().toISOString().slice(0, 7);
  try {
    const raw = JSON.parse(localStorage.getItem(USAGE_KEY) ?? 'null');
    if (raw && raw.month === month) return raw;
  } catch {
    // corrupted storage: reset below
  }
  return { month, count: 0 };
}

function bumpUsage(): void {
  const u = monthlyUsage();
  localStorage.setItem(USAGE_KEY, JSON.stringify({ month: u.month, count: u.count + 1 }));
}

export const MONTHLY_CAP = 25;

/** Generate a 3D model from an image; resolves to the GLB file bytes. */
export async function imageTo3d(imageDataUrl: string, opts: MeshyOptions): Promise<ArrayBuffer> {
  if (monthlyUsage().count >= MONTHLY_CAP) {
    throw new Error(
      `Monthly generation cap reached (${MONTHLY_CAP}). Raise MONTHLY_CAP in meshy.ts if your budget allows.`,
    );
  }
  const base = (opts.baseUrl || DEFAULT_BASE).replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${opts.apiKey}`, 'Content-Type': 'application/json' };

  const create = await fetch(`${base}/image-to-3d`, {
    method: 'POST',
    headers,
    signal: opts.signal,
    body: JSON.stringify({
      image_url: imageDataUrl,
      should_remesh: true,
      should_texture: false,
      enable_pbr: false,
    }),
  }).catch((e) => {
    throw new Error(
      `Could not reach the Meshy API (${e instanceof Error ? e.message : e}). ` +
        'If this is a CORS block, set a proxy base URL in the settings, or upload a 3D file instead.',
    );
  });
  if (!create.ok) throw new Error(`Meshy API error ${create.status}: ${await create.text()}`);
  bumpUsage();
  const taskId: string = (await create.json()).result;

  // Poll until the task settles.
  for (;;) {
    await new Promise((r) => setTimeout(r, 4000));
    const res = await fetch(`${base}/image-to-3d/${taskId}`, { headers, signal: opts.signal });
    if (!res.ok) throw new Error(`Meshy API error ${res.status}: ${await res.text()}`);
    const task = await res.json();
    opts.onProgress?.({ status: task.status, progress: task.progress ?? 0 });
    if (task.status === 'SUCCEEDED') {
      const glbUrl: string | undefined = task.model_urls?.glb;
      if (!glbUrl) throw new Error('Meshy task finished but returned no GLB URL');
      const glb = await fetch(glbUrl, { signal: opts.signal });
      if (!glb.ok) throw new Error(`Could not download generated model (${glb.status})`);
      return glb.arrayBuffer();
    }
    if (task.status === 'FAILED' || task.status === 'CANCELED') {
      throw new Error(`Generation ${task.status.toLowerCase()}: ${task.task_error?.message ?? 'unknown error'}`);
    }
  }
}
