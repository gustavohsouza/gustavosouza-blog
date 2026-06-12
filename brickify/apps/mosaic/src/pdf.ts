import { jsPDF } from 'jspdf';
import type { MosaicResult } from '@brickify/core';
import { renderMosaic } from './render.js';

const SECTION = 16; // studs per instruction section (LEGO Art style)

export interface ManualOptions {
  piece: 'roundPlate' | 'plate' | 'tile';
  title: string;
  priceMultiplier: number;
}

/**
 * Build the printable instruction manual:
 * cover -> parts list -> one page per 16x16 section with numbered studs.
 */
export function buildManual(res: MosaicResult, opts: ManualOptions): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Stable stud-number per palette index, ordered by usage (1 = most used).
  const usage = new Map<number, number>();
  for (const v of res.grid) usage.set(v, (usage.get(v) ?? 0) + 1);
  const ordered = [...usage.entries()].sort((a, b) => b[1] - a[1]).map(([idx]) => idx);
  const numberOf = new Map<number, number>(ordered.map((idx, i) => [idx, i + 1]));

  // ---- Cover ----
  doc.setFontSize(24);
  doc.text(opts.title, pageW / 2, 26, { align: 'center' });
  doc.setFontSize(11);
  doc.setTextColor(90);
  const physW = (res.width * 0.8).toFixed(1);
  const physH = (res.height * 0.8).toFixed(1);
  doc.text(
    `${res.width} x ${res.height} studs  •  ${physW} x ${physH} cm  •  ${res.bom.totalPieces} pieces  •  est. $${(res.bom.totalUsd * opts.priceMultiplier).toFixed(2)} (compatible bricks)`,
    pageW / 2,
    34,
    { align: 'center' },
  );
  doc.setTextColor(0);
  const cover = document.createElement('canvas');
  renderMosaic(cover, res, { cellPx: 12, piece: opts.piece });
  const coverMaxW = pageW - margin * 2;
  const coverMaxH = pageH - 60;
  const scale = Math.min(coverMaxW / cover.width, coverMaxH / cover.height);
  doc.addImage(
    cover.toDataURL('image/png'),
    'PNG',
    (pageW - cover.width * scale) / 2,
    44,
    cover.width * scale,
    cover.height * scale,
    undefined,
    'FAST',
  );

  // ---- Parts list ----
  doc.addPage();
  doc.setFontSize(16);
  doc.text('Parts list', margin, 20);
  doc.setFontSize(9);
  let y = 30;
  doc.setTextColor(90);
  doc.text('No.', margin, y);
  doc.text('Color', margin + 14, y);
  doc.text('Part', margin + 64, y);
  doc.text('Qty', pageW - margin - 30, y, { align: 'right' });
  doc.text('Est. $', pageW - margin, y, { align: 'right' });
  doc.setTextColor(0);
  y += 3;
  for (const line of res.bom.lines) {
    const palIdx = res.palette.findIndex((c) => c.id === line.colorId);
    y += 6.5;
    if (y > pageH - margin) {
      doc.addPage();
      y = 20;
    }
    doc.setFillColor(line.colorId === 'white' ? '#f4f4f4' : res.palette[palIdx >= 0 ? palIdx : 0].hex);
    doc.rect(margin + 14, y - 3.5, 5, 5, 'F');
    doc.setDrawColor(160);
    doc.rect(margin + 14, y - 3.5, 5, 5, 'S');
    if (palIdx >= 0 && numberOf.has(palIdx)) doc.text(String(numberOf.get(palIdx)), margin, y);
    doc.text(line.colorName, margin + 22, y);
    doc.text(`${line.partName} (${line.partId})`, margin + 64, y);
    doc.text(String(line.qty), pageW - margin - 30, y, { align: 'right' });
    doc.text((line.totalUsd * opts.priceMultiplier).toFixed(2), pageW - margin, y, { align: 'right' });
  }
  y += 10;
  if (y > pageH - margin - 10) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    'Prices are estimates for LEGO-compatible bricks (Gobricks and similar) bought in bulk; actual prices vary by store and shipping.',
    margin,
    y,
    { maxWidth: pageW - margin * 2 },
  );
  doc.setTextColor(0);

  // ---- Sections ----
  const cols = Math.ceil(res.width / SECTION);
  const rows = Math.ceil(res.height / SECTION);
  for (let sy = 0; sy < rows; sy++) {
    for (let sx = 0; sx < cols; sx++) {
      doc.addPage();
      const win = {
        x: sx * SECTION,
        y: sy * SECTION,
        w: Math.min(SECTION, res.width - sx * SECTION),
        h: Math.min(SECTION, res.height - sy * SECTION),
      };
      doc.setFontSize(14);
      doc.text(`Section ${String.fromCharCode(65 + sy)}${sx + 1} of ${rows} x ${cols}`, margin, 18);
      doc.setFontSize(9);
      doc.setTextColor(90);
      doc.text(
        `Studs ${win.x + 1}-${win.x + win.w} (left to right), rows ${win.y + 1}-${win.y + win.h} (top to bottom). Numbers = color codes from the parts list.`,
        margin,
        25,
        { maxWidth: pageW - margin * 2 },
      );
      doc.setTextColor(0);

      const canvas = document.createElement('canvas');
      renderMosaic(canvas, res, {
        cellPx: 36,
        piece: opts.piece,
        grid: true,
        numbers: numberOf,
        window: win,
        outlines: opts.piece === 'plate' ? res.placements.filter((p) => p.w * p.h > 1) : null,
      });
      const maxW = pageW - margin * 2;
      const maxH = pageH - 70;
      const s = Math.min(maxW / canvas.width, maxH / canvas.height);
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', margin, 32, canvas.width * s, canvas.height * s, undefined, 'FAST');

      // Mini-map showing which section this is.
      const mmCell = 4;
      doc.setDrawColor(150);
      for (let ry = 0; ry < rows; ry++) {
        for (let rx = 0; rx < cols; rx++) {
          const mx = pageW - margin - cols * mmCell + rx * mmCell;
          const my = 12 + ry * mmCell;
          if (rx === sx && ry === sy) {
            doc.setFillColor('#d33');
            doc.rect(mx, my, mmCell, mmCell, 'FD');
          } else {
            doc.rect(mx, my, mmCell, mmCell, 'S');
          }
        }
      }
    }
  }
  return doc;
}
