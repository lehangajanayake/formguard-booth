// Sensor settings for this booth. Loaded as a plain script before the app; anything left out uses the defaults in js/config.js.
window.SENSOR_CONFIG = {
  // forearmAxis: 'auto',   // board axis along the forearm toward the hand: 'auto' or '+x' ... '-z'
  // smoothing: 0.35,       // 0..1, lower is smoother but laggier
  // calibrationMs: 1500,   // how long the pose is sampled during calibration
  // staleMs: 1500,         // "no data" after this long without a packet
  // twistSign: 1,          // -1 flips which way forearm twist is positive
};
