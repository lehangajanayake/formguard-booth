// Turns the board's orientation quaternion into elbow flexion and forearm twist, relative to a straight-arm calibration pose.
// Assumes the upper arm hangs vertical, so shoulder swing is read as elbow flexion. Orientation is body-to-world.
import * as THREE from 'three';
const D2R = Math.PI / 180;

const AXES = { '+x': [1, 0, 0], '-x': [-1, 0, 0], '+y': [0, 1, 0], '-y': [0, -1, 0], '+z': [0, 0, 1], '-z': [0, 0, -1] };

/** Gravity-up direction in the board frame. */
function upInBody({ w, x, y, z }) {
  const u = [2 * (x * z - w * y), 2 * (w * x + y * z), 1 - 2 * (x * x + y * y)];
  const l = Math.hypot(...u) || 1;
  return u.map(v => v / l);
}

export class ForearmEstimator {
  /** @param {{forearmAxis: string, smoothing: number, twistSign: number}} cfg */
  constructor(cfg) {
    this.cfg = cfg;
    this._qCal = new THREE.Quaternion();
    this._qCalInv = new THREE.Quaternion();
    this._qNow = new THREE.Quaternion();
    this._qSwing = new THREE.Quaternion();
    this._qTwist = new THREE.Quaternion();
    this._axis = new THREE.Vector3();
    this._dCal = new THREE.Vector3();
    this._dNow = new THREE.Vector3();
    this.reset();
  }

  /** Forgets the calibration. A configured forearm axis is kept, an auto-detected one is dropped. */
  reset() {
    const fixed = AXES[this.cfg.forearmAxis];
    this.axis = fixed ? [...fixed] : null;
    this.calibrated = false;
    this.collecting = false;
    this._samples = [];
    this._offsetDeg = 0;
    this._elbow = null;
    this._twist = null;
  }

  /** Forearm axis in board coordinates, for display, e.g. "+X". */
  get axisLabel() {
    if (!this.axis) return '-';
    const i = this.axis.findIndex(v => v !== 0);
    return (this.axis[i] > 0 ? '+' : '-') + 'XYZ'[i];
  }

  beginCalibration() { this.reset(); this.collecting = true; }

  /** Call with every packet while collecting. */
  addSample(q) { if (this.collecting) this._samples.push(q); }

  /** @returns {{ok: true} | {ok: false, reason: string}} */
  finishCalibration() {
    this.collecting = false;
    const samples = this._samples; this._samples = [];
    if (!samples.length) return { ok: false, reason: 'No sensor data arrived during calibration.' };

    const sum = [0, 0, 0];
    samples.forEach(q => upInBody(q).forEach((v, i) => { sum[i] += v; }));
    const len = Math.hypot(...sum);
    const up = sum.map(v => v / len);

    if (!this.axis) {   // auto: the board axis most aligned with gravity is the one along the forearm
      const k = up.map(Math.abs).indexOf(Math.max(...up.map(Math.abs)));
      if (Math.abs(up[k]) < 0.8) {
        return { ok: false, reason: 'Could not find the forearm axis. Hold the arm straight, with one board edge pointing along it.' };
      }
      this.axis = [0, 0, 0]; this.axis[k] = -Math.sign(up[k]);
    }
    this._offsetDeg = this._flexion(up);

    // Mean calibration orientation, flipping signs so all samples share a hemisphere.
    const m = [0, 0, 0, 0], first = samples[0];
    samples.forEach(q => {
      const sign = first.w * q.w + first.x * q.x + first.y * q.y + first.z * q.z < 0 ? -1 : 1;
      m[0] += sign * q.w; m[1] += sign * q.x; m[2] += sign * q.y; m[3] += sign * q.z;
    });
    const ml = Math.hypot(...m);
    this._qCal.set(m[1] / ml, m[2] / ml, m[3] / ml, m[0] / ml);
    this._qCalInv.copy(this._qCal).invert();
    this._axis.set(...this.axis);
    this._dCal.copy(this._axis).applyQuaternion(this._qCal);

    this.calibrated = true;
    return { ok: true };
  }

  /** Sets forearm twist to zero at the supplied orientation without changing elbow calibration. */
  setTwistZero(q) {
    if (!this.calibrated) return false;
    this._qCal.set(q.x, q.y, q.z, q.w).normalize();
    this._qCalInv.copy(this._qCal).invert();
    this._dCal.copy(this._axis).applyQuaternion(this._qCal);
    this._twist = 0;
    return true;
  }

  /** Angle between the forearm axis and straight down. */
  _flexion(up) {
    const d = -(this.axis[0] * up[0] + this.axis[1] * up[1] + this.axis[2] * up[2]);
    return Math.acos(Math.min(1, Math.max(-1, d))) / D2R;
  }

  /** Rotation about the forearm axis since calibration, after removing the elbow swing (shortest arc of the axis). */
  _twistDeg(q) {
    this._qNow.set(q.x, q.y, q.z, q.w);
    this._dNow.copy(this._axis).applyQuaternion(this._qNow);
    this._qSwing.setFromUnitVectors(this._dCal, this._dNow);
    this._qTwist.copy(this._qNow).multiply(this._qCalInv).multiply(this._qSwing.invert());
    const t = this._qTwist, d = this._dNow;
    const a = 2 * Math.atan2(t.x * d.x + t.y * d.y + t.z * d.z, t.w) / D2R;
    return a > 180 ? a - 360 : a < -180 ? a + 360 : a;
  }

  /**
   * Smoothed angles for one packet, or null before calibration.
   * `elbow` is flexion in degrees (0 = straight). `twist` is forearm rotation in degrees, limited to +/-120.
   */
  update(q) {
    if (!this.calibrated) return null;
    const a = this.cfg.smoothing;
    const elbow = Math.max(0, this._flexion(upInBody(q)) - this._offsetDeg);
    const twist = this._twistDeg(q);
    this._elbow = this._elbow === null ? elbow : this._elbow + a * (elbow - this._elbow);
    this._twist = this._twist === null ? twist : this._twist + a * (twist - this._twist);
    return { elbow: this._elbow, twist: Math.max(-120, Math.min(120, this._twist)) * this.cfg.twistSign };
  }
}
