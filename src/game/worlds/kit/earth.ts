import { AdditiveBlending, BackSide, BufferAttribute, Color, Group, Mesh, ShaderMaterial, SphereGeometry, type Vector3 } from "three";
import type { ToonLibrary } from "../../render/toon";
import { fbm3 } from "../../world/noise";

/**
 * Earth hanging in a black sky, as Dad painted it for his Moon dioramas:
 * blue seas, green and sand land, white cloud swirls and a thin blue glow.
 * An illustration, not a photo, and much bigger than it would look from the Moon.
 */
export class PaintedEarth {
  readonly root = new Group();
  private halo: Mesh<SphereGeometry, ShaderMaterial>;
  private body: Mesh;

  constructor(toon: ToonLibrary, position: Vector3, radius: number) {
    const geometry = new SphereGeometry(1, 96, 64);
    const p = geometry.getAttribute("position");
    const colors = new Float32Array(p.count * 3);
    const sea = new Color("#3F74B5");
    const deep = new Color("#2C5490");
    const land = new Color("#7FA36A");
    const sand = new Color("#CDB57E");
    const cloud = new Color("#F4F1EA");
    const ice = new Color("#EEF2F4");
    const c = new Color();
    for (let i = 0; i < p.count; i += 1) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const continents = fbm3(x * 1.9, y * 1.9, z * 1.9, 5, 21);
      c.copy(deep).lerp(sea, Math.min(1, Math.max(0, 0.7 + continents * 3)));
      if (continents > 0.1) c.copy(land).lerp(sand, Math.min(1, Math.max(0, (Math.abs(y) < 0.45 ? 0.6 : 0) + fbm3(x * 4, y * 4, z * 4, 2, 5) * 2)));
      if (Math.abs(y) > 0.86) c.copy(ice);
      const swirl = fbm3(x * 3 + y * 1.5, y * 5, z * 3 - y, 3, 9);
      if (swirl > 0.2) c.lerp(cloud, Math.min(0.95, (swirl - 0.2) * 9));
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    this.body = new Mesh(geometry, toon.toon({ vertexColors: true, paint: 0.05, rim: 0.4, nearFade: false }));
    this.body.scale.setScalar(radius);
    this.body.rotation.set(0.35, 1.2, 0.1);

    this.halo = new Mesh(
      new SphereGeometry(1, 32, 20),
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: BackSide,
        blending: AdditiveBlending,
        uniforms: { uFlash: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec3 vN;
          varying vec3 vV;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vN = normalize(normalMatrix * normal);
            vV = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uFlash;
          varying vec3 vN;
          varying vec3 vV;
          void main() {
            float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
            vec3 blue = vec3(0.45, 0.7, 1.0);
            vec3 green = vec3(0.55, 1.0, 0.7);
            float a = rim * (0.55 + uFlash * 1.2);
            gl_FragColor = vec4(mix(blue, green, uFlash) * a, a);
          }
        `,
      }),
    );
    this.halo.scale.setScalar(radius * 1.16);
    this.root.add(this.body, this.halo);
    this.root.position.copy(position);
  }

  /** A green flash round the Earth when light comes home. 0 to 1. */
  set flash(value: number) {
    this.halo.material.uniforms["uFlash"]!.value = value;
  }

  update(dt: number, reducedMotion: boolean): void {
    if (!reducedMotion) this.body.rotation.y += dt * 0.02;
  }

  dispose(): void {
    this.body.geometry.dispose();
    this.halo.geometry.dispose();
    this.halo.material.dispose();
  }
}
