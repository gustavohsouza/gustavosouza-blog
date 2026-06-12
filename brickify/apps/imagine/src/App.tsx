import { useMemo, useState } from 'react';
import {
  hollow as hollowGrid,
  legolize,
  PALETTE,
  toBrickLinkXml,
  toCsv,
  toLdr,
  voxelize,
  type LegolizeResult,
  type PieceProfile,
} from '@brickify/core';
import { BrickViewer, buildManual3D, loadMeshFile, parseGlbBuffer } from '@brickify/brick3d';
import { imageTo3d, monthlyUsage, MONTHLY_CAP } from './meshy.js';
import { MeshPreview } from './MeshPreview.js';

type Stage = 'input' | 'generating' | 'approve' | 'brick';

function download(name: string, content: string | Blob, type = 'text/plain'): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const STAGES: Array<[Stage, string]> = [
  ['input', '1 · Photo'],
  ['generating', '2 · Generate 3D'],
  ['approve', '3 · Approve model'],
  ['brick', '4 · Brick it'],
];

export default function App() {
  const [stage, setStage] = useState<Stage>('input');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState('creation');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('brickify-meshy-key') ?? '');
  const [baseUrl, setBaseUrl] = useState(() => localStorage.getItem('brickify-meshy-base') ?? '');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [triangles, setTriangles] = useState<Float32Array | null>(null);

  // brick stage state
  const [targetStuds, setTargetStuds] = useState(32);
  const [profile, setProfile] = useState<PieceProfile>('standard');
  const [hollowOn, setHollowOn] = useState(true);
  const [colorId, setColorId] = useState('yellow');
  const [priceMult, setPriceMult] = useState(1);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LegolizeResult | null>(null);
  const [maxLayer, setMaxLayer] = useState<number>(Infinity);

  const usage = monthlyUsage();

  const onImage = (file: File) => {
    setError(null);
    setFileName(file.name.replace(/\.[^.]+$/, '') || 'creation');
    const reader = new FileReader();
    reader.onload = () => setImageUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const generate = async () => {
    if (!imageUrl || !apiKey) return;
    localStorage.setItem('brickify-meshy-key', apiKey);
    localStorage.setItem('brickify-meshy-base', baseUrl);
    setStage('generating');
    setProgress(0);
    setError(null);
    try {
      const glb = await imageTo3d(imageUrl, {
        apiKey,
        baseUrl: baseUrl || undefined,
        onProgress: (p) => setProgress(p.progress),
      });
      setTriangles(await parseGlbBuffer(glb));
      setStage('approve');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage('input');
    }
  };

  const onMeshFile = async (file: File) => {
    setError(null);
    try {
      setTriangles(await loadMeshFile(file));
      setFileName(file.name.replace(/\.[^.]+$/, '') || 'creation');
      setStage('approve');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const convert = () => {
    if (!triangles) return;
    setBusy(true);
    setResult(null);
    setTimeout(() => {
      try {
        let grid = voxelize(triangles, { targetStuds });
        if (hollowOn) grid = hollowGrid(grid, 2);
        setResult(legolize(grid, { profile, colorId, autoConnect: true }));
        setMaxLayer(Infinity);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    }, 30);
  };

  const layers = useMemo(
    () => (result && result.placements.length ? Math.max(...result.placements.map((p) => p.layer)) + 1 : 0),
    [result],
  );

  return (
    <div className="app">
      <header>
        <h1>
          Brickify <span className="accent">Imagine</span>
        </h1>
        <p className="tagline">
          From a photo or drawing to a buildable brick set: AI turns the image into a 3D model, you approve it,
          and Brickify lays the bricks — parts list and instructions included.
        </p>
      </header>

      <div className="steps">
        {STAGES.map(([id, label]) => (
          <span key={id} className={`step-chip ${stage === id ? 'on' : ''}`}>
            {label}
          </span>
        ))}
      </div>

      {stage === 'input' && (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <section className="panel">
            <h2>Image of what you want to build</h2>
            <label
              className="drop"
              style={{ padding: '34px 20px', margin: '10px 0' }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) onImage(f);
              }}
            >
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onImage(e.target.files[0])} />
              {imageUrl ? <img src={imageUrl} className="imgpreview" alt="input" /> : (
                <>
                  <strong>Drop an image here</strong> or click to choose. One object, clean background works best.
                </>
              )}
            </label>

            <h2>Generation (Meshy API)</h2>
            <div className="key-row">
              <input
                type="password"
                placeholder="Meshy API key (msy_…) — stored only in your browser"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
            <details>
              <summary>Advanced: custom API base URL (CORS proxy)</summary>
              <div className="key-row" style={{ marginTop: 6 }}>
                <input
                  type="text"
                  placeholder="https://your-proxy.example.com/openapi/v1"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
              </div>
            </details>
            <p className="hint">
              {usage.count}/{MONTHLY_CAP} generations used this month (local soft cap to protect your budget).
            </p>
            <button className="cta" disabled={!imageUrl || !apiKey} onClick={() => void generate()}>
              Generate 3D model
            </button>
            {error && <p className="error">{error}</p>}
          </section>

          <section className="panel">
            <h2>Already have a 3D model?</h2>
            <p className="hint">
              Skip the AI step: drop an STL/OBJ/GLB file and go straight to bricks (same pipeline as Brickify
              Studio).
            </p>
            <label
              className="drop"
              style={{ padding: '34px 20px', margin: '10px 0' }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) void onMeshFile(f);
              }}
            >
              <input
                type="file"
                accept=".stl,.obj,.glb,.gltf"
                hidden
                onChange={(e) => e.target.files?.[0] && void onMeshFile(e.target.files[0])}
              />
              <strong>Drop a 3D file here</strong> (STL, OBJ, GLB, GLTF)
            </label>
          </section>
        </div>
      )}

      {stage === 'generating' && (
        <section className="panel" style={{ maxWidth: 520, margin: '0 auto' }}>
          <h2>Generating your 3D model…</h2>
          <div className="progress">
            <div style={{ width: `${Math.max(4, progress)}%` }} />
          </div>
          <p className="hint">This usually takes 1–3 minutes. Keep this tab open.</p>
        </section>
      )}

      {stage === 'approve' && triangles && (
        <section className="panel" style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <h2>Does this look right?</h2>
          <MeshPreview triangles={triangles} width={520} height={380} />
          <p className="hint">Drag to rotate. AI generations aren't perfect — regenerate if it's off.</p>
          <div className="downloads" style={{ marginTop: 10 }}>
            <button className="cta" onClick={() => setStage('brick')}>
              ✅ Looks good — brick it
            </button>
            <button
              onClick={() => {
                setTriangles(null);
                setResult(null);
                setStage('input');
              }}
            >
              ↩ Back / regenerate
            </button>
          </div>
        </section>
      )}

      {stage === 'brick' && triangles && (
        <div className="grid">
          <section className="panel">
            <h2>Size</h2>
            <label className="row">
              Longest side
              <input type="range" min={8} max={96} value={targetStuds} onChange={(e) => setTargetStuds(Number(e.target.value))} />
              <span className="hint">{targetStuds} studs</span>
            </label>
            <h2>Pieces</h2>
            <div className="toggles">
              {(['basic', 'standard', 'advanced'] as const).map((p) => (
                <button key={p} className={profile === p ? 'on' : ''} onClick={() => setProfile(p)}>
                  {p}
                </button>
              ))}
            </div>
            <label className="check">
              <input type="checkbox" checked={hollowOn} onChange={(e) => setHollowOn(e.target.checked)} />
              Hollow interior
            </label>
            <h2>Color</h2>
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
            <button className="cta" onClick={convert} disabled={busy}>
              {busy ? 'Converting…' : result ? 'Convert again' : 'Convert to bricks'}
            </button>
            <button className="ghost" onClick={() => setStage('approve')}>
              ← Back to model
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
                  <span className="hint">{Number.isFinite(maxLayer) ? `${maxLayer + 1} / ${layers}` : `all ${layers}`}</span>
                </label>
                <p className="stats">
                  {result.bom.totalPieces.toLocaleString()} pieces · {layers} layers · estimated{' '}
                  <strong>${(result.bom.totalUsd * priceMult).toFixed(2)}</strong>
                  <label className="mult">
                    price adj. ×
                    <input type="number" step={0.1} min={0.2} max={5} value={priceMult} onChange={(e) => setPriceMult(Number(e.target.value) || 1)} />
                  </label>
                </p>
                {result.warnings.map((w) => (
                  <p key={w} className="error">⚠ {w}</p>
                ))}
              </>
            )}
            {error && <p className="error">{error}</p>}
          </section>

          <section className="panel">
            <h2>Get the set</h2>
            {result ? (
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
            ) : (
              <p className="hint">Convert the model to unlock downloads.</p>
            )}
          </section>
        </div>
      )}

      <footer>
        Brickify is not affiliated with the LEGO Group or Meshy. LEGO® is a trademark of the LEGO Group.
        Estimates assume LEGO-compatible bricks (Gobricks and similar).
      </footer>
    </div>
  );
}
