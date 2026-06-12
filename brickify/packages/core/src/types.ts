/** Shared types for the Brickify conversion engine. */

/** Pricing/availability tier for a color, for compatible-brick suppliers. */
export type ColorTier = 'common' | 'standard' | 'rare';

export interface BrickColor {
  /** Stable slug, e.g. "red". */
  id: string;
  /** Display name (official LEGO-style name). */
  name: string;
  /** BrickLink color id (used in Wanted List XML). */
  blId: number;
  /** LDraw color code (used in .ldr export). */
  ldraw: number;
  /** sRGB hex, e.g. "#C91A09". */
  hex: string;
  tier: ColorTier;
}

export type PartCategory = 'plate' | 'roundPlate' | 'tile' | 'brick';

export interface Part {
  /** LEGO design id (same numbering used by compatible manufacturers). */
  id: string;
  name: string;
  category: PartCategory;
  /** Footprint in studs. width <= length by convention. */
  w: number;
  l: number;
  /** Estimated unit price in USD for a compatible (e.g. Gobricks) piece, common-tier color. */
  basePriceUsd: number;
}

/** One placed piece in a 2D mosaic. col/row are stud coordinates, w/l the oriented footprint. */
export interface Placement2D {
  partId: string;
  colorId: string;
  col: number;
  row: number;
  w: number; // extent along columns (x)
  h: number; // extent along rows (y)
}

/** One placed piece in a 3D model. Layer 0 is the bottom. */
export interface Placement3D {
  partId: string;
  colorId: string;
  x: number;
  z: number;
  layer: number;
  /** Oriented footprint: sx along x, sz along z. */
  sx: number;
  sz: number;
}

export interface BomLine {
  partId: string;
  partName: string;
  colorId: string;
  colorName: string;
  qty: number;
  unitPriceUsd: number;
  totalUsd: number;
}

export interface Bom {
  lines: BomLine[];
  totalPieces: number;
  totalUsd: number;
}

/** Result of converting an image into a mosaic. */
export interface MosaicResult {
  width: number;
  height: number;
  /** Row-major color index into `palette`, length width*height. */
  grid: Int16Array;
  palette: BrickColor[];
  placements: Placement2D[];
  bom: Bom;
}

export interface VoxelGrid {
  nx: number;
  ny: number; // layers (vertical)
  nz: number;
  /** x + z*nx + y*nx*nz, 1 = solid. */
  data: Uint8Array;
}

export interface LegolizeResult {
  placements: Placement3D[];
  bom: Bom;
  grid: VoxelGrid;
  /** Number of connected components in the stud-connectivity graph (1 = fully connected). */
  components: number;
  warnings: string[];
}
