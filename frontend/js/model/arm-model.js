// 3D arm model: bones, muscles, skin, hand and dumbbell, built once when this module loads.
// The geometry below is the original demo's, moved here unchanged. The functions at the bottom are what the app uses.
import * as THREE from 'three';

const D2R = Math.PI / 180;
const TH_FLOOR = 0;                       // straightest pose the model can take (degrees of elbow flexion)
const TH_MIN = 20, TH_MAX = 125;          // flexion range that drives the muscle bulge
export const PHI = 35 * D2R;              // resting tilt of the whole arm, matches the original sketch

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const arm = new THREE.Group();     // canonical arm space: elbow hinge at origin, upper arm along +Y
arm.rotation.z = PHI;
arm.position.set(-0.32, -1.95, 0);
export const fore = new THREE.Group();    // everything that rides with the forearm
arm.add(fore);

// ---------- textures ----------
function stripeTexture(h, lo, hi, repeatV) {
  const c = document.createElement('canvas'); c.width = 8; c.height = h;
  const g = c.getContext('2d'); let y = 0;
  while (y < h) { const w = 1 + Math.floor(Math.random() * 3); const v = Math.floor(lo + Math.random() * (hi - lo)); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, y, 8, w); y += w; }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, repeatV);
  t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
}
function noiseTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const img = g.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) { const v = 200 + Math.random() * 55; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); return t;
}
function knurlTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#555'; g.lineWidth = 2;
  for (let i = -64; i < 128; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); g.beginPath(); g.moveTo(i, 64); g.lineTo(i + 64, 0); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 3); return t;
}
const fiberTex = stripeTexture(128, 214, 255, 3);
const boneTex = noiseTexture();

// ---------- materials ----------
const mats = {};
const TENDON = new THREE.Color('#E9E3D5');
function muscleMat(key) {
  return mats[key] || (mats[key] = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, vertexColors: true, map: fiberTex, bumpMap: fiberTex, bumpScale: 0.12, envMapIntensity: 0.55,
    roughness: 0.52, metalness: 0, clearcoat: 0.22, clearcoatRoughness: 0.45, emissive: 0x000000 }));
}
function boneMat(key) {
  return mats[key] || (mats[key] = new THREE.MeshStandardMaterial({
    color: '#E7DBC1', roughness: 0.58, metalness: 0, bumpMap: boneTex, bumpScale: 0.22, emissive: 0x000000 }));
}
const glassMat = new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Vector3(0.16, 0.18, 0.21) }, uRim: { value: 0.78 }, uBase: { value: 0.035 }, uPow: { value: 2.4 } },
  vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vV = -mv.xyz; vN = normalMatrix * normal; gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'uniform vec3 uColor; uniform float uRim, uBase, uPow; varying vec3 vN; varying vec3 vV; void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); gl_FragColor = vec4(uColor, uBase + uRim * pow(f, uPow)); }',
  transparent: true, depthWrite: false
});
const solidSkin = mats.skin = new THREE.MeshPhysicalMaterial({
  color: '#B07A5E', roughness: 0.6, metalness: 0, sheen: 0.35, sheenColor: new THREE.Color('#F2BFA6'), sheenRoughness: 0.6, envMapIntensity: 0.7,
  clearcoat: 0.05, emissive: 0x000000 });
const chrome = mats.dumbbell = new THREE.MeshStandardMaterial({ color: '#CDD2D8', metalness: 1, roughness: 0.24, emissive: 0x000000 });
const knurled = new THREE.MeshStandardMaterial({ color: '#B9BEC4', metalness: 1, roughness: 0.38, bumpMap: knurlTexture(), bumpScale: 0.6 });
const iron = new THREE.MeshStandardMaterial({ color: '#2A2824', metalness: 0.55, roughness: 0.46 });

// ---------- swept tube geometry ----------
function curveKeys(keys) {           // cubic Hermite through [t, v1, v2, ...]
  const n = keys.length, dim = keys[0].length - 1, res = new Array(dim);
  const m = keys.map((k, i) => { const a = keys[Math.max(0, i - 1)], b = keys[Math.min(n - 1, i + 1)]; const o = []; for (let d = 1; d <= dim; d++) o.push(b[0] === a[0] ? 0 : (b[d] - a[d]) / (b[0] - a[0])); return o; });
  return t => {
    if (t <= keys[0][0]) { for (let d = 0; d < dim; d++) res[d] = keys[0][d + 1]; return res; }
    if (t >= keys[n - 1][0]) { for (let d = 0; d < dim; d++) res[d] = keys[n - 1][d + 1]; return res; }
    let i = 0; while (t > keys[i + 1][0]) i++;
    const k0 = keys[i], k1 = keys[i + 1], h = k1[0] - k0[0], u = (t - k0[0]) / h, u2 = u * u, u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
    for (let d = 0; d < dim; d++) res[d] = h00 * k0[d + 1] + h10 * h * m[i][d] + h01 * k1[d + 1] + h11 * h * m[i + 1][d];
    return res;
  };
}

