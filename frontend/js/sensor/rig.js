// The sensors a setup uses, bundled so the pages can treat one board and two boards alike.
// The lower link (forearm or wrist) is shared by every setup, so a connected board stays connected when the setup changes.
import { POSITIONS } from '../sensor-setups.js';
import { ForearmEstimator } from './forearm-estimator.js';
import { ArmEstimator } from './arm-estimator.js';

/**
 * @typedef {object} Slot
 * @property {string} position     key of POSITIONS
 * @property {string} label        e.g. "Upper arm sensor"
 * @property {string | null} name  board name the chooser is limited to, null for any FormGuard board
 * @property {import('./ble-link.js').SensorLink} link
 */

export class SensorRig {
  /**
   * @param {import('../sensor-setups.js').Setup} setup
   * @param {{upper: import('./ble-link.js').SensorLink, lower: import('./ble-link.js').SensorLink}} links
   * @param {object} cfg
   */
  constructor(setup, links, cfg) {
    this.setup = setup;
    this.cfg = cfg;
    const lower = setup.positions.find(p => p !== 'upper');
    const slot = (position, link, name) => ({ position, label: `${POSITIONS[position].label} sensor`, name, link });
    if (setup.positions.includes('upper')) {
      /** @type {Slot[]} */
      this.slots = [slot('upper', links.upper, cfg.upperBoardName), slot(lower, links.lower, cfg.forearmBoardName)];
      this.estimator = new ArmEstimator(cfg);
    } else {
      this.slots = [slot(lower, links.lower, null)];
      this.estimator = new ForearmEstimator(cfg);
    }
  }

  get connected() { return this.slots.every(s => s.link.connected); }
  get connecting() { return this.slots.some(s => s.link.connecting); }
  /** Every board has sent data recently. */
  get streaming() { return this.slots.every(s => s.link.msSincePacket() < this.cfg.staleMs); }
  get rateHz() { return Math.min(...this.slots.map(s => s.link.rateHz)); }
  get lost() { return this.slots.reduce((n, s) => n + s.link.lost, 0); }

  /** Drops a shared link that is connected to a board this setup can't use, e.g. the upper arm board in the forearm slot. */
  releaseMismatched() {
    for (const s of this.slots) if (s.name && s.link.connected && s.link.deviceName !== s.name) s.link.disconnect();
  }

  /** Opens the device chooser for one slot. Resolves false if the chooser was dismissed. */
  connect(slot) { slot.link.name = slot.name; return slot.link.connect(); }

  /**
   * 'connecting' | 'connected' | 'disconnected' | 'stats' fire for any of the boards. 'sample' delivers what the estimator
   * takes: a quaternion for one board, or an {upper, lower} pair for two, paced by the lower board's packets.
   * Returns a function that unsubscribes.
   */
  on(event, fn) {
    if (event === 'sample') {
      if (this.slots.length === 1) return this.slots[0].link.on('packet', fn);
      const [upperSlot, lowerSlot] = this.slots;
      let upper = null, upperAt = 0;
      const offs = [
        upperSlot.link.on('packet', q => { upper = q; upperAt = performance.now(); }),
        lowerSlot.link.on('packet', q => { if (upper && performance.now() - upperAt < this.cfg.staleMs) fn({ upper, lower: q }); }),
      ];
      return () => offs.forEach(off => off());
    }
    const offs = this.slots.map(s => s.link.on(event, fn));
    return () => offs.forEach(off => off());
  }

  /** Asks every board to recalibrate itself and waits for all of them, or `timeoutMs`. */
  async calibrateBoards(timeoutMs) {
    await Promise.all(this.slots.map(s => s.link.sendCalibrate()));
    await Promise.all(this.slots.map(s => s.link.once('ready', timeoutMs)));
  }
}
