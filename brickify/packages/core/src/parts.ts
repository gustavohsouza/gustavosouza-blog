import type { Part, PartCategory } from './types.js';
import { COLOR_BY_ID, TIER_PRICE_MULTIPLIER } from './colors.js';

/**
 * Parts catalog. Design ids are the LEGO mold numbers; compatible
 * manufacturers (Gobricks etc.) use the same numbering, so a parts list
 * works with any supplier. Prices are conservative estimates in USD for
 * compatible pieces bought in bulk (AliExpress and similar); the UI shows
 * them as estimates and lets the user adjust a global multiplier.
 */
export const PARTS: Part[] = [
  // Plates (height 1/3 brick)
  { id: '3024', name: 'Plate 1 x 1', category: 'plate', w: 1, l: 1, basePriceUsd: 0.008 },
  { id: '3023', name: 'Plate 1 x 2', category: 'plate', w: 1, l: 2, basePriceUsd: 0.01 },
  { id: '3623', name: 'Plate 1 x 3', category: 'plate', w: 1, l: 3, basePriceUsd: 0.012 },
  { id: '3710', name: 'Plate 1 x 4', category: 'plate', w: 1, l: 4, basePriceUsd: 0.014 },
  { id: '3666', name: 'Plate 1 x 6', category: 'plate', w: 1, l: 6, basePriceUsd: 0.02 },
  { id: '3460', name: 'Plate 1 x 8', category: 'plate', w: 1, l: 8, basePriceUsd: 0.026 },
  { id: '3022', name: 'Plate 2 x 2', category: 'plate', w: 2, l: 2, basePriceUsd: 0.014 },
  { id: '3021', name: 'Plate 2 x 3', category: 'plate', w: 2, l: 3, basePriceUsd: 0.018 },
  { id: '3020', name: 'Plate 2 x 4', category: 'plate', w: 2, l: 4, basePriceUsd: 0.022 },
  { id: '3795', name: 'Plate 2 x 6', category: 'plate', w: 2, l: 6, basePriceUsd: 0.03 },
  { id: '3034', name: 'Plate 2 x 8', category: 'plate', w: 2, l: 8, basePriceUsd: 0.04 },
  // Mosaic alternatives
  { id: '4073', name: 'Plate Round 1 x 1', category: 'roundPlate', w: 1, l: 1, basePriceUsd: 0.008 },
  { id: '3070', name: 'Tile 1 x 1', category: 'tile', w: 1, l: 1, basePriceUsd: 0.01 },
  // Bricks (full height)
  { id: '3005', name: 'Brick 1 x 1', category: 'brick', w: 1, l: 1, basePriceUsd: 0.012 },
  { id: '3004', name: 'Brick 1 x 2', category: 'brick', w: 1, l: 2, basePriceUsd: 0.015 },
  { id: '3622', name: 'Brick 1 x 3', category: 'brick', w: 1, l: 3, basePriceUsd: 0.018 },
  { id: '3010', name: 'Brick 1 x 4', category: 'brick', w: 1, l: 4, basePriceUsd: 0.022 },
  { id: '3009', name: 'Brick 1 x 6', category: 'brick', w: 1, l: 6, basePriceUsd: 0.03 },
  { id: '3008', name: 'Brick 1 x 8', category: 'brick', w: 1, l: 8, basePriceUsd: 0.04 },
  { id: '3003', name: 'Brick 2 x 2', category: 'brick', w: 2, l: 2, basePriceUsd: 0.02 },
  { id: '3002', name: 'Brick 2 x 3', category: 'brick', w: 2, l: 3, basePriceUsd: 0.028 },
  { id: '3001', name: 'Brick 2 x 4', category: 'brick', w: 2, l: 4, basePriceUsd: 0.034 },
  { id: '2456', name: 'Brick 2 x 6', category: 'brick', w: 2, l: 6, basePriceUsd: 0.048 },
  { id: '3007', name: 'Brick 2 x 8', category: 'brick', w: 2, l: 8, basePriceUsd: 0.062 },
];

export const PART_BY_ID: ReadonlyMap<string, Part> = new Map(PARTS.map((p) => [p.id, p]));

export function partsOf(category: PartCategory): Part[] {
  return PARTS.filter((p) => p.category === category);
}

/** Estimated unit price for a part in a given color (compatible-brick market). */
export function unitPriceUsd(partId: string, colorId: string): number {
  const part = PART_BY_ID.get(partId);
  const color = COLOR_BY_ID.get(colorId);
  if (!part) throw new Error(`Unknown part: ${partId}`);
  if (!color) throw new Error(`Unknown color: ${colorId}`);
  return part.basePriceUsd * TIER_PRICE_MULTIPLIER[color.tier];
}

/**
 * Piece profiles for 3D builds (v2): which brick footprints the legolizer
 * may use. Larger allowed pieces -> cheaper, stronger builds; restricting to
 * small pieces makes the parts order simpler.
 */
export type PieceProfile = 'basic' | 'standard' | 'advanced';

const BRICK_SIZES_BY_PROFILE: Record<PieceProfile, Array<[number, number]>> = {
  basic: [
    [1, 1], [1, 2], [1, 3], [1, 4], [2, 2], [2, 3], [2, 4],
  ],
  standard: [
    [1, 1], [1, 2], [1, 3], [1, 4], [1, 6], [2, 2], [2, 3], [2, 4], [2, 6],
  ],
  advanced: [
    [1, 1], [1, 2], [1, 3], [1, 4], [1, 6], [1, 8], [2, 2], [2, 3], [2, 4], [2, 6], [2, 8],
  ],
};

export function bricksForProfile(profile: PieceProfile): Part[] {
  const sizes = BRICK_SIZES_BY_PROFILE[profile];
  return partsOf('brick').filter((p) => sizes.some(([w, l]) => w === p.w && l === p.l));
}