function gridNormals(p, n, seg, rad) {
  const R = rad + 1;
  for (let i = 0; i <= seg; i++) {
    const ip = Math.min(i + 1, seg), im = Math.max(i - 1, 0);
    let degenerate = false;
    for (let j = 0; j < rad; j++) {
      const jp = (j + 1) % rad, jm = (j - 1 + rad) % rad;
      const a = (i * R + jp) * 3, b = (i * R + jm) * 3, c = (ip * R + j) * 3, d = (im * R + j) * 3;
      const fx = p[a] - p[b], fy = p[a + 1] - p[b + 1], fz = p[a + 2] - p[b + 2];
      const tx = p[c] - p[d], ty = p[c + 1] - p[d + 1], tz = p[c + 2] - p[d + 2];
      let nx = fy * tz - fz * ty, ny = fz * tx - fx * tz, nz = fx * ty - fy * tx;
      let l = nx * nx + ny * ny + nz * nz;
      if (l < 1e-16) { degenerate = true; break; }
      l = 1 / Math.sqrt(l); const k = (i * R + j) * 3;
      n[k] = nx * l; n[k + 1] = ny * l; n[k + 2] = nz * l;
    }
    if (degenerate) {   // apex of a rounded end: point along the axis, away from the neighbouring ring
      const nb = i === 0 ? 1 : i - 1; let cx = 0, cy = 0, cz = 0;
      for (let j = 0; j < rad; j++) { const k = (nb * R + j) * 3; cx += p[k]; cy += p[k + 1]; cz += p[k + 2]; }
      const k0 = (i * R) * 3; cx = p[k0] - cx / rad; cy = p[k0 + 1] - cy / rad; cz = p[k0 + 2] - cz / rad;
      const l = 1 / (Math.hypot(cx, cy, cz) || 1);
      for (let j = 0; j < rad; j++) { const k = (i * R + j) * 3; n[k] = cx * l; n[k + 1] = cy * l; n[k + 2] = cz * l; }
    }
    const k0 = (i * R) * 3, k1 = (i * R + rad) * 3; n[k1] = n[k0]; n[k1 + 1] = n[k0 + 1]; n[k1 + 2] = n[k0 + 2];
  }
}

const _P = V(0, 0, 0), _T = V(0, 0, 0), _H = V(0, 0, 0), _B = V(0, 0, 0), _N = V(0, 0, 0);
class Sweep {
  constructor(seg, rad) {
    this.seg = seg; this.rad = rad; const R = rad + 1, nv = (seg + 1) * R;
    this.pos = new Float32Array(nv * 3); this.nor = new Float32Array(nv * 3);
    this.uv = new Float32Array(nv * 2); this.col = new Float32Array(nv * 3).fill(1);
    const idx = [];
    for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) { const a = i * R + j, b = a + R, c = b + 1, d = a + 1; idx.push(a, d, b, d, c, b); }
    const g = this.geo = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setIndex(idx);
    this.ts = new Float32Array(seg + 1);
    for (let i = 0; i <= seg; i++) { const s = i / seg; this.ts[i] = 0.4 * s + 0.6 * (0.5 - 0.5 * Math.cos(Math.PI * s)); }
    this.curve = new THREE.CatmullRomCurve3([], false, 'centripetal'); this.curve.arcLengthDivisions = 80;
    this.length = 0;
  }
  build(points, o) {
    const c = this.curve; c.points = points; c.updateArcLengths();
    const len = this.length = c.getLength(), R = this.rad + 1;
    const e0 = (o.round0 || 0) / len, e1 = (o.round1 || 0) / len;
    for (let i = 0; i <= this.seg; i++) {
      const t = this.ts[i];
      c.getPointAt(t, _P); c.getTangentAt(t, _T);
      o.hint(t, _P, _H);
      _B.copy(_H).addScaledVector(_T, -_H.dot(_T));
      if (_B.lengthSq() < 1e-8) { _B.set(0, 0, 1).addScaledVector(_T, -_T.z); if (_B.lengthSq() < 1e-8) _B.set(1, 0, 0); }
      _B.normalize(); _N.crossVectors(_B, _T).normalize();
      const r = o.radius(t); let m = 1;
      if (e0 > 0 && t < e0) { const u = 1 - t / e0; m *= Math.sqrt(Math.max(0, 1 - u * u)); }
      if (e1 > 0 && t > 1 - e1) { const u = 1 - (1 - t) / e1; m *= Math.sqrt(Math.max(0, 1 - u * u)); }
      const rn = Math.max(0.004, r[0]) * m, rb = Math.max(0.004, r[1]) * m;
      let cr = 1, cg = 1, cb = 1; if (o.color) { const cc = o.color(t); cr = cc.r; cg = cc.g; cb = cc.b; }
      for (let j = 0; j <= this.rad; j++) {
        const ph = j / this.rad * Math.PI * 2, cs = Math.cos(ph) * rn, sn = Math.sin(ph) * rb, k = i * R + j;
        this.pos[k * 3] = _P.x + _N.x * cs + _B.x * sn;
        this.pos[k * 3 + 1] = _P.y + _N.y * cs + _B.y * sn;
        this.pos[k * 3 + 2] = _P.z + _N.z * cs + _B.z * sn;
        this.uv[k * 2] = t * len * 0.5; this.uv[k * 2 + 1] = j / this.rad;
        this.col[k * 3] = cr; this.col[k * 3 + 1] = cg; this.col[k * 3 + 2] = cb;
      }
    }
    gridNormals(this.pos, this.nor, this.seg, this.rad);
    const a = this.geo.attributes;
    a.position.needsUpdate = a.normal.needsUpdate = a.uv.needsUpdate = a.color.needsUpdate = true;
    this.geo.boundingSphere = null;
  }
}

