import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface LoadedMesh {
  /** De-indexed triangle vertices, 9 floats per triangle, +Y up, world transforms applied. */
  positions: Float32Array;
  /**
   * Per-triangle sRGB color (3 floats 0..255 per triangle), or null when the
   * file carries no usable color information (e.g. plain STL).
   */
  colors: Float32Array | null;
}

interface MeshEntry {
  geometry: THREE.BufferGeometry; // non-indexed, world-transformed
  material: THREE.Material | null;
}

/** Load an STL/OBJ/GLB/GLTF file into triangles plus optional per-triangle colors. */
export async function loadMeshDetailed(file: File): Promise<LoadedMesh> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const buffer = await file.arrayBuffer();

  let entries: MeshEntry[] = [];
  if (ext === 'stl') {
    const geo = new STLLoader().parse(buffer);
    entries = [{ geometry: geo.index ? geo.toNonIndexed() : geo, material: null }];
  } else if (ext === 'obj') {
    const text = new TextDecoder().decode(buffer);
    entries = collectEntries(new OBJLoader().parse(text));
  } else if (ext === 'glb' || ext === 'gltf') {
    const gltf = await new GLTFLoader().parseAsync(buffer, '');
    entries = collectEntries(gltf.scene);
  } else {
    throw new Error(`Unsupported format ".${ext}" — use STL, OBJ, GLB or GLTF`);
  }
  return mergeEntries(entries);
}

/** Backwards-compatible: triangles only. */
export async function loadMeshFile(file: File): Promise<Float32Array> {
  return (await loadMeshDetailed(file)).positions;
}

/** Parse raw GLB bytes (e.g. downloaded from a generation API). */
export async function parseGlbDetailed(buffer: ArrayBuffer): Promise<LoadedMesh> {
  const gltf = await new GLTFLoader().parseAsync(buffer, '');
  return mergeEntries(collectEntries(gltf.scene));
}

export async function parseGlbBuffer(buffer: ArrayBuffer): Promise<Float32Array> {
  return (await parseGlbDetailed(buffer)).positions;
}

function collectEntries(root: THREE.Object3D): MeshEntry[] {
  const out: MeshEntry[] = [];
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry) {
      let g = mesh.geometry.clone();
      g.applyMatrix4(mesh.matrixWorld);
      if (g.index) g = g.toNonIndexed();
      const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      out.push({ geometry: g, material: material ?? null });
    }
  });
  return out;
}

function mergeEntries(entries: MeshEntry[]): LoadedMesh {
  entries = entries.filter((e) => e.geometry.getAttribute('position'));
  if (entries.length === 0) throw new Error('No mesh found in file');

  let totalFloats = 0;
  for (const e of entries) totalFloats += e.geometry.getAttribute('position').array.length;
  const positions = new Float32Array(totalFloats);
  const colors = new Float32Array(totalFloats / 3).fill(-1); // 3 per triangle
  let anyColor = false;

  let posOff = 0;
  let triOff = 0;
  for (const e of entries) {
    const pos = e.geometry.getAttribute('position');
    positions.set(new Float32Array(pos.array as ArrayLike<number>), posOff);
    const nTris = pos.count / 3;

    const triColors = extractTriangleColors(e, nTris);
    if (triColors) {
      colors.set(triColors, triOff * 3);
      anyColor = true;
    }
    posOff += pos.array.length;
    triOff += nTris;
  }
  if (positions.length < 9) throw new Error('Mesh has no triangles');

  if (anyColor) {
    // Entries without color info default to mid-gray so they stay visible.
    for (let i = 0; i < colors.length; i += 3) {
      if (colors[i] < 0) {
        colors[i] = 160;
        colors[i + 1] = 160;
        colors[i + 2] = 160;
      }
    }
  }
  return { positions, colors: anyColor ? colors : null };
}

/** sRGB triangle colors from vertex colors, a texture map, or the material color. */
function extractTriangleColors(entry: MeshEntry, nTris: number): Float32Array | null {
  const { geometry, material } = entry;
  const colorAttr = geometry.getAttribute('color');
  const std = material as THREE.MeshStandardMaterial | null;
  const sample = std?.map ? makeTextureSampler(std.map) : null;
  const uv = geometry.getAttribute('uv');

  const matRgb = std?.color ? srgb255(std.color) : null;
  const matIsInformative = !!matRgb && !(matRgb[0] > 250 && matRgb[1] > 250 && matRgb[2] > 250);

  if (!colorAttr && !(sample && uv) && !matIsInformative) return null;

  const out = new Float32Array(nTris * 3);
  const c = new THREE.Color();
  for (let t = 0; t < nTris; t++) {
    let r = 255, g = 255, b = 255;
    if (colorAttr) {
      c.fromBufferAttribute(colorAttr as THREE.BufferAttribute, t * 3)
        .add(new THREE.Color().fromBufferAttribute(colorAttr as THREE.BufferAttribute, t * 3 + 1))
        .add(new THREE.Color().fromBufferAttribute(colorAttr as THREE.BufferAttribute, t * 3 + 2))
        .multiplyScalar(1 / 3);
      const s = srgb255(c);
      r = s[0]; g = s[1]; b = s[2];
    } else if (sample && uv) {
      const u = (uv.getX(t * 3) + uv.getX(t * 3 + 1) + uv.getX(t * 3 + 2)) / 3;
      const v = (uv.getY(t * 3) + uv.getY(t * 3 + 1) + uv.getY(t * 3 + 2)) / 3;
      [r, g, b] = sample(u, v);
    }
    if (matRgb) {
      r = (r * matRgb[0]) / 255;
      g = (g * matRgb[1]) / 255;
      b = (b * matRgb[2]) / 255;
    }
    out[t * 3] = r;
    out[t * 3 + 1] = g;
    out[t * 3 + 2] = b;
  }
  return out;
}

/** three.js Colors are linear when color management is on; convert back to sRGB 0..255. */
function srgb255(color: THREE.Color): [number, number, number] {
  const c = color.clone().convertLinearToSRGB();
  return [
    Math.min(255, Math.max(0, Math.round(c.r * 255))),
    Math.min(255, Math.max(0, Math.round(c.g * 255))),
    Math.min(255, Math.max(0, Math.round(c.b * 255))),
  ];
}

/** Read a texture's pixels once and return a wrapped (u,v) -> sRGB sampler. */
function makeTextureSampler(tex: THREE.Texture): ((u: number, v: number) => [number, number, number]) | null {
  const img = tex.image as CanvasImageSource & { width?: number; height?: number };
  const w = (img?.width as number) || 0;
  const h = (img?.height as number) || 0;
  if (!img || !w || !h) return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  try {
    ctx.drawImage(img, 0, 0);
  } catch {
    return null; // e.g. compressed texture without drawable image
  }
  const px = ctx.getImageData(0, 0, w, h).data;
  return (u: number, v: number) => {
    const wu = ((u % 1) + 1) % 1;
    const wv = ((v % 1) + 1) % 1;
    const x = Math.min(w - 1, Math.floor(wu * w));
    // glTF v origin is top-left; three flips via flipY, so invert here.
    const y = Math.min(h - 1, Math.floor((tex.flipY ? 1 - wv : wv) * h));
    const i = (y * w + x) * 4;
    return [px[i], px[i + 1], px[i + 2]];
  };
}
