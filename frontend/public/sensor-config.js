// Sensor settings for this booth. Loaded as a plain script before the app; anything left out uses the defaults in js/config.js.
window.SENSOR_CONFIG = {
  // forearmAxis: 'auto',   // board axis along the forearm toward the hand: 'auto' or '+x' ... '-z'
  // upperArmAxis: 'auto',  // board axis along the upper arm toward the elbow, for two-sensor setups
  // upperBoardName: 'FormGuard-Upper',   // BLE names of the boards in two-sensor setups (DEVICE_NAME in the firmware)
  // forearmBoardName: 'FormGuard-Fore',
  // smoothing: 0.35,       // 0..1, lower is smoother but laggier
  // calibrationMs: 1500,   // how long the pose is sampled during calibration
  // staleMs: 1500,         // "no data" after this long without a packet
  // twistSign: 1,          // -1 flips which way forearm twist is positive
  // Form check (upper arm + forearm setup only)
  // repRiseDeg: 25,        // elbow bend past the bottom that starts a rep, and drop from the top that starts lowering
  // repEndDeg: 20,         // elbow flexion below which the arm counts as straight
  // repMinRangeDeg: 50,    // smaller movements are not counted as reps
  // elbowSwingDeg: 15,     // upper arm swing forward or back during a rep that counts as elbow swing
};
