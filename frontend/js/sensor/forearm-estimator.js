// Turns the board's orientation quaternion into elbow flexion and forearm twist, relative to a straight-arm calibration pose.
// Assumes the upper arm hangs vertical, so shoulder swing is read as elbow flexion. Orientation is body-to-world.
import * as THREE from 'three';
import { AXES, upInBody, meanUp, downAxis, axisLabel, meanQuat, angleFromDown, twistDeg } from './orientation-math.js';

export class ForearmEstimator {
  /** @param {{forearmAxis: string, smoothing: number, twistSign: number}} cfg */
  constructor(cfg) {
    this.cfg = cfg;
    this._qCal = new THREE.Quaternion();
    this._qCalInv = new THREE.Quaternion();
    this._qNow = new THREE.Quaternion();
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
  get axisLabel() { return axisLabel(this.axis); }

  beginCalibration() { this.reset(); this.collecting = true; }

  /** Call with every sample (a quaternion) while collecting. */
  addSample(q) { if (this.collecting) this._samples.push(q); }

  /** @returns {{ok: true} | {ok: false, reason: string}} */
  finishCalibration() {
    this.collecting = false;
    const samples = this._samples; this._samples = [];
    if (!samples.length) return { ok: false, reason: 'No sensor data arrived during calibration.' };

    const up = meanUp(samples);
    if (!this.axis) {   // auto: the board axis most aligned with gravity is the one along the forearm
      this.axis = downAxis(up);
      if (!this.axis) {
        return { ok: false, reason: 'Could not find the forearm axis. Hold the arm straight, with one board edge pointing along it.' };
      }
    }
    this._offsetDeg = angleFromDown(this.axis, up);

    this._qCal.copy(meanQuat(samples));
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

  /**
   * Smoothed angles for one sample, or null before calibration.
   * `elbow` is flexion in degrees (0 = straight). `twist` is forearm rotation in degrees, limited to +/-120.
   */
  update(q) {
    if (!this.calibrated) return null;
    const a = this.cfg.smoothing;
    const elbow = Math.max(0, angleFromDown(this.axis, upInBody(q)) - this._offsetDeg);
    this._qNow.set(q.x, q.y, q.z, q.w);
    this._dNow.copy(this._axis).applyQuaternion(this._qNow);
    const twist = twistDeg(this._qNow, this._qCalInv, this._dCal, this._dNow);
    this._elbow = this._elbow === null ? elbow : this._elbow + a * (elbow - this._elbow);
    this._twist = this._twist === null ? twist : this._twist + a * (twist - this._twist);
    return { elbow: this._elbow, twist: Math.max(-120, Math.min(120, this._twist)) * this.cfg.twistSign };
  }
}
