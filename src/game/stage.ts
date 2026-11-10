import * as THREE from "three";

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  dispose(): void;
}

/**
 * Phase 01 placeholder stage: one small Home planet under dusk light, so the
 * renderer, resize handling and frame loop are proven end to end. The real
 * world engine (planet walking, toon shading, ink outlines) replaces this in
 * Phase 02.
 *
 * Returns null when WebGL is not available.
 */
export function createStage(canvas: HTMLCanvasElement): Stage | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#2E2A4F");

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 1.2, 6.5);
  camera.lookAt(0, 0, 0);

  // Three-band toon ramp, the base of the handmade look.
  const ramp = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
  ramp.minFilter = THREE.NearestFilter;
  ramp.magFilter = THREE.NearestFilter;
  ramp.needsUpdate = true;

  const planet = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.6, 5),
    new THREE.MeshToonMaterial({ color: "#7FA37A", gradientMap: ramp }),
  );
  scene.add(planet);

  const lampLight = new THREE.DirectionalLight("#F2A541", 2.4);
  lampLight.position.set(-3, 4, 3);
  scene.add(lampLight);
  scene.add(new THREE.HemisphereLight("#F4ECDD", "#2E2A4F", 0.9));

  const resize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Pull back on tall screens so the whole planet stays in view.
    camera.position.z = Math.max(6.5, 4.6 / camera.aspect);
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener("resize", resize);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const timer = new THREE.Timer();
  renderer.setAnimationLoop((time) => {
    timer.update(time);
    const dt = timer.getDelta();
    if (!reducedMotion) planet.rotation.y += dt * 0.15;
    renderer.render(scene, camera);
  });

  return {
    renderer,
    scene,
    camera,
    dispose() {
      renderer.setAnimationLoop(null);
      window.removeEventListener("resize", resize);
      planet.geometry.dispose();
      planet.material.dispose();
      ramp.dispose();
      renderer.dispose();
    },
  };
}
