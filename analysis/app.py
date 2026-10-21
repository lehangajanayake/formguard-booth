"""FormGuard recording explorer: look at booth recordings and choose form-check thresholds.

Run:  .venv/bin/streamlit run app.py
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st
from plotly.subplots import make_subplots

from formguard_analysis.detect import DEFAULTS, detect_reps
from formguard_analysis.load import Recording, load_recording
from formguard_analysis.metrics import angular_speed, packet_stats, rep_table, threshold_sweep

# Colours: red only marks a fault (the FormGuard rule); everything else is neutral or a categorical series colour.
FAULT = "#C62B22"
NEUTRAL = "#8A8378"
SERIES = ["#2a78d6", "#eb6834"]   # categorical slots 1-2, validated pair
GRID = "rgba(138,131,120,0.25)"

st.set_page_config(page_title="FormGuard recordings", layout="wide")


# ---------- loading ----------

@st.cache_data(show_spinner=False)
def _load_path(path: str, mtime: float) -> Recording:
    return load_recording(path)


@st.cache_data(show_spinner=False)
def _load_bytes(data: bytes, name: str) -> Recording:
    return load_recording(data, name)


@st.cache_data(show_spinner=False)
def _speeds(_rec: Recording, key: str) -> dict[str, pd.DataFrame]:
    return {pos: angular_speed(df) for pos, df in _rec.packets.items()}


def analyse(rec: Recording, thresholds: dict, flip_old: bool):
    """Replays the rep detector over the app's per-sample angles. Returns (result, reps table, speeds, frames)."""
    frames = rec.frames.copy()
    if frames.empty or frames["upper_forward"].isna().all():
        return None, pd.DataFrame(), _speeds(rec, rec.name), frames
    if flip_old and not rec.has_raise:
        frames["upper_forward"] = -frames["upper_forward"]
    result = detect_reps(frames["t_s"], frames["elbow"], frames["upper_forward"], thresholds)
    frames["swing_replay"] = result.swing_now
    speeds = _speeds(rec, rec.name)
    return result, rep_table(rec, result, speeds, frames), speeds, frames


with st.sidebar:
    st.header("Recordings")
    folder = st.text_input("Folder", str(Path.home() / "Downloads"),
                           help="Searched for formguard_*.json, the files the Live page's Record button saves.")
    paths = sorted(Path(folder).expanduser().glob("formguard_*.json")) if Path(folder).expanduser().is_dir() else []
    chosen = st.multiselect("Files", [p.name for p in paths], default=[p.name for p in paths])
    uploads = st.file_uploader("Or add files", type="json", accept_multiple_files=True)

    st.header("Rep detector")
    st.caption("Same rules as the app (frontend/js/form/rep-detector.js). Change them to see what they would have flagged.")
    thresholds = {
        "elbowSwingDeg": st.slider("Elbow swing threshold (°)", 5.0, 45.0, DEFAULTS["elbowSwingDeg"], 0.5),
        "partialPeakDeg": st.slider("Partial rep: peak elbow below (°)", 40.0, 140.0, DEFAULTS["partialPeakDeg"], 1.0),
        "repRiseDeg": st.slider("Rep start / lowering hysteresis (°)", 10.0, 45.0, DEFAULTS["repRiseDeg"], 1.0),
        "repEndDeg": st.slider("Arm counts as straight below (°)", 5.0, 45.0, DEFAULTS["repEndDeg"], 1.0),
        "repMinRangeDeg": st.slider("Smallest movement counted as a rep (°)", 20.0, 100.0, DEFAULTS["repMinRangeDeg"], 1.0),
    }
    flip_old = st.checkbox(
        "Flip forward/back for recordings without the arm-raise calibration", value=False,
        help="Recordings made before the raise step assumed a left arm, so on a right arm forward and back are swapped. "
             "Their elbow angles may also be too high while the upper arm swings; that cannot be undone here.")

recs: list[Recording] = []
errors = []
for name in chosen:
    p = Path(folder).expanduser() / name
    try:
        recs.append(_load_path(str(p), p.stat().st_mtime))
    except Exception as e:  # noqa: BLE001 - show any unreadable file and carry on with the rest
        errors.append(f"{name}: {e}")
for up in uploads or []:
    try:
        recs.append(_load_bytes(up.getvalue(), up.name))
    except Exception as e:  # noqa: BLE001
        errors.append(f"{up.name}: {e}")
