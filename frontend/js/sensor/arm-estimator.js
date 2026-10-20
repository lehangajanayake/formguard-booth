// Elbow flexion and forearm twist from two boards, one on the upper arm and one on the forearm, measured as the forearm's
// rotation relative to the upper arm since a straight-arm calibration pose. Shoulder movement therefore does not leak into
// the angles. Samples are {upper, lower} pairs of body-to-world quaternions.
//
// Each board has its own world frame: both share gravity, but their headings differ because neither has a compass. The
// heading offset is measured once, at calibration, from the board faces: both are strapped flat on the outer side of the
// arm, so in the calibration pose their face normals point the same way. Gyro drift slowly spoils that offset, which
// mostly shows when the upper arm is raised; recalibrating resets it.
import * as THREE from 'three';
import { AXES, meanUp, downAxis, axisLabel, meanQuat, D2R, twistDeg } from './orientation-math.js';

const Z = new THREE.Vector3(0, 0, 1);

export class ArmEstimator {
  /** @param {{forearmAxis: string, upperArmAxis: string, smoothing: number, twistSign: number}} cfg */
  constructor(cfg) {
    this.cfg = cfg;
    this._qHeading = new THREE.Quaternion();   // turns the forearm board's world into the upper arm board's world
    this._qU = new THREE.Quaternion();
    this._qRel = new THREE.Quaternion();
    this._qTwistCalInv = new THREE.Quaternion();
    this._axis = new THREE.Vector3();
    this._dStraight = new THREE.Vector3();     // forearm axis in the upper arm board's frame, arm straight
    this._dTwistCal = new THREE.Vector3();     // the same at the twist reference
    this._dNow = new THREE.Vector3();
    this.reset();
  }

  /** Forgets the calibration. Configured board axes are kept, auto-detected ones are dropped. */
  reset() {
    const fore = AXES[this.cfg.forearmAxis], upper = AXES[this.cfg.upperArmAxis];
    this.axis = fore ? [...fore] : null;
    this.upperAxis = upper ? [...upper] : null;
    this.calibrated = false;
    this.collecting = false;
    this._samples = [];
    this._elbow = null;
    this._twist = null;
  }

  /** Board axes along each arm segment, for display. */
  get axisLabel() { return `upper ${axisLabel(this.upperAxis)}, forearm ${axisLabel(this.axis)}`; }

  beginCalibration() { this.reset(); this.collecting = true; }

  /** Call with every {upper, lower} sample while collecting. */
  addSample(s) { if (this.collecting) this._samples.push(s); }

  /** @returns {{ok: true} | {ok: false, reason: string}} */
  finishCalibration() {
    this.collecting = false;
    const samples = this._samples; this._samples = [];
    if (!samples.length) return { ok: false, reason: 'No data arrived from both sensors during calibration.' };
    const uppers = samples.map(s => s.upper), lowers = samples.map(s => s.lower);

    this.upperAxis ||= downAxis(meanUp(uppers));
    if (!this.upperAxis) {
      return { ok: false, reason: 'Could not find the upper arm axis. Let the upper arm hang straight down, with one board edge pointing along it.' };
    }
    this.axis ||= downAxis(meanUp(lowers));
    if (!this.axis) {
      return { ok: false, reason: 'Could not find the forearm axis. Hold the arm straight, with one board edge pointing along it.' };
    }

    const qU = meanQuat(uppers), qF = meanQuat(lowers);
    const nU = Z.clone().applyQuaternion(qU), nF = Z.clone().applyQuaternion(qF);
    if (Math.hypot(nU.x, nU.y) < 0.5 || Math.hypot(nF.x, nF.y) < 0.5) {
      return { ok: false, reason: 'Strap both boards flat against the outer side of the arm, then calibrate again.' };
    }
    this._qHeading.setFromAxisAngle(Z, Math.atan2(nU.y, nU.x) - Math.atan2(nF.y, nF.x));

    this._axis.set(...this.axis);
    this._relative({ upper: qU, lower: qF });
    this._dStraight.copy(this._axis).applyQuaternion(this._qRel);
    this._setTwistReference();

    this.calibrated = true;
    return { ok: true };
  }

  /** Sets forearm twist to zero at the supplied sample without changing elbow calibration. */
  setTwistZero(s) {
    if (!this.calibrated) return false;
    this._relative(s);
    this._setTwistReference();
    this._twist = 0;
    return true;
  }

  /**
   * Smoothed angles for one sample, or null before calibration.
   * `elbow` is flexion in degrees (0 = straight). `twist` is forearm rotation in degrees, limited to +/-120.
   */
  update(s) {
    if (!this.calibrated) return null;
    this._relative(s);
    this._dNow.copy(this._axis).applyQuaternion(this._qRel);
    const elbow = this._dStraight.angleTo(this._dNow) / D2R;
    const twist = twistDeg(this._qRel, this._qTwistCalInv, this._dTwistCal, this._dNow);
    const a = this.cfg.smoothing;
    this._elbow = this._elbow === null ? elbow : this._elbow + a * (elbow - this._elbow);
    this._twist = this._twist === null ? twist : this._twist + a * (twist - this._twist);
    return { elbow: this._elbow, twist: Math.max(-120, Math.min(120, this._twist)) * this.cfg.twistSign };
  }

  /** Sets _qRel to the forearm board's orientation in the upper arm board's frame. */
  _relative({ upper, lower }) {
    this._qU.set(upper.x, upper.y, upper.z, upper.w).normalize().invert();
    this._qRel.set(lower.x, lower.y, lower.z, lower.w).normalize().premultiply(this._qHeading).premultiply(this._qU);
  }

  _setTwistReference() {
    this._qTwistCalInv.copy(this._qRel).invert();
    this._dTwistCal.copy(this._axis).applyQuaternion(this._qRel);
  }
}
