import { useMemo, useState } from 'react';
import {
  hollow as hollowGrid,
  legolize,
  PALETTE,
  toBrickLinkXml,
  toCsv,
  toLdr,
  toShoppingLinks,
  voxelize,
  type LegolizeResult,
  type PieceProfile,
} from '@brickify/core';
import { BrickViewer, buildManual3D, loadMeshDetailed, type LoadedMesh } from '@brickify/brick3d';

function download(name: string, content: string | Blob, type = 'text/plain'): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const PROFILES: Array<{ id: PieceProfile; label: string; hint: string }> = [
  { id: 'basic', label: 'Basic', hint: 'small common bricks — simplest to buy' },
  { id: 'standard', label: 'Standard', hint: 'adds 1×6 / 2×6 bricks — cheaper, stronger' },
  { id: 'advanced', label: 'Advanced', hint: 'adds long 1×8 / 2×8 bricks — fewest pieces' },
];

export default function App() {
  const [mesh, setMesh] = useState<LoadedMesh | null>(null);
  const [fileName, setFileName] = useState('model');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [targetStuds, setTargetStuds] = useState(32);
  const [profile, setProfile] = useState<PieceProfile>('standard');
  const [hollowOn, setHollowOn] = useState(true);
  const [colorId, setColorId] = useState('red');
  const [colorMode, setColorMode] = useState<'model' | 'single'>('single');
  const [priceMult, setPriceMult] = useState(1);
  const [budget, setBudget] = useState(0); // 0 = no ceiling
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LegolizeResult | null>(null);
  const [maxLayer, setMaxLayer] = useState<number>(Infinity);

  const onFile = async (file: File) => {
    setLoadError(null);
    setResult(null);
    try {
      const loaded = await loadMeshDetailed(file);
      setMesh(loaded);
      setColorMode(loaded.colors ? 'model' : 'single');
      setFileName(file.name.replace(/\.[^.]+$/, '') || 'model');
    } catch (e) {
      setMesh(null);
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  };

  const runPipeline = (size: number): LegolizeResult => {
    const useModelColors = colorMode === 'model' && !!mesh!.colors;
    let grid = voxelize(mesh!.positions, {
      targetStuds: size,
      colors: useModelColors ? mesh!.colors! : undefined,
    });
    // Shell of 2 bricks: thick enough that curved walls keep overlapping
    // (and interlocking) between layers; 1-thick shells fragment on spheres.
    if (hollowOn) grid = hollowGrid(grid, 2);
    return legolize(grid, {
      profile,
      colorId,
      autoConnect: true,
      palette: useModelColors ? PALETTE : undefined,
    });
  };

  const convert = (fitBudget = false) => {
    if (!mesh) return;
    setBusy(true);
    setResult(null);
    // Let the spinner paint before the heavy work starts.
    setTimeout(() => {
      try {
        let size = targetStuds;
        let res = runPipeline(size);
        if (fitBudget && budget > 0) {
          // Walk the size down until the estimate fits the ceiling.
          while (size > 8 && res.bom.totalUsd * priceMult > budget) {
            size = Math.max(8, size - 4);
            res = runPipeline(size);
          }
          setTargetStuds(size);
        }
        setResult(res);
        setMaxLayer(Infinity);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    }, 30);
  };

  const layers = useMemo(
    () => (result && result.placements.length ? Math.max(...result.placements.map((p) => p.layer)) + 1 : 0),
    [result],
  );
  const links = useMemo(() => (result ? toShoppingLinks(result.bom) : []), [result]);
  const sizeCm = result
    ? `${(result.grid.nx * 0.8).toFixed(0)} × ${(result.grid.ny * 0.96).toFixed(0)} × ${(result.grid.nz * 0.8).toFixed(0)} cm`
    : '';

  return (
    <div className="app">
      <header>
        <h1>
          Brickify <span className="accent">Studio</span>
        </h1>
        <p className="tagline">
          Turn a 3D model (STL, OBJ, GLB) into a buildable brick set — parts list, store links and a
          step-by-step instruction manual. Works with LEGO-compatible bricks.
        </p>
      </header>

      {!mesh && (
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
            accept=".stl,.obj,.glb,.gltf"
            hidden
            onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])}
          />
          <strong>Drop a 3D file here</strong> or click to choose (STL, OBJ, GLB, GLTF)
          {loadError && <p className="error">{loadError}</p>}
        </label>
      )}

      {mesh && (
        <div className="grid">
          <section className="panel">
            <h2>1 · Model</h2>
            <p className="hint">
              {fileName} — {(mesh.positions.length / 9).toLocaleString()} triangles
            </p>
            <button className="ghost" onClick={() => { setMesh(null); setResult(null); }}>
              Use another model
            </button>

            <h2>2 · Size</h2>
            <label className="row">
              Longest side
              <input
                type="range"
                min={8}
                max={96}
                value={targetStuds}
                onChange={(e) => setTargetStuds(Number(e.target.value))}
              />
              <span className="hint">{targetStuds} studs</span>
            </label>
            <label className="row">
              Budget $
              <input
                type="number"
                min={0}
                step={5}
                value={budget || ''}
                placeholder="none"
                onChange={(e) => setBudget(Math.max(0, Number(e.target.value) || 0))}
              />
              {budget > 0 && (
                <button className="ghost" style={{ marginTop: 0 }} disabled={busy} onClick={() => convert(true)}>
                  Fit to budget
                </button>
              )}
            </label>

            <h2>3 · Pieces</h2>
            <div className="toggles">
              {PROFILES.map((p) => (
                <button key={p.id} className={profile === p.id ? 'on' : ''} onClick={() => setProfile(p.id)} title={p.hint}>
                  {p.label}
                </button>
              ))}
            </div>
            <p className="hint">{PROFILES.find((p) => p.id === profile)?.hint}</p>
            <label className="check">
              <input type="checkbox" checked={hollowOn} onChange={(e) => setHollowOn(e.target.checked)} />
              Hollow interior — much cheaper and lighter on big builds
            </label>

            <h2>4 · Color</h2>
            <div className="toggles">
              <button
                className={colorMode === 'model' ? 'on' : ''}
                disabled={!mesh.colors}
                title={mesh.colors ? 'Use the colors found in the file' : 'This file has no color information'}
                onClick={() => setColorMode('model')}
              >
                🎨 From model
              </button>
              <button className={colorMode === 'single' ? 'on' : ''} onClick={() => setColorMode('single')}>
                ⬤ Single color
              </button>
            </div>
            {colorMode === 'model' && (
              <p className="hint">
                Model colors are matched to the closest of the {PALETTE.length} brick colors. The swatch below
                is used for hidden interior pieces.
              </p>
            )}
            <div className="swatches">
              {PALETTE.map((c) => (
                <button
                  key={c.id}
                  className={`swatch-btn ${colorId === c.id ? 'on' : ''}`}
                  style={{ background: c.hex }}
                  title={c.name}
                  onClick={() => setColorId(c.id)}
                />
              ))}
            </div>

            <button className="cta" onClick={() => convert()} disabled={busy}>
              {busy ? 'Converting…' : result ? 'Convert again' : 'Convert to bricks'}
            </button>
          </section>

          <section className="panel preview-panel">
            <h2>Preview</h2>
            {busy && <p className="hint">Voxelizing and laying bricks…</p>}
            {result && (
              <>
                <BrickViewer placements={result.placements} maxLayer={maxLayer} width={680} height={500} className="viewer" />
                <label className="row">
                  Layer
                  <input
                    type="range"
                    min={0}
                    max={layers - 1}
                    value={Number.isFinite(maxLayer) ? maxLayer : layers - 1}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setMaxLayer(v >= layers - 1 ? Infinity : v);
                    }}
                  />
                  <span className="hint">
                    {Number.isFinite(maxLayer) ? `${maxLayer + 1} / ${layers}` : `all ${layers}`}
                  </span>
                </label>
                <p className="stats">
                  {result.bom.totalPieces.toLocaleString()} pieces · {layers} layers · {sizeCm} · estimated{' '}
                  <strong>${(result.bom.totalUsd * priceMult).toFixed(2)}</strong>
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
                {result.warnings.map((w) => (
                  <p key={w} className="error">
                    ⚠ {w}
                  </p>
                ))}
              </>
            )}
            {!result && !busy && <p className="hint">Configure on the left and hit “Convert to bricks”.</p>}
            {loadError && mesh && <p className="error">{loadError}</p>}
          </section>

          <section className="panel">
            <h2>Get the set</h2>
            {result && (
              <>
                <div className="downloads">
                  <button
                    onClick={() =>
                      download(
                        `${fileName}-manual.pdf`,
                        buildManual3D(result.placements, {
                          title: fileName,
                          bom: result.bom,
                          priceMultiplier: priceMult,
                          warnings: result.warnings,
                        }).output('blob'),
                      )
                    }
                  >
                    📕 Instructions PDF
                  </button>
                  <button onClick={() => download(`${fileName}.ldr`, toLdr(result.placements, fileName), 'text/plain')}>
                    🧊 LDraw (.ldr)
                  </button>
                  <button onClick={() => download(`${fileName}-wantedlist.xml`, toBrickLinkXml(result.bom), 'application/xml')}>
                    🧱 BrickLink XML
                  </button>
                  <button onClick={() => download(`${fileName}-parts.csv`, toCsv(result.bom), 'text/csv')}>
                    📄 Parts CSV
                  </button>
                </div>
                <p className="hint">
                  The .ldr file opens in BrickLink Studio / LeoCAD if you want to refine the design by hand.
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
                        <th>Part</th>
                        <th className="num">Qty</th>
                        <th className="num">Est. $</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.bom.lines.map((l) => (
                        <tr key={`${l.partId}-${l.colorId}`}>
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
            {!result && <p className="hint">Convert the model to unlock downloads.</p>}
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
