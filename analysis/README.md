# FormGuard recording analysis

A Streamlit app for the JSON files the Live page's **Record** button saves (`formguard_<setup>_<label>_<time>.json`).
Use it to see what the app measured and to choose thresholds for the form check.

## Run

```sh
cd analysis
uv venv --python 3.11 .venv && uv pip install --python .venv/bin/python -r requirements.txt   # once
.venv/bin/streamlit run app.py
```

Without uv: `python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt`.

The app reads every `formguard_*.json` in a folder (default `~/Downloads`; change it in the sidebar), or files you
add with the uploader. Recordings are not committed: `*.json` is in `.gitignore`.

## What it shows

- **Recordings:** each file's label, arm, whether it had the arm-raise calibration, packet rate and loss, and the
  reps the app counted live next to the reps the replay counts. It warns about recordings made before the raise step,
  where forward and back are only right for a left arm, and about low packet rates.
- **One recording:** four panels on one time axis:
  - elbow flexion
  - upper arm position (forward/back, out/in)
  - swing from each rep's starting position, with the threshold
  - each board's rotation speed, worked out from the raw quaternions

  Counted reps are shaded red when flagged and grey when in range. Below the panels: a table of reps, packet stats and
  the settings the app was using.
- **Compare reps:**
  - one dot per rep for each label, for any measure (swing, position from the calibration pose, speeds, range,
    lift and lowering times)
  - a summary per label
  - a threshold sweep: choose which labels should be clean, and see what share of clean and other reps each
    threshold would flag
  - a CSV download of every rep

## How the numbers are made

The angles are the app's own per-sample output (`derived.frames` in the file), so they are exactly what the Live
page showed. Reps are found again in Python by [`formguard_analysis/detect.py`](formguard_analysis/detect.py), a
line-for-line port of `frontend/js/form/rep-detector.js`. That means the sidebar sliders show what other thresholds
would have flagged. If you change the JS detector, change the port too. The Recordings tab's "reps (app, live)"
against "reps (replay)" columns are a quick check that the two still agree.

One known difference: the app's detector keeps running between recordings, so a recording can begin part-way
through a rep. The replay treats the start of each recording as a rest between reps, so the first rep can differ.

Board rotation speeds come from the raw packets alone (the relative rotation between consecutive quaternions, timed
by the board's clock), with a 3-sample median to drop single-packet spikes.

## Limits

- Every rep takes its recording's label. A clean rep inside a "wrong" recording counts against the threshold, so
  check the One recording tab for those.
- With one person's recordings, treat any threshold as a starting point.
- Recordings made before the arm-raise calibration can't be fully corrected. The sidebar can flip their
  forward/back direction, but their elbow angles may still read high while the upper arm swings.
