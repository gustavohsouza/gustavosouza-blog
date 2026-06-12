import type { BrickColor, ColorTier } from './types.js';

/**
 * Curated palette of currently-produced brick colors widely available from
 * compatible manufacturers (Gobricks and similar). RGB values follow the
 * Rebrickable/LDraw reference data. Tier reflects typical compatible-market
 * price/availability, not official LEGO pricing.
 */
export const PALETTE: BrickColor[] = [
  { id: 'white', name: 'White', blId: 1, ldraw: 15, hex: '#F4F4F4', tier: 'common' },
  { id: 'black', name: 'Black', blId: 11, ldraw: 0, hex: '#1B1B1B', tier: 'common' },
  { id: 'light-bluish-gray', name: 'Light Bluish Gray', blId: 86, ldraw: 71, hex: '#A0A5A9', tier: 'common' },
  { id: 'dark-bluish-gray', name: 'Dark Bluish Gray', blId: 85, ldraw: 72, hex: '#6C6E68', tier: 'common' },
  { id: 'red', name: 'Red', blId: 5, ldraw: 4, hex: '#C91A09', tier: 'common' },
  { id: 'dark-red', name: 'Dark Red', blId: 59, ldraw: 320, hex: '#720E0F', tier: 'standard' },
  { id: 'blue', name: 'Blue', blId: 7, ldraw: 1, hex: '#0055BF', tier: 'common' },
  { id: 'dark-blue', name: 'Dark Blue', blId: 63, ldraw: 272, hex: '#0A3463', tier: 'standard' },
  { id: 'medium-blue', name: 'Medium Blue', blId: 42, ldraw: 73, hex: '#5A93DB', tier: 'standard' },
  { id: 'dark-azure', name: 'Dark Azure', blId: 153, ldraw: 321, hex: '#078BC9', tier: 'standard' },
  { id: 'medium-azure', name: 'Medium Azure', blId: 156, ldraw: 322, hex: '#36AEBF', tier: 'standard' },
  { id: 'sand-blue', name: 'Sand Blue', blId: 55, ldraw: 379, hex: '#6074A1', tier: 'rare' },
  { id: 'yellow', name: 'Yellow', blId: 3, ldraw: 14, hex: '#F2CD37', tier: 'common' },
  { id: 'bright-light-orange', name: 'Bright Light Orange', blId: 110, ldraw: 191, hex: '#F8BB3D', tier: 'standard' },
  { id: 'orange', name: 'Orange', blId: 4, ldraw: 25, hex: '#FE8A18', tier: 'common' },
  { id: 'dark-orange', name: 'Dark Orange', blId: 68, ldraw: 484, hex: '#A95500', tier: 'standard' },
  { id: 'green', name: 'Green', blId: 6, ldraw: 2, hex: '#237841', tier: 'common' },
  { id: 'dark-green', name: 'Dark Green', blId: 80, ldraw: 288, hex: '#184632', tier: 'standard' },
  { id: 'bright-green', name: 'Bright Green', blId: 36, ldraw: 10, hex: '#4B9F4A', tier: 'standard' },
  { id: 'lime', name: 'Lime', blId: 34, ldraw: 27, hex: '#BBE90B', tier: 'common' },
  { id: 'olive-green', name: 'Olive Green', blId: 155, ldraw: 330, hex: '#9B9A5A', tier: 'rare' },
  { id: 'sand-green', name: 'Sand Green', blId: 48, ldraw: 378, hex: '#A0BCAC', tier: 'rare' },
  { id: 'dark-turquoise', name: 'Dark Turquoise', blId: 39, ldraw: 3, hex: '#008F9B', tier: 'standard' },
  { id: 'tan', name: 'Tan', blId: 2, ldraw: 19, hex: '#E4CD9E', tier: 'common' },
  { id: 'dark-tan', name: 'Dark Tan', blId: 69, ldraw: 28, hex: '#958A73', tier: 'common' },
  { id: 'reddish-brown', name: 'Reddish Brown', blId: 88, ldraw: 70, hex: '#582A12', tier: 'common' },
  { id: 'dark-brown', name: 'Dark Brown', blId: 120, ldraw: 308, hex: '#352100', tier: 'rare' },
  { id: 'medium-nougat', name: 'Medium Nougat', blId: 150, ldraw: 84, hex: '#AA7D55', tier: 'standard' },
  { id: 'nougat', name: 'Nougat', blId: 28, ldraw: 92, hex: '#D09168', tier: 'standard' },
  { id: 'light-nougat', name: 'Light Nougat', blId: 90, ldraw: 78, hex: '#F6D7B3', tier: 'standard' },
  { id: 'magenta', name: 'Magenta', blId: 71, ldraw: 26, hex: '#923978', tier: 'standard' },
  { id: 'dark-pink', name: 'Dark Pink', blId: 47, ldraw: 5, hex: '#C870A0', tier: 'standard' },
  { id: 'bright-pink', name: 'Bright Pink', blId: 104, ldraw: 29, hex: '#E4ADC8', tier: 'standard' },
  { id: 'coral', name: 'Coral', blId: 220, ldraw: 353, hex: '#FF698F', tier: 'rare' },
  { id: 'dark-purple', name: 'Dark Purple', blId: 89, ldraw: 85, hex: '#3F3691', tier: 'standard' },
  { id: 'medium-lavender', name: 'Medium Lavender', blId: 157, ldraw: 30, hex: '#AC78BA', tier: 'rare' },
  { id: 'lavender', name: 'Lavender', blId: 154, ldraw: 31, hex: '#E1D5ED', tier: 'rare' },
];

export const COLOR_BY_ID: ReadonlyMap<string, BrickColor> = new Map(PALETTE.map((c) => [c.id, c]));

export const TIER_PRICE_MULTIPLIER: Record<ColorTier, number> = {
  common: 1.0,
  standard: 1.4,
  rare: 2.0,
};

const GRAYSCALE_IDS = ['white', 'light-bluish-gray', 'dark-bluish-gray', 'black'];
const SEPIA_IDS = ['white', 'tan', 'dark-tan', 'medium-nougat', 'reddish-brown', 'dark-brown', 'black'];

export type PaletteFilter = 'all' | 'common' | 'grayscale' | 'sepia';

export function paletteForPreset(preset: PaletteFilter): BrickColor[] {
  switch (preset) {
    case 'all':
      return PALETTE;
    case 'common':
      return PALETTE.filter((c) => c.tier === 'common');
    case 'grayscale':
      return GRAYSCALE_IDS.map((id) => COLOR_BY_ID.get(id)!);
    case 'sepia':
      return SEPIA_IDS.map((id) => COLOR_BY_ID.get(id)!);
  }
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** sRGB (0-255) to CIELAB, D65. */
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const rl = lin(r), gl = lin(g), bl = lin(b);
  // sRGB D65 reference white
  let x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047;
  let y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175;
  let z = (rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export interface LabColor {
  color: BrickColor;
  lab: [number, number, number];
  rgb: [number, number, number];
}

export function withLab(palette: BrickColor[]): LabColor[] {
  return palette.map((color) => {
    const rgb = hexToRgb(color.hex);
    return { color, rgb, lab: rgbToLab(rgb[0], rgb[1], rgb[2]) };
  });
}

/** Index of the perceptually nearest palette entry (squared deltaE76). */
export function nearestIndex(lab: [number, number, number], palette: LabColor[]): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const p = palette[i].lab;
    const dL = lab[0] - p[0], da = lab[1] - p[1], db = lab[2] - p[2];
    const d = dL * dL + da * da + db * db;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