for e in errors:
    st.error(e)

st.title("FormGuard recordings")
if not recs:
    st.info("No recordings yet. Point the sidebar at the folder your browser saves downloads to, or add files.")
    st.stop()

analysed = {r.name: analyse(r, thresholds, flip_old) for r in recs}
all_reps = pd.concat([a[1] for a in analysed.values() if not a[1].empty], ignore_index=True) \
    if any(not a[1].empty for a in analysed.values()) else pd.DataFrame()

tab_overview, tab_one, tab_compare = st.tabs(["Recordings", "One recording", "Compare reps"])


# ---------- tab: overview ----------

with tab_overview:
    rows = []
    for r in recs:
        result, reps, _, _ = analysed[r.name]
        stats = packet_stats(r)
        app_reps = [e for e in r.rep_events if e["type"] == "rep"]
        rows.append({
            "file": r.name,
            "label": r.label,
            "setup": r.setup,
            "arm": r.arm or "not recorded",
            "raise calibration": "yes" if r.has_raise else "no",
            "length (s)": round(r.duration_s, 1),
            "rate (Hz)": stats["rate_hz"].min() if len(stats) else 0,
            "lost packets": int(stats["lost"].sum()) if len(stats) else 0,
            "reps (app, live)": len(app_reps),
            "reps (replay)": len(reps),
            "flagged (replay)": int(reps["flagged"].sum()) if len(reps) else 0,
        })
    st.dataframe(pd.DataFrame(rows), hide_index=True, use_container_width=True)

    old = [r.label for r in recs if r.two_boards and not r.has_raise]
    if old:
        st.warning(f"Recorded before the arm-raise calibration: {', '.join(old)}. Their forward/back direction is only "
                   "right for a left arm, and elbow angles can read high while the upper arm swings. Re-record if you can.")
    slow = [r.label for r in recs if len(packet_stats(r)) and packet_stats(r)["rate_hz"].min() < 40]
    if slow:
        st.warning(f"Fewer than 40 packets a second in: {', '.join(slow)}. The firmware is meant to send about 50. "
                   "Fast swings are sampled coarsely, so peak speeds and the moment a fault is flagged are approximate.")
    st.caption("“Reps (app, live)” counts what the Live page counted while recording; the replay starts fresh at the "
               "start of each recording, so the first rep can differ if the app was already part-way through one.")


# ---------- tab: one recording ----------

def rep_shapes(fig, reps: pd.DataFrame, rows: int):
    """Shades each counted rep across every panel: neutral when in range, red when flagged, numbered at the top."""
    for _, r in reps.iterrows():
        end = r["start_s"] + r["lift_s"] + r["lower_s"]
        fig.add_vrect(x0=r["start_s"], x1=end, fillcolor=FAULT if r["flagged"] else NEUTRAL,
                      opacity=0.14 if r["flagged"] else 0.10, line_width=0, layer="below", row="all", col=1)
        fig.add_annotation(x=(r["start_s"] + end) / 2, y=1.0, yref="paper", text=str(int(r["rep"])), showarrow=False,
                           font=dict(size=12, color=FAULT if r["flagged"] else None), yanchor="bottom")


