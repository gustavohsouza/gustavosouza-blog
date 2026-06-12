import type { BrickColor, LegolizeResult, Placement3D, VoxelGrid } from './types.js';
import { bricksForProfile, type PieceProfile } from './parts.js';
import { buildBom } from './bom.js';
import { nearestIndex, rgbToLab, withLab } from './colors.js';

export interface LegolizeOptions {
  profile: PieceProfile;
  /** Fallback/single color for the build (used where no sampled color exists). */
  colorId: string;
  /**
   * Drop vertical support columns to stud-connect floating sections to the
   * rest of the build (standard MOC practice for hollow/curved shapes).
   */
  autoConnect?: boolean;
  /**
   * When the grid carries sampled colors (grid.rgb), quantize them to this
   * palette and build in color; bricks never span two colors.
   */
  palette?: BrickColor[];
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
    let res = legolizeOnce(current, opts);
    for (let i = 0; i < 12 && res.components > 1; i++) {
      const next = addSupports(current, res.placements);
      if (!next) break; // remaining loose sections rest on the ground
      current = next;
      res = legolizeOnce(current, opts);
    }
    // Ground-level "woven patches" (common at color boundaries) are fixed by
    // re-tiling two same-color neighbors with a brick across the seam.
    if (res.components > 1) res = stitchComponents(res, opts);
    return res;
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

