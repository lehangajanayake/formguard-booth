"""Use YOLO pose keypoints to align booth videos with FormGuard IMU recordings."""
from __future__ import annotations

import argparse
import json
import math
import os
from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "site" / "sync.json"
PAIRINGS = {
    "clean": {
        "video": ROOT / "site" / "media" / "clean-curl.mp4",
        "recording": ROOT / "data" / "formguard_upper+forearm_clean-nidula_20261021-081458.json",
        # The recorded IMU starts as the first curl begins in the video.
        "anchor_sensor_seconds": 0.0,
        "refine_curl_seconds": 45.0,
    },
    "swing": {
        "video": ROOT / "site" / "media" / "elbow-swing.mp4",
        "recording": ROOT / "data" / "formguard_upper+forearm_wong-swing-arm-nidula_20261021-081551.json",
    },
}


def flexion_degrees(shoulder: np.ndarray, elbow: np.ndarray, wrist: np.ndarray) -> float:
    upper = shoulder - elbow
    forearm = wrist - elbow
    denominator = np.linalg.norm(upper) * np.linalg.norm(forearm)
    if denominator < 1e-5:
        return math.nan
    cosine = float(np.clip(np.dot(upper, forearm) / denominator, -1.0, 1.0))
    return 180.0 - math.degrees(math.acos(cosine))


def shoulder_raise_degrees(shoulder: np.ndarray, elbow: np.ndarray, hip: np.ndarray) -> float:
    """Estimate arm raise from hanging down (0°) relative to the torso (about 90° forward)."""
    arm = elbow - shoulder
    torso = hip - shoulder
    denominator = np.linalg.norm(arm) * np.linalg.norm(torso)
    if denominator < 1e-5:
        return math.nan
    cosine = float(np.clip(np.dot(arm, torso) / denominator, -1.0, 1.0))
    return math.degrees(math.acos(cosine))


def get_video_pose(model: YOLO, path: Path, sample_hz: float, imgsz: int, device: str | None, max_seconds: float | None = None):
    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        raise RuntimeError(f"Could not open video: {path}")
    fps = float(capture.get(cv2.CAP_PROP_FPS)) or 30.0
    frame_step = max(1, round(fps / sample_hz))
    candidates = {
        "left": {"time": [], "angle": [], "raise": [], "confidence": []},
        "right": {"time": [], "angle": [], "raise": [], "confidence": []},
    }
    frame_number = 0
    sampled_frames = 0
    max_frames = round(max_seconds * fps) if max_seconds is not None else None
    try:
        while True:
            if max_frames is not None and frame_number >= max_frames:
                break
            ok, image = capture.read()
            if not ok:
                break
            if frame_number % frame_step == 0:
                time_s = frame_number / fps
                result = model.predict(image, imgsz=imgsz, device=device, conf=0.15, verbose=False)[0]
                keypoints = result.keypoints.data.cpu().numpy() if result.keypoints is not None else np.empty((0, 17, 3))
                for side, indices, hip_index in (("left", (5, 7, 9), 11), ("right", (6, 8, 10), 12)):
                    best = (math.nan, 0.0)
                    best_raise = math.nan
                    for person in keypoints:
                        shoulder, elbow, wrist = (person[index] for index in indices)
                        conf = float(min(shoulder[2], elbow[2], wrist[2]))
                        if conf < 0.25:
                            continue
                        angle = flexion_degrees(shoulder[:2], elbow[:2], wrist[:2])
                        if math.isfinite(angle) and conf > best[1]:
                            best = (angle, conf)
                            hip = person[hip_index]
                            if float(hip[2]) >= 0.25:
                                best_raise = shoulder_raise_degrees(shoulder[:2], elbow[:2], hip[:2])
                    candidates[side]["time"].append(time_s)
                    candidates[side]["angle"].append(best[0])
                    candidates[side]["raise"].append(best_raise)
                    candidates[side]["confidence"].append(best[1])
                sampled_frames += 1
            frame_number += 1
    finally:
        capture.release()

    best_side = None
    best_quality = -1.0
    for side, candidate in candidates.items():
        values = np.asarray(candidate["angle"], dtype=float)
        conf = np.asarray(candidate["confidence"], dtype=float)
        valid = np.isfinite(values) & (conf >= 0.25)
        if int(valid.sum()) < 12:
            continue
        spread = float(np.percentile(values[valid], 90) - np.percentile(values[valid], 10))
        quality = float(valid.mean() * conf[valid].mean() * min(spread, 45.0))
        if quality > best_quality:
            best_quality = quality
            best_side = side

    if best_side is None:
        raise RuntimeError(f"YOLO did not find a visible shoulder, elbow, and wrist in {path.name}")
    selected = candidates[best_side]
    times = np.asarray(selected["time"], dtype=float)
    values = np.asarray(selected["angle"], dtype=float)
    confidence = np.asarray(selected["confidence"], dtype=float)
    raise_angle = np.asarray(selected["raise"], dtype=float)
    valid = np.isfinite(values) & (confidence >= 0.25)
    if valid.sum() < 12:
        raise RuntimeError(f"Too few confident {best_side} arm poses in {path.name}")

    # Fill brief missed detections for correlation while retaining the original confidence count.
    values = np.interp(times, times[valid], values[valid])
    raise_valid = np.isfinite(raise_angle)
    if raise_valid.any():
        raise_angle = np.interp(times, times[raise_valid], raise_angle[raise_valid])
    else:
        raise_angle = np.zeros_like(times)
    window = max(1, round(sample_hz * 0.6))
    if window > 1:
        values = np.convolve(values, np.ones(window) / window, mode="same")
        raise_angle = np.convolve(raise_angle, np.ones(window) / window, mode="same")
    return times, values, raise_angle, {
        "side": best_side,
        "fps": round(fps, 6),
        "valid_pose_fraction": round(float(valid.mean()), 4),
        "mean_keypoint_confidence": round(float(confidence[valid].mean()), 4),
        "sampled_frames": sampled_frames,
        "video_duration_seconds": round(float(times[-1]), 3),
    }