// ---------- pose state ----------
let TH = 0, K = 0;                       // flexion (radians) and contraction 0..1
const hintVec = (x, y, z) => (t, P, o) => o.set(x, y, z);
function hintBlend(hx, hz, t0, t1) {     // a local direction that turns with the forearm along the muscle
  const l = Math.hypot(hx, hz); hx /= l; hz /= l;
  return (t, P, o) => { const b = TH * ss(t0, t1, t); o.set(hx * Math.cos(b), hx * Math.sin(b), hz); };
}
function evalPts(spec, out) {
  const raw = spec.pts(K), c = Math.cos(TH), s = Math.sin(TH);
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    if (r[0] === 'u') out[i].set(r[1], r[2], r[3]);
    else if (r[0] === 'f') { const x = r[1], y = -r[2]; out[i].set(x * c - y * s, x * s + y * c, r[3]); }
    else if (r[0] === 's') { // soft tissue near the elbow follows the skin's blended bend rather than the bone
      const b = TH * (1 - ss(-0.75, 0.75, -r[2])), cb = Math.cos(b), sb = Math.sin(b), x = r[1], y = -r[2];
      out[i].set(x * cb - y * sb, x * sb + y * cb, r[3]);
    }
  }
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i]; if (r[0] !== 'w') continue;
    const p = out[i]; p.addVectors(out[i - 1], out[i + 1]).multiplyScalar(0.5);
    const d = Math.hypot(p.x, p.y); if (d < r[1] && d > 1e-6) { p.x *= r[1] / d; p.y *= r[1] / d; }
  }
  return out;
}

const pickables = [];
const dynamic = [];
const layerOf = { muscle: [], bone: [], skin: [], path: [], gear: [] };
function register(mesh, part, layer) {
  mesh.userData.part = part; mesh.userData.layer = layer; mesh.receiveShadow = layer !== 'path';
  layerOf[layer].push(mesh); if (layer !== 'path') pickables.push(mesh);
  return mesh;
}

// ---------- muscles ----------
const MUSCLES = [
  { key: 'biceps', belly: '#A6332B', seg: 72, rad: 26, hint: [1, 0, 0.78, 1], bulge: [0.3, 0.8, 0.16, 0.42],
    pts: k => [['u', 0.06, 3.2, -0.12], ['u', 0.17, 2.74, -0.05], ['u', 0.27 + 0.03 * k, 2.15, -0.01], ['u', 0.31 + 0.1 * k, 1.45 + 0.1 * k, 0], ['u', 0.28 + 0.07 * k, 0.88 + 0.16 * k, 0.01], ['u', 0.22, 0.48, 0.03], ['w', 0.27], ['f', 0.09, 0.42, 0.07]],
    radius: [[0, 0.03, 0.03], [0.12, 0.05, 0.045], [0.28, 0.15, 0.12], [0.48, 0.23, 0.19], [0.66, 0.19, 0.16], [0.8, 0.09, 0.07], [0.88, 0.045, 0.035], [1, 0.04, 0.03]],
    tendon: [[0, 1], [0.13, 1], [0.24, 0], [0.77, 0], [0.86, 1], [1, 1]] },
  { key: 'brachialis', belly: '#8F2822', hint: [1, 0, 0.7, 1],
    pts: () => [['u', 0.1, 1.65, 0.06], ['u', 0.18, 1.1, 0.04], ['u', 0.2, 0.55, 0.0], ['w', 0.2], ['f', 0.08, 0.22, -0.06]],
    radius: [[0, 0.05, 0.03], [0.25, 0.16, 0.075], [0.5, 0.22, 0.1], [0.75, 0.16, 0.085], [1, 0.06, 0.04]],
    tendon: [[0, 0.3], [0.1, 0], [0.84, 0], [1, 1]] },
  { key: 'tricepsLong', belly: '#9C2D26', hint: [-1, 0, 0.8, 1], thin: 0.1,
    pts: () => [['u', -0.12, 3.02, -0.2], ['u', -0.27, 2.45, -0.12], ['u', -0.33, 1.6, -0.07], ['u', -0.29, 0.85, -0.03], ['u', -0.22, 0.45, 0.0], ['w', 0.22], ['f', -0.15, -0.24, 0.0]],
    radius: [[0, 0.04, 0.03], [0.12, 0.09, 0.07], [0.35, 0.15, 0.15], [0.6, 0.15, 0.15], [0.78, 0.13, 0.09], [0.9, 0.12, 0.045], [1, 0.08, 0.035]],
    tendon: [[0, 1], [0.08, 1], [0.16, 0], [0.72, 0], [0.84, 1], [1, 1]] },
  { key: 'tricepsLat', belly: '#A3302A', hint: [-1, 0.25, 0.8, 1], thin: 0.1,
    pts: () => [['u', -0.1, 2.55, 0.12], ['u', -0.28, 1.95, 0.17], ['u', -0.3, 1.2, 0.15], ['u', -0.24, 0.6, 0.07], ['w', 0.22], ['f', -0.15, -0.24, 0.03]],
    radius: [[0, 0.05, 0.03], [0.2, 0.13, 0.1], [0.45, 0.14, 0.12], [0.7, 0.11, 0.08], [0.86, 0.1, 0.04], [1, 0.07, 0.03]],
    tendon: [[0, 0.2], [0.1, 0], [0.74, 0], [0.86, 1], [1, 1]] },
  { key: 'brachioradialis', belly: '#A9372E', hint: [0.5, 0.85, 0.25, 0.5],
    pts: () => [['u', 0.0, 1.0, 0.2], ['u', 0.05, 0.55, 0.28], ['w', 0.22], ['s', 0.1, 0.45, 0.27], ['f', 0.13, 1.2, 0.26], ['f', 0.07, 1.9, 0.24], ['f', 0.02, 2.42, 0.22]],
    radius: [[0, 0.04, 0.025], [0.25, 0.1, 0.075], [0.42, 0.11, 0.08], [0.6, 0.08, 0.06], [0.72, 0.04, 0.025], [1, 0.03, 0.018]],
    tendon: [[0, 0.3], [0.08, 0], [0.62, 0], [0.74, 1], [1, 1]] },
  { key: 'fcr', belly: '#A4332B', hint: [1, -0.2, 0, 0.2],
    pts: () => [['u', 0.02, 0.1, -0.3], ['s', 0.18, 0.55, -0.12], ['f', 0.2, 1.2, -0.04], ['f', 0.12, 1.8, 0.02], ['f', 0.1, 2.45, 0.05]] },
  { key: 'fds', belly: '#972C25', hint: [0.8, -0.6, 0, 0.2],
    pts: () => [['u', 0.0, 0.06, -0.32], ['s', 0.12, 0.55, -0.2], ['f', 0.16, 1.3, -0.12], ['f', 0.12, 2.0, -0.08], ['f', 0.1, 2.45, -0.05]] },
  { key: 'fcu', belly: '#A0312A', hint: [0.1, -1, 0, 0.2],
    pts: () => [['u', -0.04, 0.05, -0.36], ['s', 0.0, 0.5, -0.29], ['f', 0.02, 1.3, -0.24], ['f', 0.02, 2.0, -0.2], ['f', 0.02, 2.45, -0.17]] },
  { key: 'ecrl', belly: '#9E2F28', hint: [0.1, 1, 0, 0.2],
    pts: () => [['u', -0.05, 0.5, 0.26], ['s', -0.07, 0.45, 0.29], ['f', -0.02, 1.2, 0.28], ['f', -0.06, 1.9, 0.23], ['f', -0.08, 2.45, 0.18]] },
  { key: 'edc', belly: '#932A24', hint: [-1, 0.4, 0, 0.2],
    pts: () => [['u', -0.04, 0.08, 0.26], ['s', -0.18, 0.55, 0.2], ['f', -0.2, 1.3, 0.1], ['f', -0.16, 2.0, 0.04], ['f', -0.12, 2.45, 0.0]] },
  { key: 'ecu', belly: '#9A2E27', hint: [-0.8, -0.6, 0, 0.2],
    pts: () => [['u', -0.06, 0.06, 0.24], ['s', -0.22, 0.5, 0.02], ['f', -0.18, 1.3, -0.12], ['f', -0.12, 2.0, -0.16], ['f', -0.08, 2.45, -0.18]] },
  { key: 'pronator', belly: '#AC392F', hint: [1, 0, 0, 0.25],
    pts: () => [['u', 0.04, 0.2, -0.3], ['s', 0.19, 0.45, -0.14], ['f', 0.21, 0.85, 0.06], ['f', 0.12, 1.2, 0.2]],
    radius: [[0, 0.05, 0.04], [0.3, 0.09, 0.07], [0.7, 0.08, 0.06], [1, 0.05, 0.03]],
    tendon: [[0, 0.4], [0.12, 0], [0.82, 0], [1, 0.8]] }
];
const FOREARM_RADIUS = [[0, 0.04, 0.03], [0.15, 0.09, 0.07], [0.35, 0.1, 0.08], [0.55, 0.07, 0.05], [0.68, 0.035, 0.022], [1, 0.025, 0.016]];
const FOREARM_TENDON = [[0, 0.6], [0.08, 0], [0.55, 0], [0.68, 1], [1, 1]];