with tab_one:
    choices = {f"{r.label}  ·  {r.name}": r.name for r in recs}
    name = choices[st.selectbox("Recording", list(choices))]
    rec = next(r for r in recs if r.name == name)
    result, reps, speeds, frames = analysed[name]

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Label", rec.label)
    c2.metric("Reps", len(reps))
    c3.metric("Flagged reps", int(reps["flagged"].sum()) if len(reps) else 0)
    c4.metric("Largest swing", f"{reps['abs_swing_deg'].max():.0f}°" if len(reps) else "–")

    if frames.empty:
        st.info("This recording has no derived angles (it was recorded before the app stored them). Only packet quality "
                "and board speeds are shown.")
    panels = ["Elbow flexion (°)", "Upper arm position (°)", "Swing from the rep's start (°)", "Board rotation speed (°/s)"]
    fig = make_subplots(rows=4, cols=1, shared_xaxes=True, vertical_spacing=0.05, subplot_titles=panels)
    if not frames.empty:
        fig.add_trace(go.Scatter(x=frames["t_s"], y=frames["elbow"], name="Elbow", line=dict(color=SERIES[0], width=2),
                                 showlegend=False, hovertemplate="%{y:.0f}°"), row=1, col=1)
        if frames["upper_forward"].notna().any():
            fig.add_trace(go.Scatter(x=frames["t_s"], y=frames["upper_forward"], name="Forward (+) / back (−)",
                                     line=dict(color=SERIES[0], width=2), legendgroup="pos", hovertemplate="%{y:.0f}°"), row=2, col=1)
            fig.add_trace(go.Scatter(x=frames["t_s"], y=frames["upper_out"], name="Out (+) / in (−)",
                                     line=dict(color=SERIES[1], width=2), legendgroup="pos", hovertemplate="%{y:.0f}°"), row=2, col=1)
        if "swing_replay" in frames:
            fig.add_trace(go.Scatter(x=frames["t_s"], y=frames["swing_replay"], name="Swing", showlegend=False,
                                     line=dict(color=SERIES[0], width=2), connectgaps=False, hovertemplate="%{y:.0f}°"), row=3, col=1)
            for sign in (1, -1):
                fig.add_hline(y=sign * thresholds["elbowSwingDeg"], line=dict(color=FAULT, width=1, dash="dash"), row=3, col=1)
    for i, (pos, sp) in enumerate(speeds.items()):
        fig.add_trace(go.Scatter(x=sp["t_s"], y=sp["deg_s"], name=f"{pos.capitalize()} board",
                                 line=dict(color=SERIES[i % 2], width=2), hovertemplate="%{y:.0f}°/s"), row=4, col=1)
    if len(reps):
        rep_shapes(fig, reps, 4)
    fig.update_layout(height=820, hovermode="x unified", margin=dict(t=60, l=10, r=10, b=10),
                      legend=dict(orientation="h", yanchor="bottom", y=1.04, x=0))
    fig.update_xaxes(gridcolor=GRID, zeroline=False)
    fig.update_yaxes(gridcolor=GRID, zeroline=False)
    fig.update_xaxes(title_text="Seconds from start of recording", row=4, col=1)
    st.plotly_chart(fig, use_container_width=True, theme="streamlit")
    st.caption("Shaded bands are counted reps: red when flagged at the current threshold, grey when in range. Dashed red "
               "lines are ± the swing threshold. Speeds come straight from the raw quaternions, not from the app.")

    if len(reps):
        st.subheader("Reps")
        st.dataframe(reps.drop(columns=["recording", "label"]), hide_index=True, use_container_width=True)

    with st.expander("Packets and calibration"):
        st.dataframe(packet_stats(rec), hide_index=True, use_container_width=True)
        st.write({"arm": rec.arm, "raise calibration": rec.has_raise, "recorded at": rec.recorded_at,
                  "settings in the app": rec.config})


# ---------- tab: compare ----------