def detect_calibration(video_t: np.ndarray, elbow_angle: np.ndarray, raise_angle: np.ndarray):
    """Detect the initial straight-arm raise-to-about-90° and return-to-side gesture."""
    step = float(np.median(np.diff(video_t))) if len(video_t) > 1 else 0.2
    # Calibration starts with an extended elbow and the arm moving away from the torso.
    candidate = (elbow_angle <= 42.0) & (raise_angle >= 24.0)
    for start in np.flatnonzero(candidate):
        peak_end = min(len(video_t), start + round(8.0 / max(step, 1e-3)))
        local_raise = raise_angle[start:peak_end]
        if len(local_raise) < 3:
            continue
        peak = start + int(np.argmax(local_raise))
        peak_value = float(raise_angle[peak])
        if peak_value < 48.0:
            continue
        # A calibration raise is complete only after the straight arm comes back down.
        returned = np.flatnonzero(raise_angle[peak + 1:] <= 22.0)
        if not len(returned):
            continue
        end = peak + 1 + int(returned[0])
        if video_t[end] - video_t[start] < 0.7:
            continue
        return float(video_t[start]), float(video_t[end]), peak_value
    return 0.0, 0.0, 0.0


def detect_curl_start(video_t: np.ndarray, elbow_angle: np.ndarray, after: float) -> float:
    """Find the first sustained elbow bend after calibration from YOLO's pose angles."""
    step = float(np.median(np.diff(video_t))) if len(video_t) > 1 else 0.2
    window = max(5, round(1.2 / max(step, 1e-3)))
    first = int(np.searchsorted(video_t, after, side="left"))
    for index in range(first, max(first, len(video_t) - window + 1)):
        segment = elbow_angle[index:index + window]
        span = float(np.percentile(segment, 90) - np.percentile(segment, 10))
        if span >= 25.0:
            return float(video_t[index])
    return float(after)


