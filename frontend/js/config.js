// Settings come from public/sensor-config.js (a classic script loaded before the app). Anything missing falls back here.
export const CFG = Object.assign({
  forearmAxis: 'auto',   // board axis along the forearm toward the hand: 'auto' or '+x' ... '-z'
  upperArmAxis: 'auto',  // board axis along the upper arm toward the elbow, for two-sensor setups
  upperBoardName: 'FormGuard-Upper',   // BLE names of the boards in two-sensor setups (DEVICE_NAME in the firmware)
  forearmBoardName: 'FormGuard-Fore',
  smoothing: 0.35,       // 0..1, lower is smoother but laggier
  calibrationMs: 1500,   // how long the pose is sampled during calibration
  staleMs: 1500,         // "no data" after this long without a packet
  twistSign: 1,          // -1 flips which way forearm twist is positive
  arm: 'left',           // arm chosen when the page opens: 'left' or 'right' (can be changed on the Calibrate page)
  // Form check (upper arm + forearm setup only)
  repRiseDeg: 25,        // elbow bend past the bottom that starts a rep, and drop from the top that starts lowering
  repEndDeg: 20,         // elbow flexion below which the arm counts as straight
  repMinRangeDeg: 30,    // smaller movements are not counted as reps
  elbowSwingDeg: 18,     // upper arm swing forward or back during a rep that counts as elbow swing
  partialPeakDeg: 75,    // a rep whose elbow flexion peaks below this is a partial rep
}, window.SENSOR_CONFIG);
