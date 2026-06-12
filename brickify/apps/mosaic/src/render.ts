import { hexToRgb, type MosaicResult, type Placement2D } from '@brickify/core';

export interface RenderOptions {
  cellPx: number;
  piece: 'roundPlate' | 'plate' | 'tile';
  /** Draw stud-grid lines. */
  grid?: boolean;
  /** Draw outlines of merged placements. */
  outlines?: Placement2D[] | null;
  /** Draw the palette index number inside each stud (instruction pages). */
  numbers?: Map<number, number> | null;
  /** Restrict drawing to a window of the mosaic (instruction sections). */
  window?: { x: number; y: number; w: number; h: number };
}

/** Perceived-luma check so number labels stay readable on any color. */
function isDark(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 110;
}

export function renderMosaic(canvas: HTMLCanvasElement, res: MosaicResult, opts: RenderOptions): void {
  const win = opts.window ?? { x: 0, y: 0, w: res.width, h: res.height };
  const c = opts.cellPx;
  canvas.width = win.w * c;
  canvas.height = win.h * c;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0d0f12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < win.h; y++) {
    for (let x = 0; x < win.w; x++) {
      const color = res.palette[res.grid[(win.y + y) * res.width + (win.x + x)]];
      ctx.fillStyle = color.hex;
      if (opts.piece === 'roundPlate') {
        ctx.fillStyle = '#15181d';
        ctx.fillRect(x * c, y * c, c, c);
        ctx.fillStyle = color.hex;
        ctx.beginPath();
        ctx.arc(x * c + c / 2, y * c + c / 2, c * 0.46, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(x * c, y * c, c, c);
        if (opts.piece === 'plate' && c >= 8) {
          // stud hint
          ctx.beginPath();
          ctx.arc(x * c + c / 2, y * c + c / 2, c * 0.3, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(0,0,0,0.18)';
          ctx.lineWidth = Math.max(1, c * 0.05);
          ctx.stroke();
        }
      }
      if (opts.numbers && c >= 14) {
        const idx = res.grid[(win.y + y) * res.width + (win.x + x)];
        const label = opts.numbers.get(idx);
        if (label !== undefined) {
          ctx.fillStyle = isDark(color.hex) ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.7)';
          ctx.font = `${Math.floor(c * 0.42)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(label), x * c + c / 2, y * c + c / 2 + 0.5);
        }
      }
    }
  }

  if (opts.grid && c >= 6) {
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= win.w; x++) {
      ctx.beginPath();
      ctx.moveTo(x * c + 0.5, 0);
      ctx.lineTo(x * c + 0.5, win.h * c);
      ctx.stroke();
    }
    for (let y = 0; y <= win.h; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * c + 0.5);
      ctx.lineTo(win.w * c, y * c + 0.5);
      ctx.stroke();
    }
  }

  if (opts.outlines) {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(1.5, c * 0.08);
    for (const p of opts.outlines) {
      const px = p.col - win.x;
      const py = p.row - win.y;
      if (px + p.w <= 0 || py + p.h <= 0 || px >= win.w || py >= win.h) continue;
      ctx.strokeRect(px * c + 1, py * c + 1, p.w * c - 2, p.h * c - 2);
    }
  }
}

/** Extract a width x height stud RGBA sample of the cropped region of an image. */
export function sampleImage(
  img: ImageBitmap | HTMLImageElement,
  crop: { x: number; y: number; w: number; h: number },
  width: number,
  height: number,
): Uint8ClampedArray {
  // Two-step downscale for better quality on large reductions.
  const mid = document.createElement('canvas');
  const midW = Math.max(width * 4, 1);
  const midH = Math.max(height * 4, 1);
  mid.width = midW;
  mid.height = midH;
  const mctx = mid.getContext('2d')!;
  mctx.imageSmoothingEnabled = true;
  mctx.imageSmoothingQuality = 'high';
  mctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, midW, midH);

  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const octx = out.getContext('2d')!;
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(mid, 0, 0, width, height);
  return octx.getImageData(0, 0, width, height).data;
}
