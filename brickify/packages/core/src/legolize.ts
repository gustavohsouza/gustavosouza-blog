import type { LegolizeResult, Placement3D, VoxelGrid } from './types.js';
import { bricksForProfile, type PieceProfile } from './parts.js';
import { buildBom } from './bom.js';

export interface LegolizeOptions {
  profile: PieceProfile;
  /** Single color for the whole build (v2 MVP color mode). */
  colorId: string;
}

/**
 * Cover a voxel grid with real bricks, layer by layer.
 *
 * Stability comes from staggering seams: alternate layers prefer the
 * opposite brick orientation and a shifted scan phase, so bricks overlap the
 * joints below them (standard "brick bonding"). A stud-connectivity graph is
 * then checked; multiple components mean parts of the build are not attached
 * to each other and are reported as warnings.
 */
export function legolize(grid: VoxelGrid, opts: LegolizeOptions): LegolizeResult {
  const { nx, ny, nz, data } = grid;
  const bricks = bricksForProfile(opts.profile);

  // Oriented candidates: sx along x, sz along z.
  type Cand = { partId: string; sx: number; sz: number; area: number };
  const all: Cand[] = [];
  for (const b of bricks) {
    all.push({ partId: b.id, sx: b.l, sz: b.w, area: b.w * b.l });
    if (b.w !== b.l) all.push({ partId: b.id, sx: b.w, sz: b.l, area: b.w * b.l });
  }
  // Two preference orders: long-axis-along-x first vs along-z first.
  const alongX = [...all].sort((a, b) => b.area - a.area || b.sx - a.sx);
  const alongZ = [...all].sort((a, b) => b.area - a.area || b.sz - a.sz);

  const idx = (x: number, y: number, z: number) => x + z * nx + y * nx * nz;
  const used = new Uint8Array(nx * ny * nz);
  const placements: Placement3D[] = [];

  for (let y = 0; y < ny; y++) {
    const cands = y % 2 === 0 ? alongX : alongZ;
    // Shift the scan phase on odd layers so seams stagger even in uniform rows.
    const phase = y % 2;
    for (let zz = 0; zz < nz; zz++) {
      const z = (zz + phase) % nz;
      for (let xx = 0; xx < nx; xx++) {
        const x = (xx + phase) % nx;
        const i = idx(x, y, z);
        if (data[i] !== 1 || used[i]) continue;
        for (const c of cands) {
          if (x + c.sx > nx || z + c.sz > nz) continue;
          if (!fits(data, used, nx, nz, x, y, z, c.sx, c.sz, idx)) continue;
          for (let dz = 0; dz < c.sz; dz++) {
            for (let dx = 0; dx < c.sx; dx++) used[idx(x + dx, y, z + dz)] = 1;
          }
          placements.push({ partId: c.partId, colorId: opts.colorId, x, z, layer: y, sx: c.sx, sz: c.sz });
          break; // 1x1 is always in the candidate list
        }
      }
    }
  }

  const components = countComponents(placements);
  const warnings: string[] = [];
  if (components > 1) {
    warnings.push(
      `Build has ${components} disconnected sections — some pieces are not attached to the rest. ` +
        'Try a higher resolution, a solid (non-hollow) interior, or accept gluing the loose sections.',
    );
  }
  return { placements, bom: buildBom(placements), grid, components, warnings };
}

function fits(
  data: Uint8Array,
  used: Uint8Array,
  nx: number,
  nz: number,
  x: number,
  y: number,
  z: number,
  sx: number,
  sz: number,
  idx: (x: number, y: number, z: number) => number,
): boolean {
  for (let dz = 0; dz < sz; dz++) {
    for (let dx = 0; dx < sx; dx++) {
      const i = idx(x + dx, y, z + dz);
      if (data[i] !== 1 || used[i]) return false;
    }
  }
  return true;
}

/** Union-find over bricks; an edge = stud connection between vertically adjacent overlapping bricks. */
function countComponents(placements: Placement3D[]): number {
  if (placements.length === 0) return 0;
  const parent = placements.map((_, i) => i);
  const find = (a: number): number => (parent[a] === a ? a : (parent[a] = find(parent[a])));
  const union = (a: number, b: number) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  const byLayer = new Map<number, number[]>();
  placements.forEach((p, i) => {
    const list = byLayer.get(p.layer) ?? [];
    list.push(i);
    byLayer.set(p.layer, list);
  });
  for (const [layer, list] of byLayer) {
    const above = byLayer.get(layer + 1);
    if (!above) continue;
    for (const i of list) {
      const a = placements[i];
      for (const j of above) {
        const b = placements[j];
        if (a.x < b.x + b.sx && b.x < a.x + a.sx && a.z < b.z + b.sz && b.z < a.z + a.sz) union(i, j);
      }
    }
  }
  const roots = new Set<number>();
  for (let i = 0; i < placements.length; i++) roots.add(find(i));
  return roots.size;
}
