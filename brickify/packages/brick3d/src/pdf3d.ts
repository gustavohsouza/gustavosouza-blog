import { jsPDF } from 'jspdf';
import { COLOR_BY_ID, PART_BY_ID, type Bom, type Placement3D } from '@brickify/core';
import { createBrickScene } from './scene.js';

export interface Manual3DOptions {
  title: string;
  bom: Bom;
  priceMultiplier: number;
  warnings?: string[];
}

/**
 * Build a step-by-step (one layer per step) instruction manual:
 * cover -> parts list -> one page per layer with a render of the build so
 * far and a callout of the pieces added in that step.
 */
export function buildManual3D(placements: Placement3D[], opts: Manual3DOptions): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;

  const canvas = document.createElement('canvas');
  const W = 960, H = 660;
  canvas.width = W;
  canvas.height = H;
  const scene = createBrickScene(canvas, W, H);
  const snapshot = (maxLayer: number): string => {
    scene.setPlacements(placements, maxLayer);
    scene.frame();
    scene.renderer.render(scene.scene, scene.camera);
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  const layers = placements.length ? Math.max(...placements.map((p) => p.layer)) + 1 : 0;

  // ---- Cover ----
  doc.setFontSize(24);
  doc.text(opts.title, pageW / 2, 24, { align: 'center' });
  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text(
    `${placements.length.toLocaleString()} pieces  •  ${layers} layers  •  est. $${(opts.bom.totalUsd * opts.priceMultiplier).toFixed(2)} (compatible bricks)`,
    pageW / 2,
    32,
    { align: 'center' },
  );
  doc.setTextColor(0);
  doc.addImage(snapshot(Infinity), 'JPEG', margin, 40, pageW - margin * 2, ((pageW - margin * 2) * H) / W, undefined, 'FAST');
  if (opts.warnings?.length) {
    doc.setFontSize(9);
    doc.setTextColor(180, 60, 40);
    doc.text(opts.warnings.join('\n'), margin, 40 + ((pageW - margin * 2) * H) / W + 10, {
      maxWidth: pageW - margin * 2,
    });
    doc.setTextColor(0);
  }

  // ---- Parts list ----
  doc.addPage();
  doc.setFontSize(16);
  doc.text('Parts list', margin, 20);
  doc.setFontSize(9);
  let y = 30;
  for (const line of opts.bom.lines) {
    y += 6.5;
    if (y > pageH - margin) {
      doc.addPage();
      y = 20;
    }
    doc.setFillColor(COLOR_BY_ID.get(line.colorId)?.hex ?? '#cccccc');
    doc.rect(margin, y - 3.5, 5, 5, 'F');
    doc.setDrawColor(160);
    doc.rect(margin, y - 3.5, 5, 5, 'S');
    doc.text(`${line.colorName} — ${line.partName} (${line.partId})`, margin + 8, y);
    doc.text(String(line.qty), pageW - margin - 26, y, { align: 'right' });
    doc.text((line.totalUsd * opts.priceMultiplier).toFixed(2), pageW - margin, y, { align: 'right' });
  }

  // ---- Steps (one per layer, bottom-up) ----
  for (let layer = 0; layer < layers; layer++) {
    doc.addPage();
    doc.setFontSize(15);
    doc.text(`Step ${layer + 1} of ${layers}`, margin, 18);
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text('Add the pieces below, then compare with the picture (layers are built bottom-up).', margin, 24);
    doc.setTextColor(0);

    const imgH = ((pageW - margin * 2) * H) / W;
    doc.addImage(snapshot(layer), 'JPEG', margin, 28, pageW - margin * 2, imgH, undefined, 'FAST');

    // Callout: pieces added in this step
    const step = new Map<string, number>();
    for (const p of placements) {
      if (p.layer !== layer) continue;
      const key = `${p.partId}|${p.colorId}`;
      step.set(key, (step.get(key) ?? 0) + 1);
    }
    let cy = 28 + imgH + 8;
    doc.setFontSize(9);
    for (const [key, qty] of [...step.entries()].sort()) {
      if (cy > pageH - 10) break; // extremely color-mixed layers: list is summarized in the BOM anyway
      const [partId, colorId] = key.split('|');
      doc.setFillColor(COLOR_BY_ID.get(colorId)?.hex ?? '#cccccc');
      doc.rect(margin, cy - 3.5, 5, 5, 'F');
      doc.setDrawColor(160);
      doc.rect(margin, cy - 3.5, 5, 5, 'S');
      doc.text(`${qty} × ${PART_BY_ID.get(partId)?.name ?? partId} — ${COLOR_BY_ID.get(colorId)?.name ?? colorId}`, margin + 8, cy);
      cy += 6;
    }
  }

  scene.dispose();
  return doc;
}
