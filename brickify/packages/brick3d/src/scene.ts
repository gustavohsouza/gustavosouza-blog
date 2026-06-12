import * as THREE from 'three';
import { COLOR_BY_ID, type Placement3D } from '@brickify/core';

export const LAYER_H = 1.2; // brick height in stud units

/**
 * Build instanced meshes (brick bodies + studs) for a set of placements,
 * optionally capped at maxLayer (instruction step-through).
 */
export function buildBrickMeshes(placements: Placement3D[], maxLayer = Infinity): THREE.Group {
  const visible = placements.filter((p) => p.layer <= maxLayer);
  const group = new THREE.Group();
  if (visible.length === 0) return group;

  const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
  const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.05 });
  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, visible.length);

  let studCount = 0;
  for (const p of visible) studCount += p.sx * p.sz;
  const studGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.18, 16);
  const studs = new THREE.InstancedMesh(studGeo, bodyMat.clone(), studCount);

  const m = new THREE.Matrix4();
  const color = new THREE.Color();
  let si = 0;
  visible.forEach((p, i) => {
    const hex = COLOR_BY_ID.get(p.colorId)?.hex ?? '#cccccc';
    color.set(hex);
    // tiny gap between bricks so the build reads as individual pieces
    m.makeScale(p.sx - 0.06, LAYER_H - 0.06, p.sz - 0.06);
    m.setPosition(p.x + p.sx / 2, p.layer * LAYER_H + LAYER_H / 2, p.z + p.sz / 2);
    bodies.setMatrixAt(i, m);
    bodies.setColorAt(i, color);
    for (let dx = 0; dx < p.sx; dx++) {
      for (let dz = 0; dz < p.sz; dz++) {
        m.makeScale(1, 1, 1);
        m.setPosition(p.x + dx + 0.5, (p.layer + 1) * LAYER_H + 0.09, p.z + dz + 0.5);
        studs.setMatrixAt(si, m);
        studs.setColorAt(si, color);
        si++;
      }
    }
  });
  bodies.instanceMatrix.needsUpdate = true;
  studs.instanceMatrix.needsUpdate = true;
  group.add(bodies, studs);
  return group;
}

export interface SceneHandle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  setPlacements: (placements: Placement3D[], maxLayer?: number) => void;
  frame: () => void;
  dispose: () => void;
}

/** Create a renderer+scene for brick models, reusable by the live viewer and the PDF generator. */
export function createBrickScene(canvas: HTMLCanvasElement, width: number, height: number): SceneHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#11141a');
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 4000);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x33363c, 1.0));
  const dir = new THREE.DirectionalLight(0xffffff, 1.6);
  dir.position.set(1, 2, 1.2);
  scene.add(dir);
  const dir2 = new THREE.DirectionalLight(0xffffff, 0.5);
  dir2.position.set(-1.5, 1, -1);
  scene.add(dir2);

  let bricks: THREE.Group | null = null;
  let bounds = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 10, 10));

  const setPlacements = (placements: Placement3D[], maxLayer = Infinity) => {
    if (bricks) {
      scene.remove(bricks);
      bricks.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
        }
      });
    }
    bricks = buildBrickMeshes(placements, maxLayer);
    scene.add(bricks);
    if (placements.length) {
      bounds = new THREE.Box3();
      for (const p of placements) {
        bounds.expandByPoint(new THREE.Vector3(p.x, p.layer * LAYER_H, p.z));
        bounds.expandByPoint(new THREE.Vector3(p.x + p.sx, (p.layer + 1) * LAYER_H, p.z + p.sz));
      }
    }
  };

  const frame = () => {
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3()).length() || 10;
    camera.position.set(center.x + size * 0.75, center.y + size * 0.65, center.z + size * 0.95);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
  };

  return {
    scene,
    camera,
    renderer,
    setPlacements,
    frame,
    dispose: () => renderer.dispose(),
  };
}
