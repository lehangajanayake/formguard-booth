// Elbow flexion and forearm twist from two boards, one on the upper arm and one on the forearm, measured as the forearm's
// rotation relative to the upper arm since a straight-arm calibration pose. Shoulder movement therefore does not leak into
// the angles. Samples are {upper, lower} pairs of body-to-world quaternions.
//
// Calibration has two steps. The still pose (arm hanging straight) finds which board axis lies along each segment. Then
// the lifter raises the straight arm out in front and lowers it again. Both boards swing the same way, so that movement
// says, in each board's own world, which way is forward:
// - Each board has its own world frame: both share gravity, but their headings differ because neither has a compass.
//   The heading offset between them is the difference between the two forward directions.
// - In the upper arm board's frame, the direction gravity swings away from is forward, which fixes forward for the
//   elbow-position readings below.
// Nothing is assumed about which arm it is or which way round the boards are strapped. Gyro drift then slowly changes
// the heading offset, so it is corrected continuously from the elbow being a hinge: once the elbow bends, the forearm can
// only lie in the upper arm's forward plane, and any sideways lean is heading error.
//
// The upper arm board also says where the elbow is: how far the upper arm has swung forward or out from hanging straight
// down. That comes from gravity alone, so it never drifts, and it ignores turning about the vertical. Which side is
// "out" depends on the arm, so the arm side ('left' or 'right') is passed to finishRaise().
import * as THREE from 'three';
import { AXES, upInBody, meanUp, downAxis, axisLabel, meanQuat, D2R, twistDeg } from './orientation-math.js';

