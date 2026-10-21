"""A line-for-line port of frontend/js/form/rep-detector.js, so thresholds can be tried on recorded sessions.

Keep the two in step: replaying a recording with the app's own thresholds should give the reps the app counted live
(the Recordings tab compares them).

One difference: the app's detector keeps running between recordings, so a recording can start mid-set with the arm never
straight. By default the replay treats the start of a recording as a rest between reps (`from_rest=True`); the app's
own first rep may then differ if it was already under way when recording started.
"""
from __future__ import annotations

from dataclasses import dataclass, field

DEFAULTS = {"repRiseDeg": 25.0, "repEndDeg": 20.0, "repMinRangeDeg": 30.0, "elbowSwingDeg": 18.0, "partialPeakDeg": 75.0}


@dataclass
class Rep:
    start_s: float
    bottom_deg: float
    ref_forward: float
    peak_s: float = 0.0
    peak_deg: float = 0.0
    end_s: float = 0.0
    swing_deg: float = 0.0           # largest upper arm swing from the reference, signed: + forward, - back
    fault_s: float | None = None     # when the swing first crossed the threshold
    index: int = 0
    faults: list[str] = field(default_factory=list)


@dataclass
class DetectorResult:
    reps: list[Rep]
    aborted: list[Rep]
    swing_now: list[float | None]    # per frame, like the app's swing_now column
    phase: list[str]


def detect_reps(t_s, elbow, forward, thresholds: dict | None = None, from_rest: bool = True) -> DetectorResult:
    """Runs the rep detector over per-sample elbow flexion and upper arm forward angles (degrees).

    from_rest: start between reps at the first sample, rather than waiting for the arm to be straight like the app does
    when the Live page opens.
    """
    th = {**DEFAULTS, **(thresholds or {})}
    rise, end, min_range, swing_th = th["repRiseDeg"], th["repEndDeg"], th["repMinRangeDeg"], th["elbowSwingDeg"]
    partial_peak = th["partialPeakDeg"]

    phase, valley, rep, count = "wait", None, None, 0
    reps, aborted, swings, phases = [], [], [], []

    def start(t):
        e, f = valley
        return Rep(start_s=t, bottom_deg=e, ref_forward=f, peak_s=t, peak_deg=e)

    for t, e, f in zip(t_s, elbow, forward):
        swing_now = None
        if from_rest and valley is None:
            phase, valley = "bottom", (e, f)
        if phase == "wait":
            if e < end:
                phase, valley = "bottom", (e, f)
        elif phase == "bottom":
            if e < valley[0]:
                valley = (e, f)
            elif e > valley[0] + rise:
                phase, rep = "lift", start(t)
        else:
            swing_now = f - rep.ref_forward
            if abs(swing_now) > abs(rep.swing_deg):
                rep.swing_deg = swing_now
            if "elbow_swing" not in rep.faults and abs(swing_now) > swing_th:
                rep.faults.append("elbow_swing")
                rep.fault_s = t
            if phase == "lift":
                if e > rep.peak_deg:
                    rep.peak_deg, rep.peak_s = e, t
                elif e < rep.peak_deg - rise:
                    phase, valley = "lower", (e, f)
                    if rep.peak_deg < partial_peak:
                        rep.faults.append("partial_rep")
            else:
                if e < valley[0]:
                    valley = (e, f)
                straight, next_rep = e < end, e > valley[0] + rise
                if straight or next_rep:
                    rep.end_s = t
                    if rep.peak_deg - rep.bottom_deg >= min_range:
                        count += 1
                        rep.index = count
                        reps.append(rep)
                    else:
                        aborted.append(rep)
                    if straight:
                        phase, valley, rep = "bottom", (e, f), None
                    else:
                        phase, rep = "lift", start(t)
        swings.append(swing_now)
        phases.append(phase)
    return DetectorResult(reps, aborted, swings, phases)
