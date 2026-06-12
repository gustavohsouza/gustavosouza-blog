import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Placement3D } from '@brickify/core';
import { createBrickScene, type SceneHandle, LAYER_H } from './scene.js';

export interface BrickViewerProps {
  placements: Placement3D[];
  /** Show only layers <= maxLayer (instruction step-through). */
  maxLayer?: number;
  width?: number;
  height?: number;
  className?: string;
}

/** Interactive 3D viewer for a brick build (orbit/zoom). */
export function BrickViewer({ placements, maxLayer = Infinity, width = 720, height = 540, className }: BrickViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<SceneHandle | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const framedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const handle = createBrickScene(canvas, width, height);
    handleRef.current = handle;
    const controls = new OrbitControls(handle.camera, canvas);
    controls.enableDamping = true;
    controlsRef.current = controls;
    let raf = 0;
    const loop = () => {
      controls.update();
      handle.renderer.render(handle.scene, handle.camera);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      controls.dispose();
      handle.dispose();
      handleRef.current = null;
      framedRef.current = false;
    };
  }, [width, height]);

  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    handle.setPlacements(placements, maxLayer);
    if (!framedRef.current && placements.length) {
      handle.frame();
      controlsRef.current!.target.copy(centerOf(placements));
      framedRef.current = true;
    }
  }, [placements, maxLayer]);

  return <canvas ref={canvasRef} className={className} style={{ maxWidth: '100%', borderRadius: 8 }} />;
}

function centerOf(placements: Placement3D[]): THREE.Vector3 {
  const box = new THREE.Box3();
  for (const p of placements) {
    box.expandByPoint(new THREE.Vector3(p.x, p.layer * LAYER_H, p.z));
    box.expandByPoint(new THREE.Vector3(p.x + p.sx, (p.layer + 1) * LAYER_H, p.z + p.sz));
  }
  return box.getCenter(new THREE.Vector3());
}
