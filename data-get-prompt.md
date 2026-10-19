# Task: build a MyoSuite data generator for FormGuard bicep-curl form detection

## Context
FormGuard is a wearable that coaches lifting form. The current demo uses ONE IMU strapped to the forearm or wrist and must detect bad bicep curl reps from strangers at a booth, with no per-person baseline. I need a Python program that uses MyoSuite (MuJoCo musculoskeletal models) to generate large, labelled, realistic sensor recordings of bicep curls — clean and faulty — so the web app's rep counter and fault rules can be tested and tuned offline.

The repo is available to you. Read these before starting:
- `embedded/src/main.cpp` — the sensor firmware. It runs on a Seeed XIAO nRF52840 Sense (LSM6DS3, 6-axis: accel + gyro, NO magnetometer). It fuses accel+gyro with a quaternion EKF at ~100 Hz, gates accelerometer updates when |accel| deviates from 1 g by more than 0.3 g, and sends packets at ~50 Hz. Its calibrate command re-measures gyro bias while still and reseeds orientation from gravity.
- `frontend/js/sensor/forearm-estimator.js` — how the app turns quaternions into elbow flexion and forearm twist. Note its quaternion convention.
- `frontend/js/sensor/ble-link.js` — the packet format (u8 seq, u32 board ms, int16 w,x,y,z scaled by 32767).

## Approach
1. Use MyoSuite's `myoArm` model (MoBL-ARMS based). Inspect the model and list its joints — do not assume names (expected to include something like `elv_angle`, `shoulder_elv`, `shoulder_rot`, `elbow_flexion`, `pro_sup`, `deviation`, `flexion`). Use KINEMATIC playback: script joint trajectories, write `qpos`, call `mj_forward`. No muscle control or RL is needed.
2. The model has no torso joints. Emulate torso lean/swing by rotating the whole model about the shoulder/hip pivot in post-processing, and document how.
3. Add virtual sensor sites:
   - **wrist**: on the radius, just proximal to the wrist, like a watch (rotates fully with pronation/supination).
   - **forearm**: mid-forearm, lateral side. Document which body it is attached to and how it rotates with pro/sup.
   - **upper_arm** (for later two-sensor work): lateral upper arm, mid-humerus.
   Mount each board with one board axis pointing along the segment toward the distal end, chosen randomly per session from ±x / ±y, plus a random misalignment of 0–10° and a random roll about the segment axis within ±20°.
4. Compute ideal sensor signals at 1 kHz from the kinematics (finite differences of site orientation/position): gyro (deg/s, board frame) and specific force (accel in g, board frame, including gravity — at rest it reads +1 g "up"). Add realistic LSM6DS3 noise, gyro bias (constant + slow random walk), and scale/axis errors; document the values used. Downsample to the firmware loop rate (~100 Hz, with jitter).
5. Port the firmware's orientation filter from `embedded/src/main.cpp` to Python EXACTLY (same EKF, gains, gating, calibrate behaviour) and run the simulated IMU through it. Then emit packets at ~50 Hz (every second loop), quantised to int16/32767, with a wrapping u8 `seq`. Simulate BLE packet loss (0–3%, sometimes in short bursts) by dropping packets — keep `seq` gaps so loss is visible.
6. Write a unit test that proves the port matches the firmware on a few hand-made inputs (e.g. still board, pure rotation about one axis, 1 g linear shake).

## Quaternion convention (must match the app)
- Scalar-first `[w, x, y, z]`, unit length.
- Rotates BOARD-frame vectors into the WORLD frame. World +Z is up (gravity is −Z). Heading (yaw) is arbitrary and drifts, because there is no magnetometer — randomise the initial heading per session.
- Sanity test: with the board still, the app computes "up in board frame" as `[2(xz − wy), 2(wx + yz), 1 − 2(x² + y²)]`. For an arm hanging straight down with the mounting axis along the forearm toward the hand, that mounting axis must point opposite to "up". Include this as a test.

## Session script (each output file = one session)
1. ~1 s of settling, then the app's calibrate: board still, firmware calibrate (bias + reseed from gravity).
2. Calibration pose held still ~2 s: arm hanging straight at the side, elbow fully extended, upper arm vertical, palm facing the thigh (neutral forearm). Mark `calibration.start_ms`/`end_ms`.
3. 6–12 curl reps, then 1–3 s of rest. Optionally 2–5 s of non-rep motion (adjusting the strap, shaking the arm out, setting the dumbbell down, a half-start that is aborted) — these must NOT be labelled as reps.
Use minimum-jerk or similarly smooth profiles with natural variability between reps (timing, amplitude, small tremor). Grip during the curl is supinated or neutral (hammer), chosen per session; some people supinate during the lift.

