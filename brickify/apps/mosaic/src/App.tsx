import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildMosaic,
  paletteForPreset,
  toBrickLinkXml,
  toCsv,
  toShoppingLinks,
  type MosaicResult,
  type PaletteFilter,
} from '@brickify/core';
import { renderMosaic, sampleImage } from './render.js';
import { buildManual } from './pdf.js';

type Piece = 'roundPlate' | 'plate' | 'tile';

const SIZE_PRESETS = [32, 48, 64, 96];
const MAX_STUDS = 128;

function download(name: string, content: string | Blob, type = 'text/plain'): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [img, setImg] = useState<ImageBitmap | null>(null);
  const [fileName, setFileName] = useState('mosaic');
  const [width, setWidth] = useState(48);
  const [height, setHeight] = useState(48);
  const [piece, setPiece] = useState<Piece>('roundPlate');
  const [paletteFilter, setPaletteFilter] = useState<PaletteFilter>('all');
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [dither, setDither] = useState(true);
  const [optimizeCost, setOptimizeCost] = useState(true);
  const [priceMult, setPriceMult] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0.5);
  const [panY, setPanY] = useState(0.5);

  const onFile = async (file: File) => {
    const bmp = await createImageBitmap(file);
    setImg(bmp);
    setFileName(file.name.replace(/\.[^.]+$/, '') || 'mosaic');
    setZoom(1);
    setPanX(0.5);
    setPanY(0.5);
  };

  // Crop rect in source-image pixels for the current zoom/pan.
  const crop = useMemo(() => {
    if (!img) return null;
    const aspect = width / height;
    const baseW = Math.min(img.width, img.height * aspect);
    const w = baseW / zoom;
    const h = w / aspect;
    const x = (img.width - w) * panX;
    const y = (img.height - h) * panY;
    return { x, y, w, h };
  }, [img, width, height, zoom, panX, panY]);

  const result: MosaicResult | null = useMemo(() => {
    if (!img || !crop) return null;
    const rgba = sampleImage(img, crop, width, height);
    return buildMosaic(rgba, {
      width,
      height,
      palette: paletteForPreset(paletteFilter),
      dither,
      brightness,
      contrast,
      saturation,
      piece,
      optimizeCost,
    });
  }, [img, crop, width, height, paletteFilter, dither, brightness, contrast, saturation, piece, optimizeCost]);

  // ---- crop preview canvas with drag-to-pan ----
  const cropRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const canvas = cropRef.current;
    if (!canvas || !img || !crop) return;
    const dispW = 320;
    const dispH = Math.round((dispW * height) / width);
    canvas.width = dispW;
    canvas.height = dispH;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, dispW, dispH);
  }, [img, crop, width, height]);

  // ---- mosaic preview canvas ----
  const previewRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!previewRef.current || !result) return;
    const cellPx = Math.max(4, Math.min(14, Math.floor(720 / result.width)));
    renderMosaic(previewRef.current, result, { cellPx, piece });
  }, [result, piece]);

  const links = useMemo(() => (result ? toShoppingLinks(result.bom) : []), [result]);
  const totalUsd = result ? result.bom.totalUsd * priceMult : 0;

  return (
    <div className="app">
      <header>
        <h1>
          Brickify <span className="accent">Mosaic</span>
        </h1>
        <p className="tagline">
          Turn any image into a buildable brick mosaic — parts list, store links and printable instructions
          included. Works with LEGO-compatible bricks (Gobricks and similar).
        </p>
      </header>

      {!img && (
        <label
          className="drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) void onFile(f);
          }}
        >
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])}
          />
          <strong>Drop an image here</strong> or click to choose a file
        </label>
      )}

      {img && (
        <div className="grid">
          <section className="panel">
            <h2>1 · Frame</h2>
            <canvas
              ref={cropRef}
              className="crop"
              onPointerDown={(e) => {
                dragging.current = { x: e.clientX, y: e.clientY };
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!dragging.current || !img || !crop) return;
                const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
                const dx = e.clientX - dragging.current.x;
                const dy = e.clientY - dragging.current.y;
                dragging.current = { x: e.clientX, y: e.clientY };
                const freeX = img.width - crop.w;
                const freeY = img.height - crop.h;
                if (freeX > 0) setPanX((p) => Math.min(1, Math.max(0, p - (dx * (crop.w / rect.width)) / freeX)));
                if (freeY > 0) setPanY((p) => Math.min(1, Math.max(0, p - (dy * (crop.h / rect.height)) / freeY)));
              }}
              onPointerUp={() => (dragging.current = null)}
            />
            <label className="row">
              Zoom
              <input
                type="range"
                min={1}
                max={5}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
            </label>
            <button className="ghost" onClick={() => setImg(null)}>
              Use another image
            </button>

            <h2>2 · Size</h2>
            <div className="toggles">
              {SIZE_PRESETS.map((s) => (
                <button
                  key={s}
                  className={width === s && height === s ? 'on' : ''}
                  onClick={() => {
                    setWidth(s);
                    setHeight(s);
                  }}
                >
                  {s}×{s}
                </button>
              ))}
            </div>
            <div className="row">
              <label>
                W{' '}
                <input
                  type="number"
                  min={8}
                  max={MAX_STUDS}
                  value={width}
                  onChange={(e) => setWidth(Math.min(MAX_STUDS, Math.max(8, Number(e.target.value) || 8)))}
                />
              </label>
              <label>
                H{' '}
                <input
                  type="number"
                  min={8}
                  max={MAX_STUDS}
                  value={height}
                  onChange={(e) => setHeight(Math.min(MAX_STUDS, Math.max(8, Number(e.target.value) || 8)))}
                />
              </label>
              <span className="hint">
                {(width * 0.8).toFixed(0)} × {(height * 0.8).toFixed(0)} cm built
              </span>
            </div>

            <h2>3 · Pieces</h2>
            <div className="toggles">
              <button className={piece === 'roundPlate' ? 'on' : ''} onClick={() => setPiece('roundPlate')}>
                ● Round plates
              </button>
              <button className={piece === 'plate' ? 'on' : ''} onClick={() => setPiece('plate')}>
                ■ Square plates
              </button>
              <button className={piece === 'tile' ? 'on' : ''} onClick={() => setPiece('tile')}>
                ▦ Tiles
              </button>
            </div>
            <label className={`check ${piece !== 'plate' ? 'disabled' : ''}`}>
              <input
                type="checkbox"
                checked={optimizeCost && piece === 'plate'}
                disabled={piece !== 'plate'}
                onChange={(e) => setOptimizeCost(e.target.checked)}
              />
              Optimize cost — merge same-color areas into bigger plates (square plates only)
            </label>

            <h2>4 · Color</h2>
            <label className="row">
              Palette
              <select value={paletteFilter} onChange={(e) => setPaletteFilter(e.target.value as PaletteFilter)}>
                <option value="all">All colors ({paletteForPreset('all').length})</option>
                <option value="common">Common colors only — cheapest</option>
                <option value="grayscale">Grayscale</option>
                <option value="sepia">Sepia</option>
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={dither} onChange={(e) => setDither(e.target.checked)} />
              Dithering (smoother gradients, noisier texture)
            </label>
            {(
              [
                ['Brightness', brightness, setBrightness],
                ['Contrast', contrast, setContrast],
                ['Saturation', saturation, setSaturation],
              ] as const
            ).map(([label, value, set]) => (
              <label key={label} className="row">
                {label}
                <input type="range" min={-100} max={100} value={value} onChange={(e) => set(Number(e.target.value))} />
              </label>
            ))}
          </section>

          <section className="panel preview-panel">
            <h2>Preview</h2>
            <canvas ref={previewRef} className="preview" />
            {result && (
              <p className="stats">
                {result.bom.totalPieces.toLocaleString()} pieces · estimated{' '}
                <strong>${totalUsd.toFixed(2)}</strong> in compatible bricks
                <label className="mult">
                  price adj. ×
                  <input
                    type="number"
                    step={0.1}
                    min={0.2}
                    max={5}
                    value={priceMult}
                    onChange={(e) => setPriceMult(Number(e.target.value) || 1)}
                  />
                </label>
              </p>
            )}
          </section>

          <section className="panel">
            <h2>Get the set</h2>
            {result && (
              <>
                <div className="downloads">
                  <button onClick={() => download(`${fileName}-manual.pdf`, buildManual(result, { piece, title: fileName, priceMultiplier: priceMult }).output('blob'))}>
                    📕 Instructions PDF
                  </button>
                  <button onClick={() => download(`${fileName}-wantedlist.xml`, toBrickLinkXml(result.bom), 'application/xml')}>
                    🧱 BrickLink XML
                  </button>
                  <button onClick={() => download(`${fileName}-parts.csv`, toCsv(result.bom), 'text/csv')}>
                    📄 Parts CSV
                  </button>
                  <button
                    onClick={() => previewRef.current?.toBlob((b) => b && download(`${fileName}-mosaic.png`, b))}
                  >
                    🖼 Preview PNG
                  </button>
                </div>
                <p className="hint">
                  The XML works on BrickLink and on most compatible-brick stores that accept parts-list uploads.
                  Buying everything from a single store keeps shipping cheap.
                </p>
                <details>
                  <summary>Where to buy (AliExpress searches)</summary>
                  <ul className="links">
                    {links.map((l) => (
                      <li key={l.label}>
                        <a href={l.url} target="_blank" rel="noreferrer">
                          {l.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
                <details open>
                  <summary>Bill of materials ({result.bom.lines.length} lines)</summary>
                  <table className="bom">
                    <thead>
                      <tr>
                        <th></th>
                        <th>Color</th>
                        <th>Part</th>
                        <th className="num">Qty</th>
                        <th className="num">Est. $</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.bom.lines.map((l) => (
                        <tr key={`${l.partId}-${l.colorId}`}>
                          <td>
                            <span
                              className="swatch"
                              style={{ background: result.palette.find((c) => c.id === l.colorId)?.hex }}
                            />
                          </td>
                          <td>{l.colorName}</td>
                          <td>
                            {l.partName} <span className="hint">({l.partId})</span>
                          </td>
                          <td className="num">{l.qty}</td>
                          <td className="num">{(l.totalUsd * priceMult).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </>
            )}
          </section>
        </div>
      )}

      <footer>
        Brickify is not affiliated with the LEGO Group. LEGO® is a trademark of the LEGO Group. Estimates assume
        LEGO-compatible bricks (Gobricks and similar).
      </footer>
    </div>
  );
}
