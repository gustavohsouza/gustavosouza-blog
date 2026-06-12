import type { LegolizeResult, Placement3D, VoxelGrid } from './types.js';
import { bricksForProfile, type PieceProfile } from './parts.js';
import { buildBom } from './bom.js';

export interface LegolizeOptions {
  profile: PieceProfile;
  /** Single color for the whole build (v2 MVP color mode). */
  colorId: string;
  /**
   * Drop vertical support columns to stud-connect floating sections to the
   * rest of the build (standard MOC practice for hollow/curved shapes).
   */
  autoConnect?: boolean;
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
  if (opts.autoConnect) {
    // Iteratively add support columns under floating sections until the
    // build is connected (or no further progress is possible).
    let current = grid;
    for (let i = 0; i < 12; i++) {
      const res = legolizeOnce(current, opts);
      if (res.components <= 1) return res;
      const next = addSupports(current, res.placements);
      if (!next) return res; // no progress possible; keep the warning
      current = next;
    }
    return legolizeOnce(current, opts);
  }
  return legolizeOnce(grid, opts);
}

function legolizeOnce(grid: VoxelGrid, opts: LegolizeOptions): LegolizeResult {
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
  const labels = componentLabels(placements);
  return new Set(labels).size;
}

/**
 * Add 1x1 support columns under floating components so they stud-connect to
 * whatever is beneath them. Returns null when nothing could be added
 * (every loose component already rests on the ground plane).
 */
function addSupports(grid: VoxelGrid, placements: Placement3D[]): VoxelGrid | null {
  const labels = componentLabels(placements);
  const byComp = new Map<number, Placement3D[]>();
  placements.forEach((p, i) => {
    const list = byComp.get(labels[i]) ?? [];
    list.push(p);
    byComp.set(labels[i], list);
  });
  let main = -1;
  let mainSize = -1;
  for (const [root, list] of byComp) {
    if (list.length > mainSize) {
      mainSize = list.length;
      main = root;
    }
  }

  const { nx, ny, nz } = grid;
  const data = new Uint8Array(grid.data);
  const idx = (x: number, y: number, z: number) => x + z * nx + y * nx * nz;
  let added = false;
  for (const [root, list] of byComp) {
    if (root === main) continue;
    const lowest = list.reduce((a, b) => (b.layer < a.layer ? b : a));
    if (lowest.layer === 0) continue; // already rests on the ground plane
    const x = lowest.x + Math.floor(lowest.sx / 2);
    const z = lowest.z + Math.floor(lowest.sz / 2);
    for (let y = lowest.layer - 1; y >= 0; y--) {
      const i = idx(x, y, z);
      if (data[i] === 1) break; // reached existing structure
      data[i] = 1;
      added = true;
    }
  }
  return added ? { nx, ny, nz, data } : null;
}

function componentLabels(placements: Placement3D[]): number[] {
  if (placements.length === 0) return [];
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
  return placements.map((_, i) => find(i));
}