function makeMuscle(def, parent) {
  const sw = new Sweep(def.seg || 56, def.rad || 20);
  const mesh = register(new THREE.Mesh(sw.geo, muscleMat(def.key)), def.key, 'muscle');
  mesh.castShadow = true; mesh.frustumCulled = false; parent.add(mesh);
  const rf = curveKeys(def.radius || FOREARM_RADIUS), tf = curveKeys(def.tendon || FOREARM_TENDON);
  const belly = new THREE.Color(def.belly), col = new THREE.Color(), r2 = [0, 0];
  const hint = def.hintFn || hintBlend(...def.hint);
  const opts = {
    round0: def.round0 ?? 0.03, round1: def.round1 ?? 0.03, hint,
    radius: t => {
      const r = rf(t); let gw = 1, gt = 1;
      if (def.bulge) { const [a, b, wg, tg] = def.bulge; const m = ss(a, a + 0.14, t) * (1 - ss(b - 0.14, b, t)); gw += wg * K * m; gt += tg * K * m; }
      if (def.thin) { gw *= 1 - def.thin * K; gt *= 1 - def.thin * K; }
      r2[0] = r[0] * gw; r2[1] = r[1] * gt; return r2;
    },
    color: t => col.copy(belly).lerp(TENDON, Math.min(1, Math.max(0, tf(t)[0])))
  };
  const out = def.pts(0).map(() => V(0, 0, 0));
  const m = { def, sw, mesh, rest: 0, build() { sw.build(def.ptsFixed || evalPts(def, out), opts); } };
  return m;
}
const muscleObjs = {};
MUSCLES.forEach(d => { const m = makeMuscle(d, arm); muscleObjs[d.key] = m; dynamic.push(m); });

// deltoid: seven fibre bundles fanned over the humeral head, all converging on the deltoid tuberosity
const HC = V(-0.03, 2.95, -0.1);
for (let i = 0; i < 7; i++) {
  const a = (-30 + i * 40) * D2R, c = Math.cos(a), s = Math.sin(a);
  const a2 = a + (Math.PI / 2 - a) * 0.5, c2 = Math.cos(a2), s2 = Math.sin(a2);
  const pts = [V(HC.x + 0.25 * c, 3.29, HC.z + 0.25 * s), V(HC.x + 0.39 * c, 3.1, HC.z + 0.39 * s), V(HC.x + 0.42 * c, 2.8, HC.z + 0.42 * s + 0.03), V(0.3 * c2, 2.25, 0.3 * s2 + 0.02), V(0.06, 1.62, 0.16)];
  const d = { key: 'deltoid', belly: i % 2 ? '#A3302A' : '#9B2C26', seg: 40, rad: 16, round0: 0.05, round1: 0.03, ptsFixed: pts, pts: () => pts,
    hintFn: (t, P, o) => o.set(P.x - HC.x, Math.max(0, P.y - 3.0) * 1.6, P.z - HC.z),
    radius: [[0, 0.07, 0.03], [0.2, 0.13, 0.07], [0.45, 0.14, 0.085], [0.75, 0.085, 0.06], [1, 0.03, 0.025]],
    tendon: [[0, 0.7], [0.12, 0], [0.85, 0], [1, 0.9]] };
  makeMuscle(d, arm).build();
}