with tab_compare:
    if all_reps.empty:
        st.info("No reps found in these recordings with the current detector settings.")
        st.stop()

    metrics = {
        "abs_swing_deg": "Largest upper arm swing (°)",
        "max_forward_deg": "Upper arm forward of calibration pose, max in rep (°)",
        "start_forward_deg": "Upper arm forward of calibration pose, at rep start (°)",
        "peak_upper_speed_deg_s": "Peak upper arm board speed (°/s)",
        "peak_forearm_speed_deg_s": "Peak forearm board speed (°/s)",
        "range_deg": "Elbow range of motion (°)",
        "peak_deg": "Peak elbow flexion (°)",
        "lift_s": "Lift time (s)",
        "lower_s": "Lowering time (s)",
    }
    metrics = {k: v for k, v in metrics.items() if k in all_reps}
    metric = st.selectbox("Measure", list(metrics), format_func=metrics.get)
    labels = sorted(all_reps["label"].unique())

    # one dot per rep, one column per label; red X = flagged at the current threshold
    rng = np.random.default_rng(0)
    fig = go.Figure()
    for flagged, sym, colour, nm in [(False, "circle", NEUTRAL, "In range"), (True, "x", FAULT, "Flagged")]:
        d = all_reps[all_reps["flagged"] == flagged]
        if d.empty:
            continue
        x = d["label"].map({l: i for i, l in enumerate(labels)}) + rng.uniform(-0.18, 0.18, len(d))
        fig.add_trace(go.Scatter(
            x=x, y=d[metric], mode="markers", name=nm, marker=dict(color=colour, size=10, symbol=sym, line=dict(width=0)),
            customdata=np.stack([d["label"], d["rep"], d["recording"], d["faults"].replace("", "in range")], axis=1),
            hovertemplate="%{customdata[0]} · rep %{customdata[1]}<br>%{y:.1f} · %{customdata[3]}<extra>%{customdata[2]}</extra>"))
    line_at = {"abs_swing_deg": thresholds["elbowSwingDeg"], "peak_deg": thresholds["partialPeakDeg"]}.get(metric)
    if line_at is not None:
        fig.add_hline(y=line_at, line=dict(color=FAULT, width=1, dash="dash"),
                      annotation_text=f"threshold {line_at:g}°", annotation_position="top left")
    fig.update_layout(height=460, margin=dict(t=30, l=10, r=10, b=10), yaxis_title=metrics[metric],
                      legend=dict(orientation="h", yanchor="bottom", y=1.02, x=0),
                      xaxis=dict(tickmode="array", tickvals=list(range(len(labels))), ticktext=labels, gridcolor=GRID))
    fig.update_yaxes(gridcolor=GRID, zeroline=False)
    st.plotly_chart(fig, use_container_width=True, theme="streamlit")

    summary = all_reps.groupby("label").agg(
        reps=("rep", "size"), flagged=("flagged", "sum"),
        elbow_swing=("elbow_swing", "sum"), partial_rep=("partial_rep", "sum"),
        median=(metric, "median"), min=(metric, "min"), max=(metric, "max")).reset_index()
    summary["flagged %"] = (100 * summary["flagged"] / summary["reps"]).round(0)
    st.dataframe(summary.round(1), hide_index=True, use_container_width=True)

    st.subheader("Choose a threshold")
    clean = st.multiselect("Recordings whose reps should all be in range", labels,
                           default=[l for l in labels if "clean" in l.lower()],
                           help="Every other label counts as reps that should be flagged.")
    if clean and set(clean) != set(labels):
        lo, hi = float(all_reps[metric].min()), float(all_reps[metric].max())
        steps = np.linspace(lo, hi, 80)
        sweep = threshold_sweep(all_reps, metric, clean, steps)
        fig = go.Figure()
        for i, col in enumerate(["clean reps flagged %", "other reps flagged %"]):
            fig.add_trace(go.Scatter(x=sweep["threshold"], y=sweep[col], name=col.replace(" %", ""),
                                     line=dict(color=SERIES[i], width=2), hovertemplate="%{y:.0f}%"))
        if metric == "abs_swing_deg":
            fig.add_vline(x=thresholds["elbowSwingDeg"], line=dict(color=FAULT, width=1, dash="dash"))
        fig.update_layout(height=360, hovermode="x unified", margin=dict(t=30, l=10, r=10, b=10),
                          xaxis_title=f"Threshold: {metrics[metric]}", yaxis_title="Reps flagged (%)",
                          yaxis=dict(range=[0, 102], gridcolor=GRID), legend=dict(orientation="h", yanchor="bottom", y=1.02, x=0))
        fig.update_xaxes(gridcolor=GRID)
        st.plotly_chart(fig, use_container_width=True, theme="streamlit")

        clean_vals = all_reps[all_reps["label"].isin(clean)][metric]
        other_vals = all_reps[~all_reps["label"].isin(clean)][metric]
        gap_lo, gap_hi = clean_vals.max(), other_vals.min()
        if gap_lo < gap_hi:
            st.success(f"Clean reps reach at most {gap_lo:.1f}; the rest start at {gap_hi:.1f}. "
                       f"Any threshold between them separates these recordings; the middle is {(gap_lo + gap_hi) / 2:.1f}.")
        else:
            st.warning(f"The groups overlap: clean reps reach {gap_lo:.1f}, the rest start at {gap_hi:.1f}. "
                       "Pick from the curves above, or look at another measure. With one person, treat any number here "
                       "as a starting point.")
        st.caption("Threshold choice works on whole recordings: every rep inherits its recording's label, so a clean rep "
                   "inside a ‘wrong’ recording counts as a miss. Check the One recording tab for those.")
    else:
        st.caption("Pick at least one label that should be in range, and leave at least one that should not.")

    st.download_button("Download all reps as CSV", all_reps.to_csv(index=False), "formguard_reps.csv", "text/csv")
