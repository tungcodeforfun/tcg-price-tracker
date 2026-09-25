// The interactive card, loaded on demand by holo-card.tsx. Vanilla three.js with named imports only.
import {
  CanvasTexture,
  Color,
  EdgesGeometry,
  ExtrudeGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  Vector2,
  WebGLRenderer,
} from "three";
import { paintFace } from "./face-canvas";
import { HOLO, LEDGER, TERMINAL } from "./tones";
import type { FaceText, HoloTone } from "./tones";

export interface HoloSceneOptions extends FaceText {
  tone: HoloTone;
  /** First frame is on screen; the static face can fade out. */
  onReady: () => void;
  /** The GL context died; show the static face again. */
  onLost: () => void;
}

const CARD_W = 2.5;
const CARD_H = (CARD_W * 88) / 63;
const DEPTH = 0.035;
const CORNER = CARD_W * 0.048;
/** Share of the box the card fills at rest; the static face is inset 6% per side to match. */
const FACE_FILL = 0.88;
const FOV = 24;
const MAX_TILT = 0.3;
const SPRING = 70;
const DAMPING = 11;

const TONE = {
  ledger: { edge: LEDGER.edge, back: LEDGER.accent, shadow: LEDGER.shadow, shadowOpacity: 0.4 },
  terminal: { edge: TERMINAL.edge, back: TERMINAL.screen, shadow: TERMINAL.shadow, shadowOpacity: 0.45 },
  holo: { edge: HOLO.edge, back: HOLO.night, shadow: HOLO.shadow, shadowOpacity: 0.55 },
} as const;

const FONTS: Record<HoloTone, string[]> = {
  ledger: ['600 16px "Fraunces Variable"', 'italic 400 16px "Fraunces Variable"'],
  terminal: ['700 16px "JetBrains Mono Variable"'],
  holo: ['700 16px "Unbounded Variable"', '500 16px "Space Grotesk Variable"'],
};

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform sampler2D uMask;
  uniform float uTime;
  uniform float uIntro;
  uniform vec2 uTilt;
  uniform vec2 uGlare;
  // Gold swatches arrive in sRGB (gamma) space, matching where the shader blends.
  uniform vec3 uGoldDark;
  uniform vec3 uGold;
  uniform vec3 uGoldLight;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;

  const float ASPECT = 88.0 / 63.0;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 s = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), s.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), s.x), s.y);
  }
  vec3 spectrum(float h) {
    return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  }
  vec3 screen(vec3 a, vec3 b) { return 1.0 - (1.0 - a) * (1.0 - b); }
  vec3 overlay(vec3 a, vec3 b) {
    return mix(2.0 * a * b, 1.0 - 2.0 * (1.0 - a) * (1.0 - b), step(0.5, a));
  }

  void main() {
    // Blend in gamma space, like CSS blend modes, so small additions don't bleach dark ink.
    vec3 base = pow(texture2D(uMap, vUv).rgb, vec3(1.0 / 2.2));
    float mask = texture2D(uMask, vUv).r;
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 N = normalize(vWorldNormal);
    vec3 R = reflect(-V, N);
    vec2 aspectUv = vec2(vUv.x, vUv.y * ASPECT);
    float glare = smoothstep(0.85, 0.0, distance(aspectUv, vec2(uGlare.x, uGlare.y * ASPECT)));
    vec3 col = base;

    #ifdef TONE_HOLO
      // Prism foil: hue bands sweep with the reflection vector, etched lines and glitter on top.
      float angle = dot(R.xy, vec2(1.3, 0.9)) * 2.4;
      float h = fract((vUv.x * 0.7 + vUv.y * 0.9) * 0.9 + angle + uTime * 0.015);
      vec3 prism = mix(spectrum(h), vec3(1.0), 0.18);
      float etch = 0.5 + 0.5 * sin((vUv.x - vUv.y * ASPECT * 0.47) * 260.0 + angle * 14.0);
      vec2 cell = floor(vUv * vec2(150.0, 210.0));
      float twinkle = pow(0.5 + 0.5 * sin(uTime * 2.2 + hash(cell + 3.1) * 40.0 + angle * 26.0), 8.0);
      float glitter = step(0.982, hash(cell)) * twinkle;
      float foil = mask * uIntro;
      col = mix(col, overlay(col, prism), foil * (0.35 + 0.3 * etch));
      col = screen(col, prism * glare * 0.35 * foil);
      col += glitter * foil * 0.7;
      col = screen(col, vec3(0.9, 0.88, 1.0) * glare * glare * 0.18 * uIntro);
    #endif

    #ifdef TONE_LEDGER
      // Gold leaf: slightly uneven leaf catches a warm key light; cream stock gets a satin sheen.
      vec2 wobble = vec2(noise(vUv * vec2(30.0, 42.0)), noise(vUv * vec2(42.0, 30.0) + 7.0)) - 0.5;
      vec3 leafR = reflect(-V, normalize(N + vec3(wobble * 0.08, 0.0)));
      float sheen = dot(leafR, normalize(vec3(-0.35, 0.55, 1.0)));
      vec3 gold = mix(uGoldDark, uGold, smoothstep(0.55, 1.0, sheen));
      gold = mix(gold, uGoldLight, pow(max(sheen, 0.0), 30.0));
      gold *= 0.9 + 0.2 * (0.6 * noise(vUv * vec2(90.0, 126.0)) + 0.4 * noise(vUv * vec2(260.0, 363.0)));
      col = mix(col, gold, mask * uIntro);
      float band = smoothstep(0.22, 0.0, abs(vUv.x * 0.8 + vUv.y * 0.6 - 0.7 + uTilt.y * 2.2 - uTilt.x * 1.6));
      col = screen(col, vec3(1.0, 0.96, 0.86) * band * 0.06 * (1.0 - mask) * uIntro);
      col = screen(col, vec3(1.0, 0.95, 0.85) * glare * 0.05 * uIntro);
    #endif

    #ifdef TONE_TERMINAL
      // Phosphor: scanlines, a refresh band that rides the tilt, bloom on lit strokes, CRT vignette.
      float scan = 0.84 + 0.16 * sin(vUv.y * 110.0 * 6.2831853);
      float sweep = smoothstep(0.12, 0.0, abs(fract(vUv.y - uTime * 0.08 + R.y * 0.9) - 0.5));
      float glow = mask * (0.35 + 0.9 * sweep + 0.5 * glare);
      col = col * mix(1.0, scan, uIntro) + base * glow * 0.6 * uIntro;
      col += vec3(0.05, 0.35, 0.18) * sweep * 0.08 * uIntro;
      vec2 d = vUv - 0.5;
      col *= 1.0 - 0.35 * uIntro * pow(length(d * vec2(1.0, 1.1)) * 1.35, 3.0);
    #endif

    gl_FragColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(2.2)), 1.0);
    #include <colorspace_fragment>
  }
