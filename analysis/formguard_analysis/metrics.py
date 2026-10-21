"""Packet quality, angular speed from the raw quaternions, and per-rep tables."""
from __future__ import annotations

import numpy as np
import pandas as pd

from .detect import DetectorResult
from .load import Recording


def packet_stats(rec: Recording) -> pd.DataFrame:
    """Per board: packets, rate, packets lost (from gaps in the wrapping u8 seq) and the longest silence."""
    rows = []
    for pos, df in rec.packets.items():
        n = len(df)
        lost = int(((df["seq"].diff().dropna().astype(int) - 1) % 256).sum()) if n > 1 else 0
        span = df["host_ms"].iloc[-1] - df["host_ms"].iloc[0] if n > 1 else 0
        rows.append({
            "board": pos,
            "packets": n,
            "rate_hz": round(1000 * (n - 1) / span, 1) if span else 0.0,
            "lost": lost,
            "loss_pct": round(100 * lost / (n + lost), 2) if n else 0.0,
            "longest_gap_ms": round(float(df["host_ms"].diff().max()), 0) if n > 1 else 0.0,
        })
    return pd.DataFrame(rows)


def angular_speed(df: pd.DataFrame) -> pd.DataFrame:
    """Rotation speed of one board in deg/s, from consecutive orientation quaternions and the board's own clock."""
    q = df[["w", "x", "y", "z"]].to_numpy()
    if len(q) < 2:
        return pd.DataFrame({"t_s": [], "deg_s": []})
    a, b = q[:-1], q[1:]
    # relative rotation a^-1 * b: its scalar part is the dot product, its vector part's length the sine of half the angle
    w = np.abs(np.sum(a * b, axis=1))
    v = (a[:, :1] * b[:, 1:] - b[:, :1] * a[:, 1:] - np.cross(a[:, 1:], b[:, 1:]))
    angle = 2 * np.degrees(np.arctan2(np.linalg.norm(v, axis=1), w))
    dt = np.diff(df["t_ms"].to_numpy()) / 1000
    ok = dt > 0
    out = pd.DataFrame({"t_s": df["t_s"].to_numpy()[1:][ok], "deg_s": angle[ok] / dt[ok]})
    out["deg_s"] = out["deg_s"].rolling(3, center=True, min_periods=1).median()   # drops single-packet spikes
    return out


def rep_table(rec: Recording, result: DetectorResult, speeds: dict[str, pd.DataFrame], frames: pd.DataFrame) -> pd.DataFrame:
    """One row per counted rep, with what can be tuned against: range, timing, swing, position and speeds during the rep.

    start_forward_deg / max_forward_deg are the upper arm's angle forward of the calibration pose (not of the rep's
    start), so an elbow held forward for the whole set shows up there even though it does not swing.
    """
    rows = []
    for r in result.reps:
        during = frames[(frames["t_s"] >= r.start_s) & (frames["t_s"] <= r.end_s)]
        row = {
            "recording": rec.name,
            "label": rec.label,
            "rep": r.index,
            "start_s": round(r.start_s, 2),
            "bottom_deg": round(r.bottom_deg, 1),
            "peak_deg": round(r.peak_deg, 1),
            "range_deg": round(r.peak_deg - r.bottom_deg, 1),
            "lift_s": round(r.peak_s - r.start_s, 2),
            "lower_s": round(r.end_s - r.peak_s, 2),
            "swing_deg": round(r.swing_deg, 1),
            "abs_swing_deg": round(abs(r.swing_deg), 1),
            "start_forward_deg": round(r.ref_forward, 1),
            "max_forward_deg": round(float(during["upper_forward"].max()), 1) if len(during) else np.nan,
            "flagged": bool(r.faults),
        }
        for pos, sp in speeds.items():
            during = sp[(sp["t_s"] >= r.start_s) & (sp["t_s"] <= r.end_s)]
            row[f"peak_{pos}_speed_deg_s"] = round(float(during["deg_s"].max()), 0) if len(during) else np.nan
        rows.append(row)
    return pd.DataFrame(rows)


def threshold_sweep(reps: pd.DataFrame, metric: str, clean_labels: list[str], thresholds) -> pd.DataFrame:
    """For each threshold: % of reps from clean recordings that would be flagged, and % of the rest that would be."""
    clean = reps[reps["label"].isin(clean_labels)][metric].dropna()
    faulty = reps[~reps["label"].isin(clean_labels)][metric].dropna()
    rows = [{
        "threshold": t,
        "clean reps flagged %": 100 * float((clean > t).mean()) if len(clean) else np.nan,
        "other reps flagged %": 100 * float((faulty > t).mean()) if len(faulty) else np.nan,
    } for t in thresholds]
    return pd.DataFrame(rows)
