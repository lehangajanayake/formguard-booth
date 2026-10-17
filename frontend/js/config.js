// Settings come from ../sensor-config.js (a classic script loaded before the app). Anything missing falls back here.
export const CFG = Object.assign({
  forearmAxis: 'auto',   // board axis along the forearm toward the hand: 'auto' or '+x' ... '-z'
  smoothing: 0.35,       // 0..1, lower is smoother but laggier
  calibrationMs: 1500,   // how long the pose is sampled during calibration
  staleMs: 1500,         // "no data" after this long without a packet
  twistSign: 1,          // -1 flips which way forearm twist is positive
}, window.SENSOR_CONFIG);