// ---------- bones ----------
function staticTube(points, radiusKeys, opts, mat, part, layer, parent, seg = 40, rad = 16) {
  const sw = new Sweep(seg, rad); const rf = curveKeys(radiusKeys);
  sw.build(points, { round0: opts.round0 ?? 0.05, round1: opts.round1 ?? 0.05, hint: opts.hint || hintVec(0, 0, 1), radius: t => rf(t), color: opts.color });
  const mesh = register(new THREE.Mesh(sw.geo, mat), part, layer);
  mesh.castShadow = layer !== 'skin'; parent.add(mesh); sw.geo.computeBoundingSphere(); return mesh;
}
function blob(pos, r, scale, mat, part, layer, parent) {
  const m = register(new THREE.Mesh(new THREE.SphereGeometry(r, 28, 20), mat), part, layer);
  m.position.copy(pos); if (scale) m.scale.set(...scale); m.castShadow = true; parent.add(m); return m;
}
const hum = boneMat('humerus'), uln = boneMat('ulna'), rad_ = boneMat('radius'), hand = boneMat('hand'), scap = boneMat('scapula');

staticTube([V(0, 2.8, -0.07), V(0.02, 2.3, -0.03), V(0.01, 1.5, 0), V(-0.01, 0.6, 0), V(-0.02, 0.14, 0)],
  [[0, 0.16, 0.17], [0.12, 0.12, 0.12], [0.4, 0.095, 0.095], [0.7, 0.09, 0.1], [0.85, 0.1, 0.17], [0.95, 0.09, 0.27], [1, 0.08, 0.25]],
  { round0: 0.1, round1: 0.07 }, hum, 'humerus', 'bone', arm, 48, 18);
blob(HC, 0.28, null, hum, 'humerus', 'bone', arm);
blob(V(0.06, 2.92, 0.15), 0.13, null, hum, 'humerus', 'bone', arm);
blob(V(0.19, 2.86, -0.06), 0.075, null, hum, 'humerus', 'bone', arm);
blob(V(-0.02, 0.07, -0.33), 0.085, [1, 0.9, 1], hum, 'humerus', 'bone', arm);
blob(V(-0.01, 0.08, 0.27), 0.06, null, hum, 'humerus', 'bone', arm);
{ // trochlea + capitulum: the spool the ulna hinges on
  const prof = [[0.0, -0.28], [0.1, -0.28], [0.14, -0.24], [0.13, -0.18], [0.105, -0.13], [0.125, -0.06], [0.12, -0.02], [0.1, 0.01], [0.115, 0.05], [0.12, 0.11], [0.1, 0.18], [0.05, 0.22], [0.0, 0.225]].map(p => new THREE.Vector2(p[0], p[1]));
  const g = new THREE.LatheGeometry(prof, 40); g.rotateX(Math.PI / 2);
  const m = register(new THREE.Mesh(g, hum), 'humerus', 'bone'); m.castShadow = true; arm.add(m);
}
staticTube([V(-0.34, 3.3, -0.2), V(-0.22, 3.37, 0.04), V(0.0, 3.37, 0.15), V(0.15, 3.32, 0.11)], [[0, 0.06, 0.03], [0.5, 0.08, 0.035], [1, 0.06, 0.03]],
  { hint: hintVec(0, 1, 0), round0: 0.05, round1: 0.05 }, scap, 'scapula', 'bone', arm, 24, 12);
staticTube([V(-0.03, 2.96, -0.36), V(-0.04, 2.95, -0.46), V(-0.06, 2.92, -0.54)], [[0, 0.15, 0.17], [0.5, 0.1, 0.11], [1, 0.08, 0.09]],
  { hint: hintVec(0, 1, 0), round0: 0.0, round1: 0.06 }, scap, 'scapula', 'bone', arm, 16, 20);

// forearm bones, built in the forearm's rest frame (forearm hanging along -Y, palm facing +X)
staticTube([V(-0.17, 0.26, -0.1), V(-0.2, 0.1, -0.12), V(-0.16, -0.1, -0.13), V(-0.07, -0.42, -0.14), V(-0.04, -1.3, -0.15), V(-0.03, -2.25, -0.17), V(-0.03, -2.45, -0.18)],
  [[0, 0.09, 0.09], [0.1, 0.11, 0.1], [0.2, 0.09, 0.09], [0.35, 0.065, 0.065], [0.7, 0.045, 0.045], [0.92, 0.05, 0.055], [1, 0.06, 0.06]],
  { round0: 0.08, round1: 0.05 }, uln, 'ulna', 'bone', fore, 52, 16);
