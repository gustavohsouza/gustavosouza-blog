import { describe, expect, it } from 'vitest';
import {
  buildMosaic,
  mergePlates,
  paletteForPreset,
  PALETTE,
  COLOR_BY_ID,
  toBrickLinkXml,
  toCsv,
  voxelize,
  hollow,
  legolize,
  toLdr,
  buildBom,
} from '../src/index.js';

function flatImage(w: number, h: number, rgb: [number, number, number]): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    px[i * 4] = rgb[0];
    px[i * 4 + 1] = rgb[1];
    px[i * 4 + 2] = rgb[2];
    px[i * 4 + 3] = 255;
  }
  return px;
}

describe('mosaic', () => {
  it('quantizes a pure red image to Red for every stud', () => {
    const res = buildMosaic(flatImage(8, 8, [201, 26, 9]), {
      width: 8,
      height: 8,
      palette: PALETTE,
      dither: false,
      piece: 'plate',
      optimizeCost: false,
    });
    const red = res.palette.findIndex((c) => c.id === 'red');
    expect(Array.from(res.grid).every((v) => v === red)).toBe(true);
    expect(res.placements).toHaveLength(64);
    expect(res.bom.totalPieces).toBe(64);
  });

  it('merge covers every stud exactly once and cuts piece count', () => {
    const w = 16, h = 16;
    const res = buildMosaic(flatImage(w, h, [201, 26, 9]), {
      width: w,
      height: h,
      palette: PALETTE,
      dither: false,
      piece: 'plate',
      optimizeCost: true,
    });
    const covered = new Uint8Array(w * h);
    for (const p of res.placements) {
      for (let dy = 0; dy < p.h; dy++) {
        for (let dx = 0; dx < p.w; dx++) {
          const i = (p.row + dy) * w + (p.col + dx);
          expect(covered[i]).toBe(0); // no overlaps
          covered[i] = 1;
        }
      }
    }
    expect(Array.from(covered).every((v) => v === 1)).toBe(true); // full coverage
    expect(res.placements.length).toBeLessThan(w * h); // actually merged
    // 16x16 flat color should be dominated by 2x8 plates: 16 of them
    expect(res.placements.length).toBeLessThanOrEqual(16);
  });

  it('merge respects color boundaries', () => {
    const w = 4, h = 2;
    const px = flatImage(w, h, [201, 26, 9]);
    // right half pure blue
    for (const i of [2, 3, 6, 7]) {
      px[i * 4] = 0;
      px[i * 4 + 1] = 85;
      px[i * 4 + 2] = 191;
    }
    const res = buildMosaic(px, {
      width: w,
      height: h,
      palette: PALETTE,
      dither: false,
      piece: 'plate',
      optimizeCost: true,
    });
    for (const p of res.placements) {
      // each placement stays within one half
      expect(p.col < 2 ? p.col + p.w <= 2 : p.col >= 2).toBe(true);
    }
  });

  it('uses round plates / tiles as fixed 1x1 pieces', () => {
    for (const [piece, partId] of [
      ['roundPlate', '4073'],
      ['tile', '3070'],
    ] as const) {
      const res = buildMosaic(flatImage(4, 4, [255, 255, 255]), {
        width: 4,
        height: 4,
        palette: PALETTE,
        dither: false,
        piece,
        optimizeCost: true, // ignored for non-plate pieces
      });
      expect(res.placements.every((p) => p.partId === partId && p.w === 1 && p.h === 1)).toBe(true);
    }
  });

  it('dithering still produces valid palette indices', () => {
    const w = 8, h = 8;
    const px = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      px[i * 4] = (i * 37) % 256;
      px[i * 4 + 1] = (i * 91) % 256;
      px[i * 4 + 2] = (i * 53) % 256;
      px[i * 4 + 3] = 255;
    }
    const res = buildMosaic(px, {
      width: w,
      height: h,
      palette: paletteForPreset('grayscale'),
      dither: true,
      piece: 'plate',
      optimizeCost: false,
    });
    for (const v of res.grid) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(4);
    }
  });
});

