import type { Bom, BomLine, Placement2D, Placement3D } from './types.js';
import { PART_BY_ID, unitPriceUsd } from './parts.js';
import { COLOR_BY_ID } from './colors.js';

/** Aggregate piece placements into a bill of materials with price estimates. */
export function buildBom(placements: Array<Pick<Placement2D | Placement3D, 'partId' | 'colorId'>>): Bom {
  const counts = new Map<string, number>();
  for (const p of placements) {
    const key = `${p.partId}|${p.colorId}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const lines: BomLine[] = [];
  for (const [key, qty] of counts) {
    const [partId, colorId] = key.split('|');
    const part = PART_BY_ID.get(partId)!;
    const color = COLOR_BY_ID.get(colorId)!;
    const unit = unitPriceUsd(partId, colorId);
    lines.push({
      partId,
      partName: part.name,
      colorId,
      colorName: color.name,
      qty,
      unitPriceUsd: unit,
      totalUsd: unit * qty,
    });
  }
  return finalize(lines);
}

/** Append extra parts (e.g. baseplates) that are not stud placements. */
export function addParts(bom: Bom, extras: Array<{ partId: string; colorId: string; qty: number }>): Bom {
  const lines = [...bom.lines];
  for (const e of extras) {
    if (e.qty <= 0) continue;
    const part = PART_BY_ID.get(e.partId);
    const color = COLOR_BY_ID.get(e.colorId);
    if (!part || !color) throw new Error(`Unknown part/color: ${e.partId}/${e.colorId}`);
    const unit = unitPriceUsd(e.partId, e.colorId);
    lines.push({
      partId: e.partId,
      partName: part.name,
      colorId: e.colorId,
      colorName: color.name,
      qty: e.qty,
      unitPriceUsd: unit,
      totalUsd: unit * e.qty,
    });
  }
  return finalize(lines);
}

function finalize(lines: BomLine[]): Bom {
  lines.sort((a, b) => a.colorName.localeCompare(b.colorName) || a.partName.localeCompare(b.partName));
  return {
    lines,
    totalPieces: lines.reduce((s, l) => s + l.qty, 0),
    totalUsd: lines.reduce((s, l) => s + l.totalUsd, 0),
  };
}