blob(V(0.08, -0.1, -0.12), 0.065, [1, 0.8, 1.2], uln, 'ulna', 'bone', fore);
staticTube([V(0.02, -0.11, 0.12), V(0.03, -0.18, 0.12), V(0.04, -0.4, 0.13), V(0.07, -1.2, 0.17), V(0.04, -2.2, 0.19), V(0.02, -2.46, 0.2)],
  [[0, 0.1, 0.1], [0.04, 0.1, 0.1], [0.07, 0.06, 0.06], [0.2, 0.055, 0.055], [0.6, 0.055, 0.06], [0.88, 0.075, 0.09], [1, 0.075, 0.095]],
  { round0: 0.03, round1: 0.05 }, rad_, 'radius', 'bone', fore, 52, 16);
blob(V(0.09, -0.4, 0.08), 0.045, null, rad_, 'radius', 'bone', fore);

// ---------- hand ----------
const HAND_H = V(0.30, -3.0, 0);          // dumbbell handle centre in forearm rest frame
const RF = 0.175;                          // finger wrap radius around the handle
const FINGERS = [ { z: 0.27, end: 85, r: 0.08, knuck: -3.31 }, { z: 0.09, end: 96, r: 0.084, knuck: -3.35 },
                  { z: -0.09, end: 90, r: 0.08, knuck: -3.33 }, { z: -0.26, end: 72, r: 0.066, knuck: -3.27 } ];
const fingerCurves = FINGERS.map(f => {
  const pts = [V(-0.02, f.knuck + 0.14, f.z * 0.95)];
  const angs = [-125, -95, -60, -20, 20, 60, f.end];
  angs.forEach((a, i) => { const r = i === 0 ? 0.4 : i === 1 ? 0.25 : RF; pts.push(V(HAND_H.x + r * Math.cos(a * D2R), HAND_H.y + r * Math.sin(a * D2R), f.z)); });
  pts[1].y = f.knuck; pts[1].x = 0.05;
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
});
const thumbCurve = new THREE.CatmullRomCurve3([V(0.06, -2.6, 0.22), V(0.22, -2.73, 0.34), V(0.44, -2.77, 0.37), V(0.6, -2.88, 0.28), V(0.63, -3.03, 0.18)], false, 'centripetal');
const samplePts = (curve, t0, t1, n = 4) => Array.from({ length: n }, (_, i) => curve.getPointAt(t0 + (t1 - t0) * i / (n - 1)));

// hand bones
[[-0.2, -2.55], [-0.07, -2.53], [0.06, -2.54], [0.18, -2.57], [-0.2, -2.68], [-0.06, -2.69], [0.08, -2.68], [0.2, -2.66]].forEach(([z, y], i) =>
  blob(V(0.02 + (i % 2) * 0.02, y, z), 0.058, [0.9, 0.8, 1], hand, 'hand', 'bone', fore));
FINGERS.forEach((f, i) => {
  staticTube([V(0.0, -2.72, f.z * 0.72), V(0.0, -3.0, f.z * 0.9), V(0.0, f.knuck + 0.03, f.z)], [[0, 0.045, 0.045], [0.25, 0.03, 0.03], [0.8, 0.03, 0.03], [1, 0.045, 0.045]], { round0: 0.04, round1: 0.04 }, hand, 'hand', 'bone', fore, 16, 10);
  const c = fingerCurves[i];
  [[0.1, 0.4], [0.43, 0.7], [0.73, 0.94]].forEach(([a, b], j) =>
    staticTube(samplePts(c, a, b), [[0, 0.04, 0.04], [0.3, 0.028, 0.028], [0.7, 0.028, 0.028], [1, j === 2 ? 0.03 : 0.04, j === 2 ? 0.03 : 0.04]], { round0: 0.035, round1: 0.03 }, hand, 'hand', 'bone', fore, 14, 10));
});
[[0.0, 0.36], [0.4, 0.7], [0.73, 0.95]].forEach(([a, b]) =>
  staticTube(samplePts(thumbCurve, a, b), [[0, 0.042, 0.042], [0.3, 0.03, 0.03], [0.7, 0.03, 0.03], [1, 0.04, 0.04]], { round0: 0.035, round1: 0.03 }, hand, 'hand', 'bone', fore, 14, 10));

// hand muscles
function staticMuscle(key, belly, pts, radius, tendon, parent, hint) {
  const d = { key, belly, seg: 28, rad: 16, round0: 0.06, round1: 0.06, ptsFixed: pts, pts: () => pts, hintFn: hint || hintVec(0, 0, 1), radius, tendon };
  makeMuscle(d, parent).build();
}
staticMuscle('thenar', '#A4342C', [V(0.05, -2.56, 0.14), V(0.13, -2.68, 0.23), V(0.2, -2.77, 0.28)], [[0, 0.06, 0.06], [0.5, 0.09, 0.075], [1, 0.05, 0.045]], [[0, 0], [1, 0]], fore, hintVec(1, 0, 0));
staticMuscle('hypothenar', '#9D2F28', [V(0.05, -2.62, -0.2), V(0.08, -2.86, -0.28), V(0.05, -3.15, -0.3)], [[0, 0.06, 0.06], [0.5, 0.08, 0.07], [1, 0.05, 0.05]], [[0, 0], [1, 0]], fore, hintVec(1, 0, 0));

// hand skin (fingers and thumb); the palm is part of the main skin tube
const skinMeshes = [];
FINGERS.forEach((f, i) => skinMeshes.push(staticTube(samplePts(fingerCurves[i], 0, 1, 9), [[0, f.r + 0.01, f.r + 0.01], [0.4, f.r, f.r], [1, f.r - 0.015, f.r - 0.015]], { round0: 0, round1: f.r - 0.01 }, glassMat, 'skin', 'skin', fore, 40, 16)));
skinMeshes.push(staticTube(samplePts(thumbCurve, 0, 1, 7), [[0, 0.13, 0.12], [0.3, 0.1, 0.09], [0.6, 0.085, 0.085], [1, 0.07, 0.07]], { round0: 0, round1: 0.065 }, glassMat, 'skin', 'skin', fore, 40, 16));

