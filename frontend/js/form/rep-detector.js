// Counts bicep curl reps from elbow flexion and checks each one for elbow swing: the upper arm swinging forward or back
// while the forearm curls, so the shoulder does part of the lift. Only the upper arm board knows where the elbow is, so
// this needs the upper arm + forearm setup and takes the angles ArmEstimator.update() returns.
//
// Reps are found from the valleys and peaks of elbow flexion rather than fixed angles, so a lifter who never fully
// straightens still gets counted: a rep starts once the elbow has bent `repRiseDeg` past its lowest point, and ends when
// it is straight again (below `repEndDeg`) or when it starts the next rep from a partial bottom. Movements that cover
// less than `repMinRangeDeg` are not reps (a half-start, adjusting the grip).
//
// The upper arm angle at the bottom, just before the rep, is the reference. A steady lean or an arm held a little
// forward is therefore not a fault; moving it more than `elbowSwingDeg` from there during the rep is.

/**
 * @typedef {object} Rep
 * @property {number} index        1-based count of finished reps in the set
 * @property {number} startMs
 * @property {number} peakMs
 * @property {number} endMs
 * @property {number} bottomDeg    elbow flexion at the start of the rep
 * @property {number} peakDeg      highest elbow flexion
 * @property {number} refForward   upper arm angle forward at the bottom of the rep, the reference for swing
 * @property {number} swingDeg     largest upper arm swing from the reference, signed: + forward, - back
 * @property {string[]} faults     'elbow_swing' or nothing
 */

/**
 * @typedef {{type: 'fault', rep: Rep} | {type: 'rep', rep: Rep} | {type: 'abort', rep: Rep}} RepEvent
 * 'fault' fires the moment a rep first crosses a threshold, 'rep' when a rep finishes, 'abort' when a movement that
 * started like a rep turned out too small to count.
 */

export class RepDetector {
  /** @param {{repRiseDeg: number, repEndDeg: number, repMinRangeDeg: number, elbowSwingDeg: number}} cfg */
  constructor(cfg) {
    this.cfg = cfg;
    this.reset();
  }

  /** Forgets the set. The next rep is only counted once the arm has been straight. */
  reset() {
    this.count = 0;
    this.abandon();
  }

  /** Drops a rep in progress, e.g. when a sensor stops sending, without forgetting the finished reps. */
  abandon() {
    this.phase = 'wait';   // wait: arm not yet straight | bottom: between reps | lift | lower
    this._valley = null;   // {elbow, forward} lowest point before the current rep, or since the peak while lowering
    this._rep = null;
    this.swingNow = null;  // upper arm swing from the reference right now, signed; null between reps
  }

  /** The rep in progress, or null. */
  get current() { return this._rep; }

  /**
   * @param {{elbow: number, upperArm: {forward: number}}} angles from ArmEstimator.update()
   * @param {number} t time in ms
   * @returns {RepEvent | null}
   */
  update({ elbow, upperArm }, t) {
    const { repRiseDeg, repEndDeg, repMinRangeDeg, elbowSwingDeg } = this.cfg;
    const forward = upperArm.forward;
    this.swingNow = null;

    if (this.phase === 'wait') {
      if (elbow < repEndDeg) { this.phase = 'bottom'; this._valley = { elbow, forward }; }
      return null;
    }
    if (this.phase === 'bottom') {
      if (elbow < this._valley.elbow) this._valley = { elbow, forward };
      else if (elbow > this._valley.elbow + repRiseDeg) this._start(t);
      return null;
    }

    const rep = this._rep;
    const swing = this.swingNow = forward - rep.refForward;
    if (Math.abs(swing) > Math.abs(rep.swingDeg)) rep.swingDeg = swing;

    let event = null;
    if (!rep.faults.length && Math.abs(swing) > elbowSwingDeg) {
      rep.faults.push('elbow_swing');
      event = { type: 'fault', rep };
    }

    if (this.phase === 'lift') {
      if (elbow > rep.peakDeg) { rep.peakDeg = elbow; rep.peakMs = t; }
      else if (elbow < rep.peakDeg - repRiseDeg) { this.phase = 'lower'; this._valley = { elbow, forward }; }
      return event;
    }

    // lower
    if (elbow < this._valley.elbow) this._valley = { elbow, forward };
    const straight = elbow < repEndDeg;
    const nextRep = elbow > this._valley.elbow + repRiseDeg;
    if (!straight && !nextRep) return event;

    rep.endMs = t;
    const counted = rep.peakDeg - rep.bottomDeg >= repMinRangeDeg;
    if (counted) rep.index = ++this.count;
    this._rep = null;
    if (straight) { this.phase = 'bottom'; this._valley = { elbow, forward }; }
    else this._start(t);   // the next rep began from a partial bottom; its reference is that bottom
    return { type: counted ? 'rep' : 'abort', rep };
  }

  _start(t) {
    this.phase = 'lift';
    const { elbow, forward } = this._valley;
    this._rep = { index: 0, startMs: t, peakMs: t, endMs: 0, bottomDeg: elbow, peakDeg: elbow, refForward: forward, swingDeg: 0, faults: [] };
  }
}
