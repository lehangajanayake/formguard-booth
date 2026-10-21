"""Reads formguard-recording files into pandas tables."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

PACKET_COLUMNS = ["t_ms", "seq", "w", "x", "y", "z", "host_ms"]


@dataclass
class Recording:
    name: str
    label: str
    setup: str
    arm: str | None               # None: recorded before the arm side was chosen at calibration
    recorded_at: str
    has_raise: bool               # calibrated with the straight-arm raise (needed for right arms, any strap direction)
    start_host_ms: float
    end_host_ms: float
    config: dict
    packets: dict[str, pd.DataFrame]   # per board position: PACKET_COLUMNS plus t_s (seconds from recording start)
    frames: pd.DataFrame               # what the app derived per sample, plus t_s; empty for files without it
    rep_events: list[dict] = field(default_factory=list)   # the app's own rep detector events, as recorded

    @property
    def duration_s(self) -> float:
        return (self.end_host_ms - self.start_host_ms) / 1000

    @property
    def two_boards(self) -> bool:
        return "upper" in self.packets


def load_recording(source: str | Path | bytes, name: str | None = None) -> Recording:
    """Loads a recording from a path or the raw bytes of an uploaded file."""
    if isinstance(source, (str, Path)):
        name = name or Path(source).name
        data = json.loads(Path(source).read_text())
    else:
        data = json.loads(source)
    if data.get("format") != "formguard-recording":
        raise ValueError(f"{name}: not a formguard-recording file")

    start = float(data["start_host_ms"])
    columns = data.get("columns", PACKET_COLUMNS)
    packets = {}
    for pos, rows in data["packets"].items():
        df = pd.DataFrame(rows, columns=columns)
        df["t_s"] = (df["host_ms"] - start) / 1000
        packets[pos] = df

    derived = data.get("derived") or {}
    frames = pd.DataFrame(derived.get("frames", []), columns=derived.get("columns"))
    if not frames.empty:
        frames["t_s"] = (frames["host_ms"] - start) / 1000

    calibration = data.get("calibration") or {}
    return Recording(
        name=name or "recording.json",
        label=data.get("label") or "unlabelled",
        setup=data.get("setup", "?"),
        arm=data.get("arm") or calibration.get("arm"),
        recorded_at=data.get("recorded_at", ""),
        has_raise=bool(calibration.get("raise")),
        start_host_ms=start,
        end_host_ms=float(data.get("end_host_ms", start)),
        config=data.get("config", {}),
        packets=packets,
        frames=frames,
        rep_events=derived.get("rep_events", []),
    )