// ---------- dumbbell ----------
{
  const db = new THREE.Group(); db.position.copy(HAND_H); fore.add(db);
  const add = (geo, mat, z) => { const m = register(new THREE.Mesh(geo, mat), 'dumbbell', 'gear'); m.position.z = z || 0; m.castShadow = true; db.add(m); return m; };
  const cyl = (r, l, seg = 40) => { const g = new THREE.CylinderGeometry(r, r, l, seg); g.rotateX(Math.PI / 2); return g; };
  add(cyl(0.1, 1.0), knurled);
  const plate = s => {
    const p = [[0.065, -0.06], [0.16, -0.06], [0.175, -0.045], [0.42, -0.04], [0.45, -0.056], [0.49, -0.05], [0.5, -0.03], [0.5, 0.03], [0.49, 0.05], [0.45, 0.056], [0.42, 0.04], [0.175, 0.045], [0.16, 0.06], [0.065, 0.06], [0.065, -0.06]]
      .map(q => new THREE.Vector2(q[0] * s, q[1]));
    const g = new THREE.LatheGeometry(p, 72); g.rotateX(Math.PI / 2); return g;
  };
  for (const sgn of [-1, 1]) {
    add(cyl(0.125, 0.06), chrome, sgn * 0.53);
    add(cyl(0.075, 0.42), chrome, sgn * 0.72);
    add(plate(1), iron, sgn * 0.63);
    add(plate(0.8), iron, sgn * 0.76);
    add(cyl(0.11, 0.05), chrome, sgn * 0.86);
  }
}

// forearm twist group: radius, hand, fingers, thumb and dumbbell turn about the forearm axis
const wristG = new THREE.Group(); fore.add(wristG);
[...layerOf.bone.filter(m => m.userData.part === 'radius' || m.userData.part === 'hand'),
  ...layerOf.muscle.filter(m => m.userData.part === 'thenar' || m.userData.part === 'hypothenar'),
  ...skinMeshes.filter(m => m.parent === fore),
  layerOf.gear[0].parent].forEach(o => wristG.add(o));

// ---------- curl path arrow ----------
const pathMat = new THREE.MeshBasicMaterial({ color: '#ADA79D', transparent: true, opacity: 0.9, toneMapped: false });
{
  const R = 3.74, a0 = -58, a1 = 36, step = 8, dash = 5;
  for (let a = a0; a < a1 - 2; a += step) {
    const b = Math.min(a + dash, a1 - 2);
    const pts = samplePts(new THREE.CatmullRomCurve3([0, 0.5, 1].map(u => { const t = (a + (b - a) * u) * D2R; return V(R * Math.cos(t), R * Math.sin(t), 0); })), 0, 1, 3);
    const m = register(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 6, 0.024, 8), pathMat), 'path', 'path'); arm.add(m);
  }
  const t = a1 * D2R, cone = register(new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.26, 18), pathMat), 'path', 'path');
  cone.position.set(R * Math.cos(t), R * Math.sin(t), 0); cone.rotation.z = t; arm.add(cone);
}

// plumb line shown with the calibration pose: the arm should hang along it
const plumb = new THREE.Group();
for (let y = 2.0; y > -5.2; y -= 0.5) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 8), pathMat); m.position.set(arm.position.x, y, 0); plumb.add(m);
}
{ const tip = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.26, 18), pathMat); tip.position.set(arm.position.x, -5.5, 0); tip.rotation.z = Math.PI; plumb.add(tip); }
plumb.visible = false;

// ---------- skin tube (shoulder dome to knuckles), bent around the elbow ----------
const SKIN_KEYS = curveKeys([
  [-3.38, 0.0, 0.0, 0.18, 0.43], [-2.9, 0.0, 0.0, 0.195, 0.42], [-2.55, 0.0, 0.0, 0.195, 0.34], [-2.35, 0.0, 0.0, 0.2, 0.31],
  [-1.7, 0.01, 0.01, 0.28, 0.36], [-1.0, 0.01, 0.0, 0.36, 0.42], [-0.4, 0.0, 0.0, 0.41, 0.46], [0.0, -0.05, -0.02, 0.4, 0.48],
  [0.3, -0.03, 0.0, 0.43, 0.46], [0.8, 0.0, 0.0, 0.48, 0.44], [1.4, 0.0, 0.0, 0.5, 0.45], [2.0, 0.0, 0.0, 0.53, 0.5],
  [2.55, -0.02, -0.02, 0.57, 0.58], [3.0, -0.03, -0.05, 0.62, 0.63] ]);
