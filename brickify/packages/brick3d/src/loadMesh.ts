import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Load an STL/OBJ/GLB/GLTF file into a de-indexed triangle soup
 * (9 floats per triangle, +Y up, world transforms applied).
 */
export async function loadMeshFile(file: File): Promise<Float32Array> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const buffer = await file.arrayBuffer();

  let geometries: THREE.BufferGeometry[] = [];
  if (ext === 'stl') {
    geometries = [new STLLoader().parse(buffer)];
  } else if (ext === 'obj') {
    const text = new TextDecoder().decode(buffer);
    const group = new OBJLoader().parse(text);
    geometries = collectGeometries(group);
  } else if (ext === 'glb' || ext === 'gltf') {
    const gltf = await new GLTFLoader().parseAsync(buffer, '');
    geometries = collectGeometries(gltf.scene);
  } else {
    throw new Error(`Unsupported format ".${ext}" — use STL, OBJ, GLB or GLTF`);
  }
  return mergeToTriangles(geometries);
}

/** Parse raw GLB bytes (e.g. downloaded from a generation API) into a triangle soup. */
export async function parseGlbBuffer(buffer: ArrayBuffer): Promise<Float32Array> {
  const gltf = await new GLTFLoader().parseAsync(buffer, '');
  return mergeToTriangles(collectGeometries(gltf.scene));
}

function mergeToTriangles(geometries: THREE.BufferGeometry[]): Float32Array {
  if (geometries.length === 0) throw new Error('No mesh found in file');

  const chunks: Float32Array[] = [];
  let total = 0;
  for (const geo of geometries) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const pos = g.getAttribute('position');
    if (!pos) continue;
    const arr = new Float32Array(pos.array as ArrayLike<number>);
    chunks.push(arr);
    total += arr.length;
  }
  const out = new Float32Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  if (out.length < 9) throw new Error('Mesh has no triangles');
  return out;
}

function collectGeometries(root: THREE.Object3D): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry) {
      const g = mesh.geometry.clone();
      g.applyMatrix4(mesh.matrixWorld);
      out.push(g);
    }
  });
  return out;
}
