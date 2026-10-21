// Records the raw packets of every board in the current setup, so sessions can be replayed offline through the
// estimators and the rep detector to choose thresholds. Nothing derived is stored: replaying with changed code or
// settings gives the answer that code would have given live.
//
// File format ('formguard-recording', the same top-level shape the simulator writes):
//   packets[position]      rows of [t_ms, seq, w, x, y, z, host_ms], one per packet as received
//                          t_ms: the board's own clock (each board has its own); host_ms: performance.now() on arrival,
//                          shared by all boards, so use it to line the boards up. Gaps in seq are lost packets.
//   calibration.packets    the same rows for the still calibration pose, which a replay needs to rebuild the calibration
//   calibration.raise      the same for the straight-arm raise that follows it (two-board setups), plus calibration.arm
//   events                 [host_ms, kind, position] for connects and disconnects during the recording
//   derived                what the app worked out live, to check against the raw data and video:
//     frames               rows of derived_columns, one per estimator sample (paced by the forearm/wrist board).
//                          Angles in degrees; upper_* and rep_* are null for single-board setups. rep_phase is the rep
//                          detector's state (wait, bottom, lift, lower); swing_now is the upper arm swing from the rep's
//                          reference, + forward, null between reps.
//     rep_events           {host_ms, type, rep} for every 'fault', 'rep' and 'abort' the detector raised

/** @param {{position: string, link: import('../sensor/ble-link.js').SensorLink}} slot */
const row = (slot, p) => [p.tMs, p.seq, p.w, p.x, p.y, p.z, slot.link.lastPacketAt];

/**
 * Collects packet rows per position until stopped.
 * @param {{position: string, link: import('../sensor/ble-link.js').SensorLink}[]} slots
 */
export function collectPackets(slots) {
  const packets = Object.fromEntries(slots.map(s => [s.position, []]));
  const offs = slots.map(s => s.link.on('packet', p => packets[s.position].push(row(s, p))));
  return { packets, stop: () => offs.forEach(off => off()) };
}

const DERIVED_COLUMNS = ['host_ms', 'elbow', 'twist', 'upper_tilt', 'upper_forward', 'upper_out', 'rep_phase', 'swing_now', 'rep_count'];

export class Recorder {
  /**
   * @param {import('../sensor/rig.js').SensorRig} rig
   * @param {{label: string, calibration: object | null, cfg: object}} opts
   */
  constructor(rig, { label, calibration, cfg }) {
    this.label = label;
    this.startedAt = new Date();
    this.startHostMs = performance.now();
    this._rig = rig;
    this._calibration = calibration;
    this._cfg = cfg;
    this._collect = collectPackets(rig.slots);
    this._events = [];
    this._frames = [];
    this._repEvents = [];
    this._offs = rig.slots.flatMap(s => ['connected', 'disconnected'].map(kind =>
      s.link.on(kind, () => this._events.push([performance.now(), kind, s.position]))));
  }

  /**
   * Adds what the estimator and rep detector made of one sample.
   * @param {{elbow: number, twist: number, upperArm?: {tilt: number, forward: number, out: number}}} angles
   * @param {import('../form/rep-detector.js').RepDetector | null} detector
   */
  addFrame(angles, detector) {
    const u = angles.upperArm;
    this._frames.push([performance.now(), angles.elbow, angles.twist, u?.tilt ?? null, u?.forward ?? null, u?.out ?? null,
      detector?.phase ?? null, detector?.swingNow ?? null, detector?.count ?? null]);
  }

  /** @param {import('../form/rep-detector.js').RepEvent} e */
  addRepEvent(e) {
    // The rep keeps changing after a 'fault' event, so store a copy. Its *Ms times are performance.now(), like host_ms.
    this._repEvents.push({ host_ms: performance.now(), type: e.type, rep: { ...e.rep, faults: [...e.rep.faults] } });
  }

  get elapsedMs() { return performance.now() - this.startHostMs; }
  get packetCount() { return Object.values(this._collect.packets).reduce((n, rows) => n + rows.length, 0); }

  /** Stops recording and returns the recording object. */
  stop() {
    this._collect.stop();
    this._offs.forEach(off => off());
    const { setup, slots, estimator } = this._rig;
    return {
      format: 'formguard-recording',
      version: 1,
      source: { kind: 'booth', user_agent: navigator.userAgent },
      label: this.label,
      recorded_at: this.startedAt.toISOString(),
      setup: setup.id,
      arm: this._calibration?.arm ?? null,
      sensors: Object.fromEntries(slots.map(s => [s.position, { device_name: s.link.deviceName }])),
      board_axes: { lower: estimator.axis, upper: estimator.upperAxis ?? null },   // along each segment, as found at calibration
      config: { ...this._cfg },
      columns: ['t_ms', 'seq', 'w', 'x', 'y', 'z', 'host_ms'],
      start_host_ms: this.startHostMs,
      end_host_ms: performance.now(),
      calibration: this._calibration,
      packets: this._collect.packets,
      events: this._events,
      derived: { columns: DERIVED_COLUMNS, frames: this._frames, rep_events: this._repEvents },
    };
  }
}

/** Saves a recording as a JSON file through the browser's download. */
export function downloadRecording(rec) {
  const safe = rec.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unlabelled';
  const stamp = rec.recorded_at.slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
  const url = URL.createObjectURL(new Blob([JSON.stringify(rec)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `formguard_${rec.setup}_${safe}_${stamp}.json` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