const SKIN_TOP = 3.64, SKIN_BOT = -3.38;
const skinSweep = new Sweep(150, 48);
const skinMesh = register(new THREE.Mesh(skinSweep.geo, glassMat), 'skin', 'skin');
skinMesh.frustumCulled = false; arm.add(skinMesh); skinMeshes.push(skinMesh);
const gauss = (x, x0, s) => Math.exp(-0.5 * ((x - x0) / s) ** 2);
const angGauss = (p, p0, s) => { const d = Math.atan2(Math.sin(p - p0), Math.cos(p - p0)); return Math.exp(-0.5 * (d / s) ** 2); };
function skinBump(y, ph) {
  return gauss(y, 1.4 + 0.1 * K, 0.55) * angGauss(ph, 0, 0.85) * (0.05 + 0.17 * K)
    + gauss(y, 1.75, 0.6) * angGauss(ph, Math.PI, 0.9) * 0.05
    + gauss(y, 2.5, 0.35) * angGauss(ph, Math.PI / 2, 1.0) * 0.04
    + gauss(y, 0.18, 0.13) * angGauss(ph, Math.PI, 0.45) * 0.035
    + gauss(y, -0.5, 0.4) * angGauss(ph, 0.75, 0.7) * 0.05
    + gauss(y, 0.05, 0.12) * angGauss(ph, -Math.PI / 2, 0.5) * 0.035;
}
function buildSkin() {
  const sw = skinSweep, R = sw.rad + 1, p = sw.pos;
  for (let i = 0; i <= sw.seg; i++) {
    const y = SKIN_TOP - sw.ts[i] * (SKIN_TOP - SKIN_BOT);
    const k = SKIN_KEYS(y); const cx = k[0], cz = k[1], rx = k[2], rz = k[3];
    let m = 1;
    if (y > 3.0) { const u = (y - 3.0) / (SKIN_TOP - 3.0); m = Math.sqrt(Math.max(0, 1 - u * u)); }
    if (y < -3.2) { const u = (-3.2 - y) / (-3.2 - SKIN_BOT); m = Math.sqrt(Math.max(0, 1 - u * u)); }
    const w = 1 - ss(-0.75, 0.75, y), b = TH * w, cb = Math.cos(b), sb = Math.sin(b);
    for (let j = 0; j <= sw.rad; j++) {
      const ph = j / sw.rad * Math.PI * 2, bump = skinBump(y, ph);
      const x = cx + Math.cos(ph) * (rx + bump) * m, z = cz + Math.sin(ph) * (rz + bump) * m, idx = (i * R + j) * 3;
      p[idx] = x * cb - y * sb; p[idx + 1] = x * sb + y * cb; p[idx + 2] = z;
    }
  }
  gridNormals(p, sw.nor, sw.seg, sw.rad);
  sw.geo.attributes.position.needsUpdate = sw.geo.attributes.normal.needsUpdate = true;
  sw.geo.boundingSphere = null;
}

// ---------- pose ----------
let thetaDeg = -1;
function setPose(deg) {
  deg = Math.min(TH_MAX, Math.max(TH_FLOOR, deg));
  if (Math.abs(deg - thetaDeg) < 0.02) return false;
  thetaDeg = deg; TH = deg * D2R; K = ss(0, 1, (deg - TH_MIN) / (TH_MAX - TH_MIN));
  fore.rotation.z = TH;
  dynamic.forEach(m => m.build());
  buildSkin();
  return true;
}
// resting lengths with the arm straight
TH = 0; K = 0; dynamic.forEach(m => { m.build(); m.rest = m.sw.length; });

// ---------- app API ----------
export { plumb, skinMesh, wristG };

/** Sets the elbow flexion in degrees. Returns true if the pose changed. */
export const setElbow = deg => setPose(deg);
export const getElbow = () => thetaDeg;

/** Rotates the hand and radius about the forearm axis. Positive turns the palm the way `twistSign` allows. */
export function setTwist(deg) {
  wristG.rotation.y = -deg * D2R;   // the forearm axis points toward the wrist, which is -Y in the model
}

let skinMode = 'glass', pathOn = true, calibView = false;
const layerOn = { muscles: true, bones: true };

function applyLayers() {
  const inside = skinMode !== 'solid';   // opaque skin hides what is under it
  layerOf.muscle.forEach(m => { m.visible = layerOn.muscles && inside; });
  layerOf.bone.forEach(m => { m.visible = layerOn.bones && inside; });
  layerOf.gear.forEach(m => { m.visible = !calibView; });
  layerOf.path.forEach(m => { m.visible = pathOn && !calibView; });
  skinMeshes.forEach(m => {
    m.visible = skinMode !== 'off';
    m.material = skinMode === 'solid' ? solidSkin : glassMat;
    m.castShadow = skinMode === 'solid';
    m.renderOrder = skinMode === 'glass' ? 2 : 0;
  });
}

/** @param {'glass'|'solid'|'off'} mode */
export function setSkinMode(mode) { skinMode = mode; applyLayers(); }
/** @param {'muscles'|'bones'} name */
export function setLayerOn(name, on) { layerOn[name] = on; applyLayers(); }

/** Straight, vertical arm without the dumbbell, hanging beside a plumb line. */
export function setCalibrationView(on) {
  calibView = on;
  arm.rotation.z = on ? 0 : PHI;
  plumb.visible = on;
  if (on) { setPose(0); setTwist(0); }
  applyLayers();
}

/** Re-reads the page's CSS colours for the glass skin and the path arrow. */
export function applyTheme() {
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const rim = new THREE.Color(css('--rim')).convertLinearToSRGB();
  glassMat.uniforms.uColor.value.set(rim.r, rim.g, rim.b);
  pathMat.color.set(css('--path'));
}

/** Bounding box of the arm over its whole range of motion plus the calibration pose, for camera framing. */
export function computeFramingBox() {
  const box = new THREE.Box3();
  const savedTilt = arm.rotation.z, savedDeg = thetaDeg;
  const grow = objects => objects.forEach(m => { m.geometry.computeBoundingBox(); box.expandByObject(m); });
  for (const deg of [30, 88, TH_MAX]) {
    setPose(deg); arm.updateMatrixWorld(true);
    grow([skinMesh, ...layerOf.gear, ...layerOf.path]);
  }
  arm.rotation.z = 0; setPose(0); arm.updateMatrixWorld(true);
  grow([skinMesh]);
  arm.rotation.z = savedTilt; setPose(savedDeg < 0 ? 0 : savedDeg); arm.updateMatrixWorld(true);
  return box;
}

applyLayers();
setPose(0);