## Per-rep parameters (sample continuously, store the true values)
- Bottom angle before/after (elbow flexion, 0 = straight): clean 0–20°, partial-bottom 25–70°.
- Peak elbow flexion: clean 120–150°, partial-top 60–115°.
- Concentric (lift) duration: clean 0.7–2.0 s; swinging 0.25–0.6 s with a fast start.
- Eccentric (lowering) duration: clean 1.2–3.0 s; dropping 0.3–1.0 s.
- Pause at top/bottom: 0–0.8 s.
- Shoulder flexion during the rep (elbow drifting forward): clean 0–8°; drift 15–45°, peaking near the top.
- Torso pitch swing (body English): clean 0–3°; swinging 8–25° forward/back, timed with the lift.
- Upper-arm abduction offset: 0–15° (not a fault).
- Mixed faults happen: allow 1–2 faults per rep.
Sample so that values densely cover BOTH sides of every threshold below, including near-boundary cases. Roughly 40% of reps clean, the rest faulty.

## Labels
Do NOT hard-code labels into the trajectory generator. Store the true continuous values per rep, and compute labels in a separate `label_rep(truth, thresholds)` function using a thresholds config file (YAML/JSON), so labels can be regenerated when thresholds change. Initial thresholds:
- `partial_top`: peak elbow flexion < 115°
- `partial_bottom`: bottom before or after the rep > 25°
- `drop`: eccentric duration < 1.0 s
- `swing`: peak concentric angular velocity > 300°/s OR concentric duration < 0.5 s OR torso swing > 8°
- `elbow_drift`: shoulder flexion change during the rep > 15°

## Output format (JSON, one file per session; the web app will read it as-is)
```json
{
  "format": "formguard-recording",
  "version": 1,
  "source": { "kind": "myosuite", "model": "myoArm", "generator_version": "x.y.z", "seed": 123 },
  "setup": "wrist",
  "sensors": {
    "wrist": { "mount_axis": "-y", "misalignment_deg": 4.2, "roll_deg": -11.0 }
  },
  "rate_hz": 50,
  "calibration": { "start_ms": 1200, "end_ms": 3200 },
  "packets": { "wrist": [[t_ms, seq, w, x, y, z], ...] },
  "reps": [
    {
      "index": 1, "start_ms": 4100, "peak_ms": 5000, "end_ms": 6900,
      "faults": ["partial_top"],
      "truth": {
        "bottom_before_deg": 8.1, "peak_elbow_deg": 98.4, "bottom_after_deg": 6.0,
        "concentric_ms": 900, "eccentric_ms": 1700, "peak_concentric_vel_dps": 210,
        "shoulder_flex_change_deg": 3.2, "torso_swing_deg": 1.1, "grip": "supinated"
      }
    }
  ],
  "non_rep_segments": [{ "start_ms": 15000, "end_ms": 18000, "kind": "strap_adjust" }],
  "truth_stream": {
    "t_ms": [...], "elbow_flexion_deg": [...], "shoulder_flexion_deg": [...],
    "pro_sup_deg": [...], "torso_pitch_deg": [...],
    "q_ideal": { "wrist": [[w, x, y, z], ...] }
  },
  "imu_raw": { "wrist": { "t_ms": [...], "accel_g": [[ax, ay, az], ...], "gyro_dps": [[gx, gy, gz], ...] } }
}
```
- `packets` are what the real board would send: firmware-filtered, quantised, with loss. `t_ms` is board time (monotonic, ms).
- `setup` is one of `wrist`, `forearm`, `upper+wrist`, `upper+forearm`. Two-sensor setups include both streams sampled on the same board clock.
- `imu_raw` is optional (flag) because it is large.
- Write files as `out/<setup>/<session_id>.json`, plus `out/manifest.csv` (one row per session) and `out/reps.csv` (one row per rep: all truth values + labels) for threshold histograms.

## Deliverables
- A Python package + CLI, e.g. `python -m fg_sim generate --sessions 300 --setup wrist --seed 1 --out out/`, and `python -m fg_sim relabel --thresholds thresholds.yaml out/`.
- Configurable everything: session count, setups, fault mix, noise levels, threshold file, seed. Fully reproducible from the seed.
- Tests: firmware-filter port vs. hand-made cases, quaternion convention, label function, and "a clean rep with upper arm vertical never reports forearm angle > 155°".
- A validation script that, for a few sessions, plots true elbow flexion vs. elbow flexion recovered from `packets` using the same maths as `forearm-estimator.js` (port it), and reports the error. Large errors during fast swings are expected (accel gating) — report them, don't hide them.
- A README covering: install (pin MyoSuite and MuJoCo versions), the model and sites, the noise model, assumptions and known gaps vs. real humans.

## Constraints
- Python 3.10+, pinned dependencies, runs headless on macOS (Apple Silicon) and Linux. No GPU needed.
- Don't modify anything under `frontend/` or `embedded/`. Put the tool in a new top-level `sim/` folder.
- If MyoSuite's myoArm can't be made to work for some part (e.g. torso), say so in the README and use the simplest honest substitute; keep the generator independent of the model so another kinematic model can be swapped in.
- Report anything you had to guess (joint names, axis directions, noise values) instead of silently assuming it.
