import type { BrickColor, MosaicResult, Placement2D } from './types.js';
import { withLab, nearestIndex, rgbToLab, type LabColor } from './colors.js';
import { partsOf } from './parts.js';
import { buildBom } from './bom.js';

export interface MosaicOptions {
  /** Mosaic size in studs. */
  width: number;
  height: number;
  palette: BrickColor[];
  /** Floyd-Steinberg dithering. */
  dither: boolean;
  /** -100..100 */
  brightness?: number;
  /** -100..100 */
  contrast?: number;
  /** -100..100 */
  saturation?: number;
  /** Piece style for the mosaic surface. */
  piece: 'roundPlate' | 'plate' | 'tile';
  /**
   * Merge same-color regions into larger plates to cut cost (plate mode
   * only; round plates and tiles are always 1x1).
   */
  optimizeCost: boolean;
}

/**
 * Convert raw RGBA pixels (already resampled to width x height studs) into a
 * mosaic: per-stud palette indices plus piece placements and a BOM.
 */
export function buildMosaic(rgba: Uint8ClampedArray, opts: MosaicOptions): MosaicResult {
  const { width: w, height: h } = opts;
  if (rgba.length !== w * h * 4) {
    throw new Error(`Expected ${w * h * 4} bytes of RGBA, got ${rgba.length}`);
  }
  if (opts.palette.length === 0) throw new Error('Palette is empty');

  const adjusted = adjust(rgba, opts);
  const grid = quantize(adjusted, w, h, withLab(opts.palette), opts.dither);

  const placements =
    opts.piece === 'plate' && opts.optimizeCost
      ? mergePlates(grid, w, h, opts.palette)
      : onesPlacements(grid, w, h, opts.palette, opts.piece);

  return { width: w, height: h, grid, palette: opts.palette, placements, bom: buildBom(placements) };
}

function adjust(rgba: Uint8ClampedArray, opts: MosaicOptions): Float32Array {
  const brightness = (opts.brightness ?? 0) * 1.275; // -127.5..127.5
  const contrast = (opts.contrast ?? 0) / 100; // -1..1
  const saturation = 1 + (opts.saturation ?? 0) / 100; // 0..2
  const cFactor = contrast >= 0 ? 1 + contrast * 1.5 : 1 + contrast;
  const out = new Float32Array(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    let r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    // saturation around per-pixel luma
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = luma + (r - luma) * saturation;
    g = luma + (g - luma) * saturation;
    b = luma + (b - luma) * saturation;
    // contrast around mid-gray, then brightness
    r = (r - 128) * cFactor + 128 + brightness;
    g = (g - 128) * cFactor + 128 + brightness;
    b = (b - 128) * cFactor + 128 + brightness;
    out[i] = clamp255(r);
    out[i + 1] = clamp255(g);
    out[i + 2] = clamp255(b);
    out[i + 3] = rgba[i + 3];
  }
  return out;
}

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

function quantize(px: Float32Array, w: number, h: number, palette: LabColor[], dither: boolean): Int16Array {
  const grid = new Int16Array(w * h);
  // Error diffusion buffers (current + next row), RGB.
  const cur = new Float32Array(w * 3);
  const next = new Float32Array(w * 3);
  for (let y = 0; y < h; y++) {
    next.fill(0);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = clamp255(px[i] + cur[x * 3]);
      const g = clamp255(px[i + 1] + cur[x * 3 + 1]);
      const b = clamp255(px[i + 2] + cur[x * 3 + 2]);
      const idx = nearestIndex(rgbToLab(r, g, b), palette);
      grid[y * w + x] = idx;
      if (dither) {
        const p = palette[idx].rgb;
        const er = r - p[0], eg = g - p[1], eb = b - p[2];
        if (x + 1 < w) diffuse(cur, x + 1, er, eg, eb, 7 / 16);
        if (x - 1 >= 0) diffuse(next, x - 1, er, eg, eb, 3 / 16);
        diffuse(next, x, er, eg, eb, 5 / 16);
        if (x + 1 < w) diffuse(next, x + 1, er, eg, eb, 1 / 16);
      }
    }
    cur.set(next);
  }
  return grid;
}

function diffuse(buf: Float32Array, x: number, er: number, eg: number, eb: number, k: number) {
  buf[x * 3] += er * k;
  buf[x * 3 + 1] += eg * k;
  buf[x * 3 + 2] += eb * k;
}

function onesPlacements(
  grid: Int16Array,
  w: number,
  h: number,
  palette: BrickColor[],
  piece: 'roundPlate' | 'plate' | 'tile',
): Placement2D[] {
  const partId = piece === 'roundPlate' ? '4073' : piece === 'tile' ? '3070' : '3024';
  const out: Placement2D[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      out.push({ partId, colorId: palette[grid[y * w + x]].id, col: x, row: y, w: 1, h: 1 });
    }
  }
  return out;
}

/**
 * Greedy cover of each same-color region with the largest plates that fit,
 * scanning row-major. Cuts piece count and cost by 30-50% on flat areas.
 */
export function mergePlates(grid: Int16Array, w: number, h: number, palette: BrickColor[]): Placement2D[] {
  // Candidate footprints, biggest area first; ties prefer squarer pieces.
  const plates = partsOf('plate');
  const candidates: Array<{ partId: string; w: number; h: number }> = [];
  for (const p of plates) {
    candidates.push({ partId: p.id, w: p.l, h: p.w });
    if (p.w !== p.l) candidates.push({ partId: p.id, w: p.w, h: p.l });
  }
  candidates.sort((a, b) => b.w * b.h - a.w * a.h || Math.abs(a.w - a.h) - Math.abs(b.w - b.h));

  const used = new Uint8Array(w * h);
  const out: Placement2D[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (used[y * w + x]) continue;
      const color = grid[y * w + x];
      for (const c of candidates) {
        if (x + c.w > w || y + c.h > h) continue;
        if (!fits(grid, used, w, x, y, c.w, c.h, color)) continue;
        for (let dy = 0; dy < c.h; dy++) {
          for (let dx = 0; dx < c.w; dx++) used[(y + dy) * w + (x + dx)] = 1;
        }
        out.push({ partId: c.partId, colorId: palette[color].id, col: x, row: y, w: c.w, h: c.h });
        break; // 1x1 always fits, so we always place something
      }
    }
  }
  return out;
}

function fits(
  grid: Int16Array,
  used: Uint8Array,
  w: number,
  x: number,
  y: number,
  cw: number,
  ch: number,
  color: number,
): boolean {
  for (let dy = 0; dy < ch; dy++) {
    for (let dx = 0; dx < cw; dx++) {
      const i = (y + dy) * w + (x + dx);
      if (used[i] || grid[i] !== color) return false;
    }
  }
  return true;
}
