import type { VoxelGrid } from './types.js';

/** Brick height / stud pitch (9.6mm / 8mm). Voxels are not cubes. */
export const BRICK_ASPECT = 1.2;

export interface VoxelizeOptions {
  /** Target size in studs along the model's longest horizontal axis (or in bricks if vertical). */
  targetStuds: number;
}

/**
 * Voxelize a triangle soup into a solid stud-pitch grid.
 *
 * Robust for imperfect meshes: marks surface voxels by sampling triangles,
 * then flood-fills the exterior; everything not reachable from outside is
 * solid. Open meshes degrade to a surface shell instead of failing.
 *
 * @param positions De-indexed triangle vertices, 9 floats per triangle (x,y,z * 3),
 *                  with +Y up.
 */
export function voxelize(positions: Float32Array, opts: VoxelizeOptions): VoxelGrid {
  if (positions.length < 9 || positions.length % 9 !== 0) {
    throw new Error('positions must contain whole triangles (9 floats each)');
  }
  const target = Math.max(2, Math.floor(opts.targetStuds));

  // Bounding box
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    minX = Math.min(minX, positions[i]); maxX = Math.max(maxX, positions[i]);
    minY = Math.min(minY, positions[i + 1]); maxY = Math.max(maxY, positions[i + 1]);
    minZ = Math.min(minZ, positions[i + 2]); maxZ = Math.max(maxZ, positions[i + 2]);
  }
  const sx = maxX - minX, sy = maxY - minY, sz = maxZ - minZ;
  if (sx <= 0 && sy <= 0 && sz <= 0) throw new Error('Degenerate mesh (zero size)');

  // Voxel pitch: s in x/z, BRICK_ASPECT*s in y, sized so the longest axis maps to `target` cells.
  const s = Math.max(sx / target, sz / target, sy / (target * BRICK_ASPECT)) || 1e-9;
  const hy = s * BRICK_ASPECT;
  const nx = Math.max(1, Math.ceil(sx / s - 1e-6));
  const nz = Math.max(1, Math.ceil(sz / s - 1e-6));
  const ny = Math.max(1, Math.ceil(sy / hy - 1e-6));

  const data = new Uint8Array(nx * ny * nz);
  const SURFACE = 1, EXTERIOR = 2;
  const idx = (x: number, y: number, z: number) => x + z * nx + y * nx * nz;

  // 1) Mark surface voxels by sampling each triangle at sub-voxel spacing.
  const step = Math.min(s, hy) * 0.5;
  const mark = (px: number, py: number, pz: number) => {
    const x = Math.min(nx - 1, Math.max(0, Math.floor((px - minX) / s)));
    const y = Math.min(ny - 1, Math.max(0, Math.floor((py - minY) / hy)));
    const z = Math.min(nz - 1, Math.max(0, Math.floor((pz - minZ) / s)));
    data[idx(x, y, z)] = SURFACE;
  };
  for (let t = 0; t < positions.length; t += 9) {
    const ax = positions[t], ay = positions[t + 1], az = positions[t + 2];
    const bx = positions[t + 3], by = positions[t + 4], bz = positions[t + 5];
    const cx = positions[t + 6], cy = positions[t + 7], cz = positions[t + 8];
    const e1 = Math.hypot(bx - ax, by - ay, bz - az);
    const e2 = Math.hypot(cx - ax, cy - ay, cz - az);
    const n1 = Math.max(1, Math.ceil(e1 / step));
    const n2 = Math.max(1, Math.ceil(e2 / step));
    for (let i = 0; i <= n1; i++) {
      for (let j = 0; j <= n2 - (i * n2) / n1; j++) {
        const u = i / n1;
        const v = j / n2;
        const w = 1 - u - v;
        if (w < -1e-9) continue;
        mark(w * ax + u * bx + v * cx, w * ay + u * by + v * cy, w * az + u * bz + v * cz);
      }
    }
  }

  // 2) Flood-fill exterior from every empty boundary cell (6-connectivity).
  const queue: number[] = [];
  for (let y = 0; y < ny; y++) {
    for (let z = 0; z < nz; z++) {
      for (let x = 0; x < nx; x++) {
        if (x === 0 || y === 0 || z === 0 || x === nx - 1 || y === ny - 1 || z === nz - 1) {
          const i = idx(x, y, z);
          if (data[i] === 0) {
            data[i] = EXTERIOR;
            queue.push(i);
          }
        }
      }
    }
  }
  const layerStride = nx * nz;
  while (queue.length) {
    const i = queue.pop()!;
    const x = i % nx;
    const z = Math.floor(i / nx) % nz;
    const y = Math.floor(i / layerStride);
    const tryCell = (j: number) => {
      if (data[j] === 0) {
        data[j] = EXTERIOR;
        queue.push(j);
      }
    };
    if (x > 0) tryCell(i - 1);
    if (x < nx - 1) tryCell(i + 1);
    if (z > 0) tryCell(i - nx);
    if (z < nz - 1) tryCell(i + nx);
    if (y > 0) tryCell(i - layerStride);
    if (y < ny - 1) tryCell(i + layerStride);
  }

  // 3) Solid = surface + enclosed interior.
  const out = new Uint8Array(nx * ny * nz);
  for (let i = 0; i < data.length; i++) out[i] = data[i] === EXTERIOR ? 0 : 1;
  return { nx, ny, nz, data: out };
}

/**
 * Hollow a solid grid: keep only voxels within `shell` cells of an empty
 * neighbor (big builds get dramatically cheaper and lighter).
 */
export function hollow(grid: VoxelGrid, shell = 1): VoxelGrid {
  const { nx, ny, nz, data } = grid;
  const idx = (x: number, y: number, z: number) => x + z * nx + y * nx * nz;
  const isEmpty = (x: number, y: number, z: number) =>
    x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz || data[idx(x, y, z)] === 0;

  // Multi-source BFS distance-to-empty, capped at shell+1.
  const dist = new Int16Array(nx * ny * nz).fill(-1);
  let frontier: number[] = [];
  for (let y = 0; y < ny; y++) {
    for (let z = 0; z < nz; z++) {
      for (let x = 0; x < nx; x++) {
        const i = idx(x, y, z);
        if (data[i] === 1 && (isEmpty(x - 1, y, z) || isEmpty(x + 1, y, z) || isEmpty(x, y - 1, z) ||
            isEmpty(x, y + 1, z) || isEmpty(x, y, z - 1) || isEmpty(x, y, z + 1))) {
          dist[i] = 1;
          frontier.push(i);
        }
      }
    }
  }
  const layerStride = nx * nz;
  let d = 1;
  while (frontier.length && d < shell) {
    const next: number[] = [];
    for (const i of frontier) {
      const x = i % nx;
      const z = Math.floor(i / nx) % nz;
      const y = Math.floor(i / layerStride);
      for (const j of [
        x > 0 ? i - 1 : -1, x < nx - 1 ? i + 1 : -1,
        z > 0 ? i - nx : -1, z < nz - 1 ? i + nx : -1,
        y > 0 ? i - layerStride : -1, y < ny - 1 ? i + layerStride : -1,
      ]) {
        if (j >= 0 && data[j] === 1 && dist[j] === -1) {
          dist[j] = d + 1;
          next.push(j);
        }
      }
    }
    frontier = next;
    d++;
  }
  const out = new Uint8Array(nx * ny * nz);
  for (let i = 0; i < data.length; i++) out[i] = data[i] === 1 && dist[i] !== -1 ? 1 : 0;
  return { nx, ny, nz, data: out };
}