`;

function cardShape(): Shape {
  const s = new Shape();
  s.moveTo(CORNER, 0);
  s.lineTo(CARD_W - CORNER, 0);
  s.quadraticCurveTo(CARD_W, 0, CARD_W, CORNER);
  s.lineTo(CARD_W, CARD_H - CORNER);
  s.quadraticCurveTo(CARD_W, CARD_H, CARD_W - CORNER, CARD_H);
  s.lineTo(CORNER, CARD_H);
  s.quadraticCurveTo(0, CARD_H, 0, CARD_H - CORNER);
  s.lineTo(0, CORNER);
  s.quadraticCurveTo(0, 0, CORNER, 0);
  return s;
}

function faceTexture(tone: HoloTone, text: FaceText, width: number, mode: "color" | "mask", anisotropy: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.round((width * 88) / 63);
  paintFace(canvas, tone, text, mode);
  const texture = new CanvasTexture(canvas);
  if (mode === "color") texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}

function shadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.translate(64, 80);
    ctx.scale(1, 1.25);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.55, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-64, -64, 128, 128);
  }
  return new CanvasTexture(canvas);
}

async function loadFonts(tone: HoloTone, text: FaceText) {
  const sample = `${text.title}${text.subtitle}${text.price}`;
  const timeout = Promise.withResolvers<void>();
  setTimeout(timeout.resolve, 2500);
  await Promise.race([Promise.all(FONTS[tone].map((font) => document.fonts.load(font, sample))), timeout.promise]);
}

/** Mounts the 3D card into `stage`, tracking the pointer over `host`. Returns the disposer. */
export function mountHoloScene(host: HTMLElement, stage: HTMLElement, options: HoloSceneOptions): () => void {
  const { tone, onReady, onLost } = options;
  const text = { title: options.title, subtitle: options.subtitle, price: options.price };
  const theme = TONE[tone];

  const dpr = Math.min(window.devicePixelRatio, 2);
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.style.cssText = "display:block;width:100%;height:100%";

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 63 / 88, 0.1, 50);
  const card = new Group();
  scene.add(card);

  const shape = cardShape();
  const faceGeometry = new ShapeGeometry(shape, 8);
  const uv = faceGeometry.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / CARD_W, uv.getY(i) / CARD_H);
  faceGeometry.translate(-CARD_W / 2, -CARD_H / 2, DEPTH / 2 + 0.001);
  const bodyGeometry = new ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: false, curveSegments: 8 });
  bodyGeometry.translate(-CARD_W / 2, -CARD_H / 2, -DEPTH / 2);

  const maxAnisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  const uniforms = {
    uMap: { value: null as CanvasTexture | null },
    uMask: { value: null as CanvasTexture | null },
    uTime: { value: 0 },
    uIntro: { value: 0 },
    uTilt: { value: new Vector2() },
    uGlare: { value: new Vector2(0.5, 0.5) },
    uGoldDark: { value: new Color(LEDGER.goldDark).convertLinearToSRGB() },
    uGold: { value: new Color(LEDGER.gold).convertLinearToSRGB() },
    uGoldLight: { value: new Color(LEDGER.goldLight).convertLinearToSRGB() },
  };
  const faceMaterial = new ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    defines: { [`TONE_${tone.toUpperCase()}`]: "" },
  });
  const bodyMaterial = [new MeshBasicMaterial({ color: theme.back }), new MeshBasicMaterial({ color: theme.edge })];
  card.add(new Mesh(faceGeometry, faceMaterial), new Mesh(bodyGeometry, bodyMaterial));

  const shadowMap = shadowTexture();
  const shadowGeometry = new PlaneGeometry(CARD_W * 1.2, CARD_H * 1.12);
  const shadowMaterial = new MeshBasicMaterial({
    map: shadowMap,
    color: theme.shadow,
    transparent: true,
    opacity: theme.shadowOpacity,
    depthWrite: false,
  });
  const shadow = new Mesh(shadowGeometry, shadowMaterial);
  shadow.position.z = -0.35;
  scene.add(shadow);

  let edgeGeometry: EdgesGeometry | undefined;
  const lineMaterials: LineBasicMaterial[] = [];
  if (tone === "terminal") {
    edgeGeometry = new EdgesGeometry(bodyGeometry, 25);
    const edgeMaterial = new LineBasicMaterial({ color: TERMINAL.phosphor });
    const ghostMaterial = new LineBasicMaterial({ color: TERMINAL.phosphor, transparent: true, opacity: 0.28 });
    lineMaterials.push(edgeMaterial, ghostMaterial);
    const ghost = new LineSegments(edgeGeometry, ghostMaterial);
    ghost.scale.setScalar(1.04);
    ghost.position.z = -0.22;
    card.add(new LineSegments(edgeGeometry, edgeMaterial), ghost);
  }

  // Motion state: spring-driven tilt toward the pointer, or an idle sway when there is none.
  const tilt = { x: 0, y: 0, vx: 0, vy: 0 };
  const glare = new Vector2(0.5, 0.5);
  const glareTarget = new Vector2();
  let pointer: { nx: number; ny: number; u: number; v: number } | null = null;
  let startedAt = 0;
  let last = 0;
  let raf = 0;
  let ready = false;
  let onScreen = false;
  let disposed = false;

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    const t = (now - startedAt) / 1000;
    const sway = Math.min(t / 2.5, 1);
    const targetX = pointer ? pointer.ny * MAX_TILT : Math.sin(t * 0.5 + 1.1) * 0.06 * sway;
    const targetY = pointer ? pointer.nx * MAX_TILT : Math.sin(t * 0.37) * 0.14 * sway;
    tilt.vx += (SPRING * (targetX - tilt.x) - DAMPING * tilt.vx) * dt;
    tilt.vy += (SPRING * (targetY - tilt.y) - DAMPING * tilt.vy) * dt;
    tilt.x += tilt.vx * dt;
    tilt.y += tilt.vy * dt;
    card.rotation.set(tilt.x, tilt.y, 0);
    shadow.position.set(-tilt.y * 0.35, -0.1 + tilt.x * 0.35, -0.35);

    const glareU = pointer ? pointer.u : 0.5 + (tilt.y / MAX_TILT) * 0.45;
    const glareV = pointer ? pointer.v : 0.5 - (tilt.x / MAX_TILT) * 0.45;
    glare.lerp(glareTarget.set(glareU, glareV), 1 - Math.exp(-dt * 10));
    uniforms.uGlare.value.copy(glare);
    uniforms.uTilt.value.set(tilt.x, tilt.y);
    uniforms.uTime.value = t;
    uniforms.uIntro.value = Math.min(t / 1.2, 1);
    renderer.render(scene, camera);
  }

  function syncLoop() {
    const run = ready && onScreen && document.visibilityState === "visible";
    if (run && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    } else if (!run && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function resize() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const visibleH = Math.max(CARD_H, CARD_W / camera.aspect) / FACE_FILL;
    camera.position.z = DEPTH / 2 + visibleH / (2 * Math.tan((FOV * Math.PI) / 360));
    camera.updateProjectionMatrix();
    if (!ready) return;
    fitTextures();
    if (!raf) renderer.render(scene, camera);
  }

  // Paint the face near its on-screen resolution so text stays crisp; repaint only on big resizes.
  let paintedWidth = 0;
  function fitTextures() {
    const width = Math.min(2048, Math.max(256, Math.ceil((stage.clientWidth * FACE_FILL * dpr) / 64) * 64));
    if (Math.abs(width - paintedWidth) < width * 0.2) return;
    paintedWidth = width;
    uniforms.uMap.value?.dispose();
    uniforms.uMask.value?.dispose();
    uniforms.uMap.value = faceTexture(tone, text, width, "color", maxAnisotropy);
    uniforms.uMask.value = faceTexture(tone, text, width / 2, "mask", maxAnisotropy);
  }

  function onPointerMove(event: PointerEvent) {
    const r = host.getBoundingClientRect();
    const x = (event.clientX - r.left) / r.width;
    const y = (event.clientY - r.top) / r.height;
    const reach = 0.2;
    if (x < -reach || x > 1 + reach || y < -reach || y > 1 + reach) {
      pointer = null;
      return;
    }
    let nx = Math.max(-1, Math.min(1, x * 2 - 1));
    let ny = Math.max(-1, Math.min(1, y * 2 - 1));
    const len = Math.hypot(nx, ny);
    if (len > 1) {
      nx /= len;
      ny /= len;
    }
    const inset = (1 - FACE_FILL) / 2;
    pointer = { nx, ny, u: (x - inset) / FACE_FILL, v: 1 - (y - inset) / FACE_FILL };
  }
  function onPointerEnd(event: PointerEvent) {
    if (event.pointerType !== "mouse") pointer = null;
  }
  function onPointerLeaveWindow() {
    pointer = null;
  }
  function onContextLost() {
    ready = false;
    syncLoop();
    onLost();
  }

  const resizeObserver = new ResizeObserver(resize);
  const intersectionObserver = new IntersectionObserver((entries) => {
    onScreen = entries.at(-1)?.isIntersecting ?? false;
    syncLoop();
  });
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerup", onPointerEnd, { passive: true });
  window.addEventListener("pointercancel", onPointerEnd, { passive: true });
  window.addEventListener("blur", onPointerLeaveWindow);
  document.documentElement.addEventListener("pointerleave", onPointerLeaveWindow);
  document.addEventListener("visibilitychange", syncLoop);
  canvas.addEventListener("webglcontextlost", onContextLost);

  stage.append(canvas);
  resizeObserver.observe(stage);
  intersectionObserver.observe(host);

  // Canvas text needs the web fonts: paint once they are in, then reveal on the first frame.
  void loadFonts(tone, text).then(() => {
    if (disposed) return;
    ready = true;
    startedAt = performance.now();
    resize();
    syncLoop();
    requestAnimationFrame(() => {
      if (!disposed) onReady();
    });
  });

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerEnd);
    window.removeEventListener("pointercancel", onPointerEnd);
    window.removeEventListener("blur", onPointerLeaveWindow);
    document.documentElement.removeEventListener("pointerleave", onPointerLeaveWindow);
    document.removeEventListener("visibilitychange", syncLoop);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    for (const geometry of [faceGeometry, bodyGeometry, shadowGeometry, edgeGeometry]) geometry?.dispose();
    for (const material of [faceMaterial, ...bodyMaterial, shadowMaterial, ...lineMaterials]) material.dispose();
    for (const texture of [uniforms.uMap.value, uniforms.uMask.value, shadowMap]) texture?.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  };
}
