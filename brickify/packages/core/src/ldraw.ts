import type { Placement3D } from './types.js';
import { COLOR_BY_ID } from './colors.js';

const STUD_LDU = 20;
const BRICK_LDU = 24;

/**
 * Export 3D placements as an LDraw .ldr model, openable in BrickLink Studio,
 * LeoCAD, LDView etc.
 *
 * Coordinates: LDraw has +Y pointing down; bricks are placed by the center
 * of their footprint with the part's long axis along X (rotated 90° about Y
 * when the placement runs along Z).
 */
export function toLdr(placements: Placement3D[], modelName = 'Brickify model'): string {
  const lines: string[] = [
    `0 ${modelName}`,
    '0 Name: brickify.ldr',
    '0 Author: Brickify',
    '0 !LICENSE Generated file',
  ];
  for (const p of placements) {
    const color = COLOR_BY_ID.get(p.colorId);
    const code = color ? color.ldraw : 16;
    const cx = (p.x + p.sx / 2) * STUD_LDU;
    const cz = (p.z + p.sz / 2) * STUD_LDU;
    // Layer 0 sits on the ground plane (y=0); LDraw bricks span [-BRICK_LDU, 0]
    // relative to their origin, growing upward in -Y.
    const cy = -p.layer * BRICK_LDU;
    const rotated = p.sz > p.sx; // long axis along Z -> rotate 90° about Y
    const m = rotated ? '0 0 -1 0 1 0 1 0 0' : '1 0 0 0 1 0 0 0 1';
    lines.push(`1 ${code} ${cx} ${cy} ${cz} ${m} ${p.partId}.dat`);
  }
  return lines.join('\n') + '\n';
}