def detect_curl_cycle_starts(video_t: np.ndarray, elbow_angle: np.ndarray, after: float) -> list[float]:
    """Find low points that begin a sustained curl, deduplicated to one start per rep."""
    step = float(np.median(np.diff(video_t))) if len(video_t) > 1 else 0.2
    radius = max(2, round(0.45 / max(step, 1e-3)))
    rise_window = max(radius * 2, round(1.8 / max(step, 1e-3)))
    first = max(radius, int(np.searchsorted(video_t, after, side="left")))
    candidates = []
    for index in range(first, len(video_t) - rise_window):
        local = elbow_angle[index - radius:index + radius + 1]
        if elbow_angle[index] > float(np.min(local)) + 0.05:
            continue
        if float(np.max(elbow_angle[index:index + rise_window + 1]) - elbow_angle[index]) >= 25.0:
            candidates.append(index)

    starts = []
    for index in candidates:
        if starts and video_t[index] - video_t[starts[-1]] < 2.5:
            if elbow_angle[index] < elbow_angle[starts[-1]]:
                starts[-1] = index
            continue
        starts.append(index)
    return [float(video_t[index]) for index in starts]


def align(video_t: np.ndarray, video_angle: np.ndarray, raise_angle: np.ndarray, sensor_t: np.ndarray, sensor_angle: np.ndarray):
    """Align YOLO curl motion to IMU data after any detected straight-arm calibration gesture."""
    calibration_start, calibration_end, calibration_peak = detect_calibration(video_t, video_angle, raise_angle)
    exercise_start = detect_curl_start(video_t, video_angle, calibration_end)
    active = video_t >= exercise_start
    fit_t = video_t[active]
    fit_angle = video_angle[active]
    video_duration = float(fit_t[-1] - fit_t[0])
    sensor_duration = float(sensor_t[-1])
    nominal = sensor_duration / max(video_duration, 1e-6)
    # Let the detected motion cadence outrank a whole-clip duration ratio: the phone
    # footage may include exercise that was not present in the shorter sensor capture.
    scales = np.linspace(max(0.05, nominal * 0.7), nominal * 1.6, 140)
    best = None

    for scale in scales:
        # The first active YOLO motion should line up with the start of the IMU capture.
        offsets = np.arange(-fit_t[0] * scale - 8.0, -fit_t[0] * scale + 8.01, 0.08)
        for offset in offsets:
            mapped = fit_t * scale + offset
            inside = (mapped >= sensor_t[0]) & (mapped <= sensor_t[-1])
            if int(inside.sum()) < 30:
                continue
            overlap_video = float((fit_t[inside][-1] - fit_t[inside][0]) / max(video_duration, 1e-6))
            overlap_sensor = float((mapped[inside][-1] - mapped[inside][0]) / max(sensor_duration, 1e-6))
            if overlap_video < 0.5 or overlap_sensor < 0.7:
                continue
            observed = fit_angle[inside]
            expected = np.interp(mapped[inside], sensor_t, sensor_angle)
            if np.std(observed) < 2.0 or np.std(expected) < 2.0:
                continue
            corr = float(np.corrcoef(observed, expected)[0, 1])
            quality = abs(corr) * math.sqrt(min(1.0, overlap_video) * min(1.0, overlap_sensor))
            if best is None or quality > best["quality"]:
                best = {
                    "scale_seconds_per_video_second": float(scale),
                    "offset_seconds": float(offset),
                    "calibration_start_video_seconds": calibration_start,
                    "calibration_end_video_seconds": calibration_end,
                    "calibration_peak_shoulder_raise_degrees": calibration_peak,
                    "exercise_start_video_seconds": exercise_start,
                    "correlation": corr,
                    "quality": quality,
                    "video_overlap_fraction": overlap_video,
                    "sensor_overlap_fraction": overlap_sensor,
                }

    if best is None or best["quality"] < 0.35:
        best = {
            "scale_seconds_per_video_second": nominal,
            "offset_seconds": -fit_t[0] * nominal,
            "calibration_start_video_seconds": calibration_start,
            "calibration_end_video_seconds": calibration_end,
            "calibration_peak_shoulder_raise_degrees": calibration_peak,
            "exercise_start_video_seconds": exercise_start,
            "correlation": best["correlation"] if best else None,
            "quality": best["quality"] if best else 0.0,
            "video_overlap_fraction": 1.0,
            "sensor_overlap_fraction": 1.0,
        }
        method = "yolo-calibration-and-motion-duration"
    else:
        method = "yolo-pose-correlation"
    best["method"] = method
    best["sensor_duration_seconds"] = sensor_duration
    best["quality"] = round(best["quality"], 4)
    if best["correlation"] is not None:
        best["correlation"] = round(best["correlation"], 4)
    best["video_overlap_fraction"] = round(best["video_overlap_fraction"], 4)
    best["sensor_overlap_fraction"] = round(best["sensor_overlap_fraction"], 4)
    best["scale_seconds_per_video_second"] = round(best["scale_seconds_per_video_second"], 6)
    best["offset_seconds"] = round(best["offset_seconds"], 3)
    return best


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default="yolo11n-pose.pt", help="Ultralytics YOLO pose weights")
    parser.add_argument("--sample-hz", type=float, default=5.0, help="Video pose sampling rate")
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--device", default=None, help="Inference device, for example cpu or mps")
    args = parser.parse_args()

    cache = Path.home() / ".cache" / "formguard-yolo"
    cache.mkdir(parents=True, exist_ok=True)
    previous_dir = Path.cwd()
    try:
        os.chdir(cache)
        model = YOLO(args.model)
    finally:
        os.chdir(previous_dir)

    output = {"model": Path(args.model).name, "sessions": {}}
    for key, pairing in PAIRINGS.items():
        recording = json.loads(pairing["recording"].read_text())
        frames = recording["derived"]["frames"]
        columns = recording["derived"]["columns"]
        elbow_col = columns.index("elbow")
        host_col = columns.index("host_ms")
        sensor_t = np.asarray([(frame[host_col] - frames[0][host_col]) / 1000 for frame in frames], dtype=float)
        sensor_angle = np.asarray([frame[elbow_col] for frame in frames], dtype=float)

        pose_t, pose_angle, raise_angle, pose_info = get_video_pose(model, pairing["video"], args.sample_hz, args.imgsz, args.device)
        mapping = align(pose_t, pose_angle, raise_angle, sensor_t, sensor_angle)
        refine_seconds = pairing.get("refine_curl_seconds")
        if refine_seconds is not None:
            precise_t, precise_angle, precise_raise, precise_info = get_video_pose(
                model, pairing["video"], pose_info["fps"], args.imgsz, args.device, max_seconds=refine_seconds
            )
            cal_start, cal_end, cal_peak = detect_calibration(precise_t, precise_angle, precise_raise)
            cycle_starts = detect_curl_cycle_starts(precise_t, precise_angle, cal_end)
            if len(cycle_starts) < 3:
                raise RuntimeError(f"Could not locate three curl starts in {pairing['video'].name}")
            precise_curl_start = cycle_starts[0]
            third_curl_start = cycle_starts[2]
            mapping["calibration_start_video_seconds"] = cal_start
            mapping["calibration_end_video_seconds"] = cal_end
            mapping["calibration_peak_shoulder_raise_degrees"] = cal_peak
            mapping["exercise_start_video_seconds"] = third_curl_start
            mapping["first_curl_start_video_seconds"] = precise_curl_start
            mapping["third_curl_start_video_seconds"] = third_curl_start
            mapping["playback_start_video_seconds"] = third_curl_start
            mapping["first_three_curl_starts_video_seconds"] = cycle_starts[:3]
            pose_info["first_curl_refinement_fps"] = precise_info["fps"]
            pose_info["first_curl_refinement_frame_interval_ms"] = round(1000 / precise_info["fps"], 3)
            pose_info["first_curl_refinement_sampled_frames"] = precise_info["sampled_frames"]
        anchor_sensor = pairing.get("anchor_sensor_seconds")
        if anchor_sensor is not None:
            fitted_offset = mapping["offset_seconds"]
            mapping["offset_seconds"] = round(anchor_sensor - mapping["scale_seconds_per_video_second"] * mapping["exercise_start_video_seconds"], 6)
            mapping["manual_offset_adjustment_seconds"] = round(mapping["offset_seconds"] - fitted_offset, 3)
            mapping["alignment_anchor"] = "third curl to first IMU sample"
        output["sessions"][key] = {
            "video": pairing["video"].name,
            "recording": pairing["recording"].name,
            "pose": pose_info,
            **mapping,
        }
        corr = mapping["correlation"]
        print(f"{key}: {mapping['method']} · corr={corr} · scale={mapping['scale_seconds_per_video_second']}s/s · offset={mapping['offset_seconds']}s")

    OUTPUT.write_text(json.dumps(output, indent=2) + "\n")
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
