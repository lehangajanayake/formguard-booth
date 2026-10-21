// State shared between the pages of the flow.
export const state = {
  /** @type {string | null} id from sensor-setups.js */
  setupId: null,
  /** 'left' or 'right': the arm the sensors are on */
  arm: 'left',
  calibrated: false,
  /** Raw packets of the last successful calibration, kept for recordings: {start_host_ms, end_host_ms, packets}. */
  calibration: null,
};