describe('exporters', () => {
  const bom = buildBom([
    { partId: '3024', colorId: 'red' },
    { partId: '3024', colorId: 'red' },
    { partId: '3020', colorId: 'blue' },
  ]);

  it('writes BrickLink wanted list XML with BL color ids', () => {
    const xml = toBrickLinkXml(bom);
    expect(xml).toContain('<ITEMID>3024</ITEMID>');
    expect(xml).toContain(`<COLOR>${COLOR_BY_ID.get('red')!.blId}</COLOR>`);
    expect(xml).toContain('<MINQTY>2</MINQTY>');
    expect(xml.startsWith('<INVENTORY>')).toBe(true);
  });

  it('writes CSV with totals', () => {
    const csv = toCsv(bom);
    expect(csv.split('\n')[0]).toContain('part_id');
    expect(csv).toContain('3020');
    expect(bom.totalPieces).toBe(3);
    expect(bom.totalUsd).toBeGreaterThan(0);
  });
});

/** Unit cube triangles (12 tris, 2 per face), spanning [0,size]^3. */
function cubeTriangles(size = 1): Float32Array {
  const v = [
    [0, 0, 0], [size, 0, 0], [size, size, 0], [0, size, 0],
    [0, 0, size], [size, 0, size], [size, size, size], [0, size, size],
  ];
  const quads = [
    [0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0],
  ];
  const out: number[] = [];
  for (const [a, b, c, d] of quads) {
    out.push(...v[a], ...v[b], ...v[c], ...v[a], ...v[c], ...v[d]);
  }
  return new Float32Array(out);
}

describe('voxelize + legolize', () => {
  it('voxelizes a cube into a fully solid grid', () => {
    const grid = voxelize(cubeTriangles(8), { targetStuds: 8 });
    expect(grid.nx).toBe(8);
    expect(grid.nz).toBe(8);
    expect(grid.ny).toBeGreaterThanOrEqual(6); // 8 / 1.2 ≈ 6.67 -> 7
    const solid = grid.data.reduce((s, v) => s + v, 0);
    expect(solid).toBe(grid.nx * grid.ny * grid.nz); // enclosed interior filled
  });

  it('hollow keeps a shell and removes the core', () => {
    const grid = voxelize(cubeTriangles(10), { targetStuds: 10 });
    const hollowed = hollow(grid, 1);
    const before = grid.data.reduce((s: number, v) => s + v, 0);
    const after = hollowed.data.reduce((s: number, v) => s + v, 0);
    expect(after).toBeLessThan(before);
    // Outermost cells must remain
    expect(hollowed.data[0]).toBe(1);
  });

  it('legolize covers every solid voxel exactly once and connects the build', () => {
    const grid = voxelize(cubeTriangles(6), { targetStuds: 6 });
    const res = legolize(grid, { profile: 'standard', colorId: 'red' });
    const covered = new Uint8Array(grid.nx * grid.ny * grid.nz);
    const idx = (x: number, y: number, z: number) => x + z * grid.nx + y * grid.nx * grid.nz;
    for (const p of res.placements) {
      for (let dz = 0; dz < p.sz; dz++) {
        for (let dx = 0; dx < p.sx; dx++) {
          const i = idx(p.x + dx, p.layer, p.z + dz);
          expect(covered[i]).toBe(0);
          covered[i] = 1;
        }
      }
    }
    for (let i = 0; i < grid.data.length; i++) expect(covered[i]).toBe(grid.data[i]);
    expect(res.components).toBe(1);
    expect(res.warnings).toHaveLength(0);
    expect(res.bom.totalPieces).toBe(res.placements.length);
  });

  it('reports disconnected builds', () => {
    // Two separate 2x2x2 cubes far apart in one grid
    const grid = {
      nx: 8,
      ny: 2,
      nz: 2,
      data: new Uint8Array(8 * 2 * 2),
    };
    const idx = (x: number, y: number, z: number) => x + z * 8 + y * 8 * 2;
    for (const x of [0, 1, 6, 7]) {
      for (let y = 0; y < 2; y++) for (let z = 0; z < 2; z++) grid.data[idx(x, y, z)] = 1;
    }
    const res = legolize(grid, { profile: 'basic', colorId: 'blue' });
    expect(res.components).toBe(2);
    expect(res.warnings.length).toBeGreaterThan(0);
  });
});

describe('ldraw export', () => {
  it('emits one type-1 line per placement with the right color code', () => {
    const grid = voxelize(cubeTriangles(4), { targetStuds: 4 });
    const res = legolize(grid, { profile: 'basic', colorId: 'yellow' });
    const ldr = toLdr(res.placements, 'Test cube');
    const type1 = ldr.split('\n').filter((l) => l.startsWith('1 '));
    expect(type1).toHaveLength(res.placements.length);
    expect(type1[0]).toContain(` ${COLOR_BY_ID.get('yellow')!.ldraw} `);
    expect(type1[0]).toMatch(/\.dat$/);
  });
});
