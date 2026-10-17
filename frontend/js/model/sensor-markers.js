// Clickable sensor spots on the 3D arm. Hidden until a page shows them.
import { arm, fore } from './arm-model.js';

const THREE = window.THREE;

export const MARKER_IDS = ['upper', 'forearm', 'wrist'];

// Placed on the +Z side of the skin so they face the default camera. Real mounting is described in the page text.
const SPOTS = {
  upper: { parent: arm, position: [0.02, 1.5, 0.52] },
  forearm: { parent: fore, position: [0.0, -1.3, 0.47] },
  wrist: { parent: fore, position: [0.0, -2.45, 0.37] },
};

const IDLE = new THREE.Color('#8A929C');
const SELECTED = new THREE.Color('#B0342A');
const HOVER = new THREE.Color('#5A4A3E');

const markers = {};
for (const id of MARKER_IDS) {
  const { parent, position } = SPOTS[id];
  const material = new THREE.MeshStandardMaterial({ color: IDLE, roughness: 0.4, metalness: 0.3, emissive: 0x000000 });
  const puck = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.07, 32).rotateX(Math.PI / 2), material);
  puck.position.set(...position);
  puck.visible = false;
  // Larger invisible sphere so the spot is easy to hit.
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
  hit.userData.markerId = id;
  puck.add(hit);
  parent.add(puck);
  markers[id] = { puck, hit, material };
}

/** Shows exactly these markers. */
export function setMarkersVisible(ids) {
  for (const id of MARKER_IDS) markers[id].puck.visible = ids.includes(id);
}

/** @param {'idle'|'hover'|'selected'} state */
export function setMarkerState(id, state) {
  const m = markers[id].material;
  m.color.copy(state === 'selected' ? new THREE.Color('#E7E2DA') : IDLE);
  m.emissive.copy(state === 'selected' ? SELECTED : state === 'hover' ? HOVER : new THREE.Color(0x000000));
  m.emissiveIntensity = state === 'selected' ? 0.9 : 1;
}

/** Hit targets for the markers that are currently visible. */
export const pickTargets = () => MARKER_IDS.filter(id => markers[id].puck.visible).map(id => markers[id].hit);
export const markerIdOf = hit => hit.object.userData.markerId;
/** Object whose world position anchors a label for this marker. */
export const markerAnchor = id => markers[id].puck;