const Z = new THREE.Vector3(0, 0, 1);
const DOWN = new THREE.Vector3(0, -1, 0);
const HEADING_MIN_ELBOW = 25;   // degrees of flexion before the hinge says anything about heading
const HEADING_GAIN = 0.05;      // fraction of the heading error corrected per sample (~50 Hz)
export const RAISE_MIN_DEG = 35;      // the raise must lift the upper arm at least this far from vertical
const RAISE_USE_DEG = 20;             // raise samples with less upper arm tilt than this say too little about direction
const RAISE_MAX_BEND_DEG = 25;        // forearm and upper arm tilts may differ this much before the elbow counts as bent

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
    // Upper arm directions in its board's frame, from the calibration pose: forward, up the arm, lateral (model X, Y, Z).
    this._fwdB = new THREE.Vector3();
    this._upB = new THREE.Vector3();
    this._latB = new THREE.Vector3();
    this._gravity = new THREE.Vector3();       // gravity (down) in arm axes, smoothed
    this._gNow = new THREE.Vector3();
    this._qShoulder = new THREE.Quaternion();
    this.reset();
  }

  /** Forgets the calibration. Configured board axes are kept, auto-detected ones are dropped. */
  reset() {
    const fore = AXES[this.cfg.forearmAxis], upper = AXES[this.cfg.upperArmAxis];
    this.axis = fore ? [...fore] : null;
    this.upperAxis = upper ? [...upper] : null;
    this.calibrated = false;
    this.collecting = false;
    this.posed = false;        // the still pose is done and the raise is next
    this._samples = [];
    this._raise = null;
    this._elbow = null;
    this._twist = null;
    this._gravity.set(0, 0, 0);
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

    const upU = meanUp(uppers);
    this.upperAxis ||= downAxis(upU);
    if (!this.upperAxis) {
      return { ok: false, reason: 'Could not find the upper arm axis. Let the upper arm hang straight down, with one board edge pointing along it.' };
    }
    this.axis ||= downAxis(meanUp(lowers));
    if (!this.axis) {
      return { ok: false, reason: 'Could not find the forearm axis. Hold the arm straight, with one board edge pointing along it.' };
    }

    this._qUCal = meanQuat(uppers); this._qFCal = meanQuat(lowers);
    this._upB.set(...upU);
    this._axis.set(...this.axis);
    this.posed = true;
    return { ok: true };
  }

  /** The two-board estimator needs the raise step after the still pose. */
  get needsRaise() { return true; }

  beginRaise() { this._raise = []; }

  /** Call with every sample during the raise. Returns the upper arm's tilt from the pose's vertical, in degrees. */
  addRaiseSample(s) {
    if (!this._raise) return 0;
    this._raise.push(s);
    return this._upperTilt(s.upper);
  }

  /**
   * Finishes calibration from the raise: the heading offset between the boards, and forward in the upper arm board.
   * @param {'left'|'right'} side which arm the boards are on; it decides which side is "out"
   * @returns {{ok: true} | {ok: false, reason: string}}
   */
  finishRaise(side) {
    const samples = this._raise || []; this._raise = null;
    if (!this.posed) return { ok: false, reason: 'Hold the calibration pose first.' };
    const upAxis = new THREE.Vector3(...this.upperAxis);
    const fwdU = new THREE.Vector3(), fwdF = new THREE.Vector3(), fwdB = new THREE.Vector3(), d = new THREE.Vector3(), g = new THREE.Vector3();
    let maxTilt = 0, bendAtMax = 0;
    for (const s of samples) {
      const tilt = this._upperTilt(s.upper);
      if (tilt > maxTilt) { maxTilt = tilt; bendAtMax = this._forearmTilt(s.lower) - this._segmentTilt(this.upperAxis, s.upper); }
      if (tilt < RAISE_USE_DEG) continue;
      // Each segment points forward-and-down: its horizontal part is forward in that board's world. Longer = more raised.
      d.copy(upAxis).applyQuaternion(quat(s.upper)); fwdU.x += d.x; fwdU.y += d.y;
      d.copy(this._axis).applyQuaternion(quat(s.lower)); fwdF.x += d.x; fwdF.y += d.y;
      // As the arm goes forward, "up" in the upper arm board's frame swings toward the arm's front.
      g.set(...upInBody(s.upper));
      fwdB.add(g.addScaledVector(this._upB, -g.dot(this._upB)));
    }
    if (maxTilt < RAISE_MIN_DEG) {
      return { ok: false, reason: 'The arm did not go up far enough. Keep it straight and raise it out in front of you, to about shoulder height.' };
    }
    if (Math.abs(bendAtMax) > RAISE_MAX_BEND_DEG) {
      return { ok: false, reason: 'The elbow bent during the raise. Keep the arm straight, raise it out in front of you, then lower it.' };
    }

    this._heading = Math.atan2(fwdU.y, fwdU.x) - Math.atan2(fwdF.y, fwdF.x);
    this._qHeading.setFromAxisAngle(Z, this._heading);
    this._relative({ upper: this._qUCal, lower: this._qFCal });
    this._dStraight.copy(this._axis).applyQuaternion(this._qRel);
    this._setTwistReference();

    this._fwdB.copy(fwdB).normalize();
    // Out is away from the body: forward x up points to the lifter's right.
    this._latB.crossVectors(this._fwdB, this._upB);
    if (side === 'left') this._latB.negate();
    this.side = side;

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
   * `shoulder` swings the model's upper arm from hanging straight down to where it is now (model axes: X forward, Y up,
   * Z lateral). `upperArm` is that swing in degrees: `tilt` from vertical, split into `forward` and `out` (negative = back, in).
   */
  update(s) {
    if (!this.calibrated) return null;
    this._relative(s);
    this._dNow.copy(this._axis).applyQuaternion(this._qRel);
    if (this._dStraight.angleTo(this._dNow) / D2R > HEADING_MIN_ELBOW) this._correctHeading(s);
    const elbow = this._dStraight.angleTo(this._dNow) / D2R;
    const twist = twistDeg(this._qRel, this._qTwistCalInv, this._dTwistCal, this._dNow);
    const a = this.cfg.smoothing;
    this._elbow = this._elbow === null ? elbow : this._elbow + a * (elbow - this._elbow);
    this._twist = this._twist === null ? twist : this._twist + a * (twist - this._twist);

    // Gravity in the upper arm's axes; the swing that brings it back to straight down is where the arm hangs from.
    this._gNow.set(...upInBody(s.upper)).negate();
    this._gNow.set(this._gNow.dot(this._fwdB), this._gNow.dot(this._upB), this._gNow.dot(this._latB)).normalize();
    if (this._gravity.lengthSq() === 0) this._gravity.copy(this._gNow); else this._gravity.lerp(this._gNow, a).normalize();
    const g = this._gravity;
    this._qShoulder.setFromUnitVectors(g, DOWN);
    const upperArm = {
      tilt: Math.acos(Math.min(1, Math.max(-1, -g.y))) / D2R,
      forward: Math.atan2(-g.x, -g.y) / D2R,
      out: Math.atan2(-g.z, -g.y) / D2R,
    };

    return { elbow: this._elbow, twist: Math.max(-120, Math.min(120, this._twist)) * this.cfg.twistSign, shoulder: this._qShoulder, upperArm };
  }

  /** Nudges the heading offset so the forearm leans less out of the upper arm's forward plane. Updates _qRel and _dNow. */
  _correctHeading(s) {
    const lean = this._dNow.dot(this._latB), eps = 0.01;
    this._qHeading.setFromAxisAngle(Z, this._heading + eps);
    this._relative(s);
    const slope = (this._dNow.copy(this._axis).applyQuaternion(this._qRel).dot(this._latB) - lean) / eps;
    if (Math.abs(slope) > 0.2) this._heading -= HEADING_GAIN * Math.max(-0.5, Math.min(0.5, lean / slope));
    this._qHeading.setFromAxisAngle(Z, this._heading);
    this._relative(s);
    this._dNow.copy(this._axis).applyQuaternion(this._qRel);
  }

  /** Sets _qRel to the forearm board's orientation in the upper arm board's frame. */
  _relative({ upper, lower }) {
    this._qU.set(upper.x, upper.y, upper.z, upper.w).normalize().invert();
    this._qRel.set(lower.x, lower.y, lower.z, lower.w).normalize().premultiply(this._qHeading).premultiply(this._qU);
  }

  /** Upper arm tilt from the calibration pose's vertical, degrees, from gravity alone. */
  _upperTilt(qU) {
    const up = upInBody(qU);
    return Math.acos(Math.min(1, Math.max(-1, up[0] * this._upB.x + up[1] * this._upB.y + up[2] * this._upB.z))) / D2R;
  }

  /** Angle of a board axis from straight down, degrees, from gravity alone. */
  _segmentTilt(axis, q) {
    const up = upInBody(q);
    return Math.acos(Math.min(1, Math.max(-1, -(axis[0] * up[0] + axis[1] * up[1] + axis[2] * up[2])))) / D2R;
  }

  _forearmTilt(qF) { return this._segmentTilt(this.axis, qF); }

  _setTwistReference() {
    this._qTwistCalInv.copy(this._qRel).invert();
    this._dTwistCal.copy(this._axis).applyQuaternion(this._qRel);
  }
}

const quat = q => new THREE.Quaternion(q.x, q.y, q.z, q.w).normalize();
