import type { Bom } from './types.js';
import { COLOR_BY_ID } from './colors.js';
import { PART_BY_ID } from './parts.js';

/**
 * BrickLink Wanted List XML. Widely accepted beyond BrickLink itself: many
 * compatible-brick stores (Gobricks resellers and similar) take this format
 * as an order list upload.
 */
export function toBrickLinkXml(bom: Bom): string {
  const items = bom.lines
    .map((l) => {
      const color = COLOR_BY_ID.get(l.colorId)!;
      return [
        '  <ITEM>',
        '    <ITEMTYPE>P</ITEMTYPE>',
        `    <ITEMID>${l.partId}</ITEMID>`,
        `    <COLOR>${color.blId}</COLOR>`,
        `    <MINQTY>${l.qty}</MINQTY>`,
        '  </ITEM>',
      ].join('\n');
    })
    .join('\n');
  return `<INVENTORY>\n${items}\n</INVENTORY>\n`;
}

/** Simple CSV (part id, part name, color, qty, unit estimate) for spreadsheets and store order forms. */
export function toCsv(bom: Bom): string {
  const header = 'part_id,part_name,color,qty,est_unit_usd,est_total_usd';
  const rows = bom.lines.map(
    (l) =>
      `${l.partId},"${l.partName}","${l.colorName}",${l.qty},${l.unitPriceUsd.toFixed(4)},${l.totalUsd.toFixed(2)}`,
  );
  return [header, ...rows].join('\n') + '\n';
}

export interface ShoppingLink {
  label: string;
  url: string;
}

/**
 * Search links for compatible-brick suppliers. There is no public pricing or
 * stock API for AliExpress, so we generate targeted search queries; buying
 * from a single store keeps shipping cheap, so the first link searches for
 * bulk MOC part lots.
 */
export function toShoppingLinks(bom: Bom): ShoppingLink[] {
  const links: ShoppingLink[] = [
    {
      label: 'AliExpress: bulk MOC brick stores (upload/paste your parts list)',
      url: 'https://www.aliexpress.com/wholesale?SearchText=' + encodeURIComponent('gobricks moc bricks bulk parts'),
    },
  ];
  for (const l of bom.lines) {
    const part = PART_BY_ID.get(l.partId)!;
    const q = `gobricks ${l.partId} ${part.name} ${l.colorName}`;
    links.push({
      label: `${part.name} — ${l.colorName} ×${l.qty}`,
      url: 'https://www.aliexpress.com/wholesale?SearchText=' + encodeURIComponent(q),
    });
  }
  return links;
}