  // Per-voxel palette index (-1 = fallback color). Interior voxels with no
  // sampled color inherit the nearest assigned color in their layer scan
  // order implicitly via the fallback, which stays hidden inside the build.
  const voxColor = quantizeVoxelColors(grid, opts);
  const colorIdOf = (ci: number) => (ci >= 0 && opts.palette ? opts.palette[ci].id : opts.colorId);

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
        const ci = voxColor ? voxColor[i] : -1;
        for (const c of cands) {
          if (x + c.sx > nx || z + c.sz > nz) continue;
          if (!fits(data, used, nx, nz, x, y, z, c.sx, c.sz, idx, voxColor, ci)) continue;
          for (let dz = 0; dz < c.sz; dz++) {
            for (let dx = 0; dx < c.sx; dx++) used[idx(x + dx, y, z + dz)] = 1;
          }
          placements.push({ partId: c.partId, colorId: colorIdOf(ci), x, z, layer: y, sx: c.sx, sz: c.sz });
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
  voxColor: Int16Array | null,
  color: number,
): boolean {
  for (let dz = 0; dz < sz; dz++) {
    for (let dx = 0; dx < sx; dx++) {
      const i = idx(x + dx, y, z + dz);
      if (data[i] !== 1 || used[i]) return false;
      if (voxColor && voxColor[i] !== color) return false;
    }
  }
  return true;
}

/** Quantize sampled voxel colors to the palette; null when running single-color. */
function quantizeVoxelColors(grid: VoxelGrid, opts: LegolizeOptions): Int16Array | null {
  if (!grid.rgb || !opts.palette || opts.palette.length === 0) return null;
  const lab = withLab(opts.palette);
  const out = new Int16Array(grid.data.length).fill(-1);
  for (let i = 0; i < grid.data.length; i++) {
    if (grid.data[i] !== 1) continue;
    const r = grid.rgb[i * 3];
    if (r < 0) continue; // unsampled (interior / support) -> fallback color
    out[i] = nearestIndex(rgbToLab(r, grid.rgb[i * 3 + 1], grid.rgb[i * 3 + 2]), lab);
  }
  return out;
}

/** Union-find over bricks; an edge = stud connection between vertically adjacent overlapping bricks. */
function countComponents(placements: Placement3D[]): number {
  const labels = componentLabels(placements);
  return new Set(labels).size;
}

/**
 * Connect loose components by re-tiling: pick a brick from the loose
 * component and a side-adjacent same-layer same-color brick from another
 * component, then cover their combined cells again with one brick forced
 * across the seam. Coverage and colors are preserved exactly.
 */
function stitchComponents(res: LegolizeResult, opts: LegolizeOptions): LegolizeResult {
  const placements = [...res.placements];
  for (let round = 0; round < 24; round++) {
    const labels = componentLabels(placements);
    const comps = new Set(labels);
    if (comps.size <= 1) break;
    // Largest component is "main"; try to stitch any other into a different one.
    const sizes = new Map<number, number>();
    for (const l of labels) sizes.set(l, (sizes.get(l) ?? 0) + 1);
    const main = [...sizes.entries()].sort((a, b) => b[1] - a[1])[0][0];

    let stitched = false;
    outer: for (let bi = 0; bi < placements.length && !stitched; bi++) {
      if (labels[bi] === main) continue;
      const b = placements[bi];
      for (let ai = 0; ai < placements.length; ai++) {
        if (labels[ai] !== main) continue;
        const a = placements[ai];
        if (a.layer !== b.layer || a.colorId !== b.colorId) continue;
        const seam = sharedSeamCells(a, b);
        if (!seam) continue;
        const replacement = retileAcrossSeam(a, b, seam);
        if (!replacement) continue;
        const keep = placements.filter((_, i) => i !== ai && i !== bi);
        placements.length = 0;
        placements.push(...keep, ...replacement);
        stitched = true;
        break outer;
      }
    }
    if (!stitched) break; // nothing stitchable (e.g. truly separate objects)
  }

  const components = countComponents(placements);
  const warnings: string[] = [];
  if (components > 1) {
    warnings.push(
      `Build has ${components} disconnected sections — some pieces are not attached to the rest. ` +
        'Try a higher resolution, a solid (non-hollow) interior, or accept gluing the loose sections.',
    );
  }
  return { placements, bom: buildBom(placements), grid: res.grid, components, warnings };
}

/** Adjacent cell pair (one in a, one in b) across a shared edge, or null. */
function sharedSeamCells(a: Placement3D, b: Placement3D): { ax: number; az: number; bx: number; bz: number } | null {
  // b to the right of a (or vice versa) along x
  if (a.z < b.z + b.sz && b.z < a.z + a.sz) {
    const z = Math.max(a.z, b.z);
    if (a.x + a.sx === b.x) return { ax: b.x - 1, az: z, bx: b.x, bz: z };
    if (b.x + b.sx === a.x) return { ax: a.x, az: z, bx: a.x - 1, bz: z };
  }
  // along z
  if (a.x < b.x + b.sx && b.x < a.x + a.sx) {
    const x = Math.max(a.x, b.x);
    if (a.z + a.sz === b.z) return { ax: x, az: b.z - 1, bx: x, bz: b.z };
    if (b.z + b.sz === a.z) return { ax: x, az: a.z, bx: x, bz: a.z - 1 };
  }
  return null;
}

/** Re-cover the union of two bricks with a 1x2 across the seam + greedy fill. */
function retileAcrossSeam(
  a: Placement3D,
  b: Placement3D,
  seam: { ax: number; az: number; bx: number; bz: number },
): Placement3D[] | null {
  const cells = new Set<string>();
  for (const p of [a, b]) {
    for (let dx = 0; dx < p.sx; dx++) {
      for (let dz = 0; dz < p.sz; dz++) cells.add(`${p.x + dx},${p.z + dz}`);
    }
  }
  const out: Placement3D[] = [];
  const take = (x: number, z: number, sx: number, sz: number, partId: string) => {
    for (let dx = 0; dx < sx; dx++) for (let dz = 0; dz < sz; dz++) cells.delete(`${x + dx},${z + dz}`);
    out.push({ partId, colorId: a.colorId, x, z, layer: a.layer, sx, sz });
  };

  // The stitch: a 1x2 brick spanning both sides of the seam.
  const alongX = seam.az === seam.bz;
  const x0 = Math.min(seam.ax, seam.bx);
  const z0 = Math.min(seam.az, seam.bz);
  take(x0, z0, alongX ? 2 : 1, alongX ? 1 : 2, '3004');

  // Greedy-fill the leftover cells (1x1 always available, so this terminates).
  const sizes: Array<[number, number, string]> = [
    [2, 4, '3001'], [4, 2, '3001'], [2, 3, '3002'], [3, 2, '3002'], [2, 2, '3003'],
    [1, 4, '3010'], [4, 1, '3010'], [1, 3, '3622'], [3, 1, '3622'], [1, 2, '3004'], [2, 1, '3004'],
    [1, 1, '3005'],
  ];
  while (cells.size > 0) {
    const [cx, cz] = [...cells][0].split(',').map(Number);
    for (const [sx, sz, partId] of sizes) {
      let ok = true;
      for (let dx = 0; dx < sx && ok; dx++) {
        for (let dz = 0; dz < sz && ok; dz++) {
          if (!cells.has(`${cx + dx},${cz + dz}`)) ok = false;
        }
      }
      if (ok) {
        take(cx, cz, sx, sz, partId);
        break;
      }
    }
  }
  return out;
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
  return added ? { nx, ny, nz, data, rgb: grid.rgb } : null;
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
