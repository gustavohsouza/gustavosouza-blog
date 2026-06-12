import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/** Raw-mesh approval viewer: lets the user inspect the generated 3D model before legolizing. */
export function MeshPreview({ triangles, width = 420, height = 320 }: { triangles: Float32Array; width?: number; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(width, height, false);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#11141a');
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.01, 1000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x33363c, 1.1));
    const dir = new THREE.DirectionalLight(0xffffff, 1.4);
    dir.position.set(1, 2, 1.5);
    scene.add(dir);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(triangles, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#c9a15a', roughness: 0.6 }));
    scene.add(mesh);

    geo.computeBoundingSphere();
    const bs = geo.boundingSphere!;
    camera.position.set(bs.center.x + bs.radius * 1.8, bs.center.y + bs.radius * 1.2, bs.center.z + bs.radius * 2.1);
    const controls = new OrbitControls(camera, canvas);
    controls.target.copy(bs.center);
    controls.enableDamping = true;

    let raf = 0;
    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      controls.dispose();
      geo.dispose();
      renderer.dispose();
    };
  }, [triangles, width, height]);

  return <canvas ref={canvasRef} style={{ maxWidth: '100%', borderRadius: 8 }} />;
}
