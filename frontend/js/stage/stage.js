// Renderer, camera, lights, framing and pointer picking. The app adds its own objects to `stage.scene`.
const THREE = window.THREE;
const D2R = Math.PI / 180;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const DEFAULT_DIR = V(0.78, 0.34, 1).normalize();

/**
 * @param {{ canvas: HTMLCanvasElement, dock: HTMLElement, header: HTMLElement }} els
 *   `dock` and `header` are the floating panels the arm is centred around.
 */
export function createStage({ canvas, dock, header }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    throw new Error('This device could not start WebGL, which the 3D model needs.');
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 300);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.enablePan = false; controls.rotateSpeed = 0.75; controls.zoomSpeed = 0.8;

  const key = new THREE.DirectionalLight(0xffffff, 1.9);
  key.position.set(2, 12, 5); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 40 });
  key.shadow.bias = -0.0006; key.shadow.normalBias = 0.03; key.shadow.radius = 4;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xd6e4ff, 1.4); rim.position.set(-7, 3, -8); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x7d848c, 0.35));

  // ---------- render loop ----------
  let dirty = true;
  const frameCallbacks = new Set();
  const requestRender = () => { dirty = true; };
  controls.addEventListener('change', requestRender);

  function frame() {
    requestAnimationFrame(frame);
    controls.update();
    frameCallbacks.forEach(fn => fn());
    if (dirty) { renderer.render(scene, camera); dirty = false; }
  }
  frame();

  /** Runs `fn` once per animation frame. Returns a function that stops it. */
  function onFrame(fn) { frameCallbacks.add(fn); return () => frameCallbacks.delete(fn); }

  // ---------- framing: keep the arm centred in the open area between the title and the dock ----------
  const frameSize = V(0, 0, 0);

  function openRegion() {
    const w = innerWidth, h = innerHeight, top = header.getBoundingClientRect().bottom + 8, d = dock.getBoundingClientRect();
    return d.left > w * 0.4 ? { l: 0, r: d.left - 8, t: top, b: h - 12 } : { l: 0, r: w, t: top, b: d.top - 8 };
  }

  function fitDistance(region) {
    const h = innerHeight, tv = Math.tan(camera.fov * D2R / 2);
    const rw = Math.max(160, region.r - region.l), rh = Math.max(140, region.b - region.t);
    const bw = frameSize.x * 0.5 * 1.04, bh = frameSize.y * 0.5 * 1.04;
    return Math.max(bw / (tv * rw / h), bh / (tv * rh / h)) + frameSize.z * 0.25;
  }

  /** @param {boolean} resetDir true to return to the default viewing direction */
  function layout(resetDir) {
    const w = innerWidth, h = innerHeight, region = openRegion();
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.setViewOffset(w, h, Math.round(w / 2 - (region.l + region.r) / 2), Math.round(h / 2 - (region.t + region.b) / 2), w, h);
    camera.updateProjectionMatrix();
    const dir = resetDir ? DEFAULT_DIR.clone() : camera.position.clone().sub(controls.target).normalize();
    const dist = fitDistance(region);
    camera.position.copy(controls.target).addScaledVector(dir, dist);
    controls.minDistance = dist * 0.35; controls.maxDistance = dist * 2.2;
    controls.update(); requestRender();
  }

  /** Centres and sizes the view on a THREE.Box3. */
  function setFramingBox(box) {
    box.getSize(frameSize); box.getCenter(controls.target);
    key.target.position.copy(controls.target); key.position.copy(controls.target).add(V(2, 12, 5));
    camera.position.copy(DEFAULT_DIR).multiplyScalar(20);
    layout(true);
  }

  window.addEventListener('resize', () => layout(false));
  if (window.ResizeObserver) new ResizeObserver(() => layout(false)).observe(dock);

  // ---------- pointer: taps (not drags) and hover ----------
  const tapHandlers = new Set(), hoverHandlers = new Set();
  let down = null, pointers = 0;
  canvas.addEventListener('pointerdown', e => { pointers++; down = pointers === 1 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null; });
  window.addEventListener('pointerup', e => {
    pointers = Math.max(0, pointers - 1);
    if (!down || e.target !== canvas) { down = null; return; }
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t;
    down = null;
    if (moved > 7 || dt > 450) return;
    tapHandlers.forEach(fn => fn({ x: e.clientX, y: e.clientY }));
  });
  window.addEventListener('pointercancel', () => { pointers = Math.max(0, pointers - 1); down = null; });
  canvas.addEventListener('pointermove', e => {
    if (pointers === 0) hoverHandlers.forEach(fn => fn({ x: e.clientX, y: e.clientY }));
  });
  canvas.addEventListener('pointerleave', () => hoverHandlers.forEach(fn => fn(null)));

  /** @param {(p: {x: number, y: number}) => void} fn client coordinates of a tap */
  function onTap(fn) { tapHandlers.add(fn); return () => tapHandlers.delete(fn); }
  /** @param {(p: {x: number, y: number} | null) => void} fn client coordinates, or null when the pointer leaves */
  function onHover(fn) { hoverHandlers.add(fn); return () => hoverHandlers.delete(fn); }

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  /** First hit among `objects` under a client position, or null. */
  function raycast(x, y, objects) {
    const r = canvas.getBoundingClientRect();
    ndc.set((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(objects, false)[0] || null;
  }

  const scratch = V(0, 0, 0);
  /** Client coordinates of an object's world position. */
  function project(object) {
    object.getWorldPosition(scratch); scratch.project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (scratch.x * 0.5 + 0.5) * r.width, y: r.top + (-scratch.y * 0.5 + 0.5) * r.height, visible: scratch.z < 1 };
  }

  return { scene, camera, controls, canvas, requestRender, onFrame, onTap, onHover, raycast, project, setFramingBox, resetView: () => layout(true) };
}
