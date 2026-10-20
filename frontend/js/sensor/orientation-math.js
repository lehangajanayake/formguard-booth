// Quaternion helpers shared by the estimators. Board quaternions are {w,x,y,z}, body-to-world, with world +Z up.
import * as THREE from 'three';
export const D2R = Math.PI / 180;

export const AXES = { '+x': [1, 0, 0], '-x': [-1, 0, 0], '+y': [0, 1, 0], '-y': [0, -1, 0], '+z': [0, 0, 1], '-z': [0, 0, -1] };

/** Gravity-up direction in the board frame. */
export function upInBody({ w, x, y, z }) {
  const u = [2 * (x * z - w * y), 2 * (w * x + y * z), 1 - 2 * (x * x + y * y)];
  const l = Math.hypot(...u) || 1;
  return u.map(v => v / l);
}

/** Mean gravity-up direction in the board frame over a set of samples. */
export function meanUp(samples) {
  const sum = [0, 0, 0];
  samples.forEach(q => upInBody(q).forEach((v, i) => { sum[i] += v; }));
  const len = Math.hypot(...sum) || 1;
  return sum.map(v => v / len);
}

/** The board axis pointing most nearly straight down, or null when no axis is within ~37° of vertical. */
export function downAxis(up) {
  const k = up.map(Math.abs).indexOf(Math.max(...up.map(Math.abs)));
  if (Math.abs(up[k]) < 0.8) return null;
  const axis = [0, 0, 0]; axis[k] = -Math.sign(up[k]);
  return axis;
}

/** Board axis for display, e.g. "+X". */
export function axisLabel(axis) {
  if (!axis) return '-';
  const i = axis.findIndex(v => v !== 0);
  return (axis[i] > 0 ? '+' : '-') + 'XYZ'[i];
}

/** Mean orientation as a THREE.Quaternion, flipping signs so all samples share a hemisphere. */
export function meanQuat(samples) {
  const m = [0, 0, 0, 0], first = samples[0];
  samples.forEach(q => {
    const sign = first.w * q.w + first.x * q.x + first.y * q.y + first.z * q.z < 0 ? -1 : 1;
    m[0] += sign * q.w; m[1] += sign * q.x; m[2] += sign * q.y; m[3] += sign * q.z;
  });
  const ml = Math.hypot(...m);
  return new THREE.Quaternion(m[1] / ml, m[2] / ml, m[3] / ml, m[0] / ml);
}

/** Angle between `axis` and straight down, given the gravity-up direction in the same frame. */
export function angleFromDown(axis, up) {
  const d = -(axis[0] * up[0] + axis[1] * up[1] + axis[2] * up[2]);
  return Math.acos(Math.min(1, Math.max(-1, d))) / D2R;
}

const _swing = new THREE.Quaternion(), _twist = new THREE.Quaternion();

/**
 * Rotation about `dNow` (degrees, -180..180) from `qCal` to `qNow`, after removing the swing that carried
 * the axis from `dCal` to `dNow` (shortest arc). `qCalInv` is `qCal` inverted.
 */
export function twistDeg(qNow, qCalInv, dCal, dNow) {
  _swing.setFromUnitVectors(dCal, dNow);
  _twist.copy(qNow).multiply(qCalInv).multiply(_swing.invert());
  const t = _twist, d = dNow;
  const a = 2 * Math.atan2(t.x * d.x + t.y * d.y + t.z * d.z, t.w) / D2R;
  return a > 180 ? a - 360 : a < -180 ? a + 360 : a;
}
