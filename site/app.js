const sessions = {
  clean: { file: 'formguard_upper+forearm_clean-nidula_20261021-081458.json', clip: 'clean-curl.mp4', insight: 'Controlled curl. The elbow angle rises and returns across the recorded set.', fault: false },
  swing: { file: 'formguard_upper+forearm_wong-swing-arm-nidula_20261021-081551.json', clip: 'elbow-swing.mp4', insight: 'Swinging arm. Upper arm movement rises as the curl progresses.', fault: true },
};

const $ = (query) => document.querySelector(query);
const video = $('#session-video');
const videoFrame = $('#sync-video-frame');
const sessionsReady = {};
const replayDuration = 15_000;
let syncInfo = { sessions: {} };
let selected = 'clean';
let progress = 0;
let playing = false;
let lastTick = 0;
let animation = 0;

function hasVideo() {
  return Boolean(sessions[selected].clip && video.getAttribute('src'));
}

function updateDownload() {
  const link = $('#download-session');
  link.href = `recordings/${sessions[selected].file}`;
  link.download = sessions[selected].file;
}

function updateTransport() {
  $('#play-toggle').textContent = playing ? 'Ⅱ' : '▶';
  $('#play-toggle').setAttribute('aria-label', playing ? 'Pause replay' : 'Play replay');
  $('#play-state').textContent = playing
    ? (hasVideo() ? 'VIDEO + DATA PLAYING' : 'PLAYING RECORDED DATA')
    : (hasVideo() ? 'VIDEO + DATA PAUSED' : 'RECORDED DATA PAUSED');
}

function sensorSecondsAtVideoTime() {
  const data = sessionsReady[selected];
  if (!data || !Number.isFinite(video.duration) || video.duration <= 0) return null;
  const columns = data.derived.columns;
  const frames = data.derived.frames;
  const hostCol = columns.indexOf('host_ms');
  const sensorDuration = (frames.at(-1)[hostCol] - frames[0][hostCol]) / 1000;
  const alignment = syncInfo.sessions[selected];
  return alignment
    ? video.currentTime * alignment.scale_seconds_per_video_second + alignment.offset_seconds
    : video.currentTime / video.duration * sensorDuration;
}

function playbackStartTime() {
  return syncInfo.sessions[selected]?.playback_start_video_seconds || 0;
}

function progressAtVideoTime() {
  const data = sessionsReady[selected];
  if (!data) return 0;
  const seconds = sensorSecondsAtVideoTime();
  const hostColumn = data.derived.columns.indexOf('host_ms');
  const duration = (data.derived.frames.at(-1)[hostColumn] - data.derived.frames[0][hostColumn]) / 1000;
  return Math.max(0, Math.min(1, (seconds || 0) / duration));
}

function frameAtSensorTime(data, sensorSeconds) {
  const frames = data.derived.frames;
  const hostColumn = data.derived.columns.indexOf('host_ms');
  const target = frames[0][hostColumn] + sensorSeconds * 1000;
  let lo = 0, hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid][hostColumn] < target) lo = mid + 1;
    else hi = mid;
  }
  const right = frames[lo];
  if (lo === 0) return right;
  const left = frames[lo - 1];
  const span = right[hostColumn] - left[hostColumn];
  const mix = span > 0 ? Math.max(0, Math.min(1, (target - left[hostColumn]) / span)) : 0;
  return data.derived.columns.map((name, index) => {
    const a = left[index], b = right[index];
    return typeof a === 'number' && typeof b === 'number' ? a + (b - a) * mix : (mix < 0.5 ? a : b);
  });
}

function draw() {
  const data = sessionsReady[selected];
  if (!data) return;
  const frames = data.derived.frames;
  let frame;
  if (hasVideo()) {
    const sensorSeconds = sensorSecondsAtVideoTime();
    frame = frameAtSensorTime(data, sensorSeconds ?? 0);
  } else {
    const frameIndex = Math.min(frames.length - 1, Math.floor(progress * (frames.length - 1)));
    frame = frames[frameIndex] || [];
  }
  const column = (name) => data.derived.columns.indexOf(name);
  const reading = (name) => frame[column(name)];
  const angle = Math.max(0, Math.min(145, Math.round(Number(reading('elbow')) || 0)));
  $('#hero-angle').textContent = `${angle}°`;
  const sensorSeconds = hasVideo() ? sensorSecondsAtVideoTime() : progress * ((frames.at(-1)[column('host_ms')] - frames[0][column('host_ms')]) / 1000);
  const repEvents = (data.derived.rep_events || []).filter(event => event.host_ms <= frames[0][column('host_ms')] + (sensorSeconds || 0) * 1000);
  const completedReps = repEvents.filter(event => event.type === 'rep').map(event => ({ bottom: event.rep.bottomDeg, peak: event.rep.peakDeg }));
  const currentRep = repEvents.at(-1)?.rep;
  const fault = currentRep?.faults?.includes('elbow_swing') ? 'Elbow swing'
    : currentRep?.faults?.includes('partial_rep') ? 'Partial rep' : '';
  $('#live-replay')?.contentWindow?.postMessage({
    type: 'formguard-replay-sample',
    elbow: reading('elbow'),
    upper: reading('upper_tilt'),
    forward: reading('upper_forward'),
    out: reading('upper_out'),
    repCount: reading('rep_count'),
    phase: reading('rep_phase'),
    completedReps,
    fault,
    swing: currentRep?.swingDeg,
    currentRep: currentRep?.index,
    repPeak: currentRep?.peakDeg,
    status: hasVideo() ? 'Recorded sensor data' : 'Recorded sensor data · no matching video',
  }, '*');

  if (hasVideo()) {
    const alignment = syncInfo.sessions[selected];
    const sensorSeconds = sensorSecondsAtVideoTime();
    const hostCol = data.derived.columns.indexOf('host_ms');
    const sensorDuration = (frames.at(-1)[hostCol] - frames[0][hostCol]) / 1000;
    if (sensorSeconds < 0) {
      $('#sync-label').textContent = video.currentTime <= (alignment?.calibration_end_video_seconds || 0)
        ? 'CALIBRATION / IMU STAYS STILL'
        : 'WAITING FOR IMU DATA';
    } else if (sensorSeconds > sensorDuration) {
      $('#sync-label').textContent = 'NO MATCHING IMU DATA';
    } else {
      $('#sync-label').textContent = alignment?.quality < 0.6 ? 'VIDEO + SENSOR / REVIEW' : 'VIDEO + SENSOR SYNCED';
    }
  }

  const elapsed = hasVideo() ? Math.max(0, video.currentTime - playbackStartTime()) : progress * replayDuration / 1000;
  $('#play-time').textContent = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(Math.floor(elapsed % 60)).padStart(2, '0')}`;
  updateTransport();
}

function requestAnimation() {
  cancelAnimationFrame(animation);
  if (playing) animation = requestAnimationFrame(animate);
}

function animate(time) {
  if (!playing) return;
  if (hasVideo() && Number.isFinite(video.duration) && video.duration > 0) {
    // The video is the clock; the stored alignment maps its time to the sensor timeline.
    progress = progressAtVideoTime();
  } else if (lastTick) {
    progress = (progress + (time - lastTick) / replayDuration) % 1;
  }
  lastTick = time;
  draw();
  animation = requestAnimationFrame(animate);
}

function setVideoForSession() {
  video.pause();
  playing = false;
  lastTick = 0;
  progress = 0;
  video.removeAttribute('src');
  video.load();
  videoFrame.classList.remove('has-video', 'video-error');

  const clip = sessions[selected].clip;
  video.muted = true;
  video.defaultMuted = true;
  video.volume = 0;
  if (clip) {
    video.src = `media/${clip}`;
    videoFrame.classList.add('has-video');
    $('#video-state').textContent = selected === 'clean' ? 'CLEAN CURL / VIDEO + DATA' : 'ELBOW SWING / VIDEO + DATA';
    const alignment = syncInfo.sessions[selected];
    $('#sync-label').textContent = alignment
      ? (alignment.quality < 0.6 ? 'VIDEO + SENSOR / REVIEW' : 'VIDEO + SENSOR SYNCED')
      : 'VIDEO + SENSOR SYNC';
    video.load();
  } else {
    $('#video-state').textContent = 'NO VIDEO / DATA REPLAY';
    $('#sync-label').textContent = 'DATA-ONLY SESSION';
  }
  draw();
}

document.querySelectorAll('.session').forEach((button) => {
  button.addEventListener('click', () => {
    selected = button.dataset.session;
    document.querySelectorAll('.session').forEach((item) => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-selected', String(active));
    });
    setVideoForSession();
    updateDownload();
    draw();
  });
});

$('#play-toggle').addEventListener('click', () => {
  if (hasVideo()) {
    if (video.paused) video.play().catch(() => {
      $('#play-state').textContent = 'USE VIDEO CONTROLS TO PLAY';
    });
    else video.pause();
    return;
  }
  playing = !playing;
  lastTick = 0;
  requestAnimation();
  draw();
});

video.addEventListener('play', () => {
  video.muted = true;
  video.volume = 0;
  playing = true;
  lastTick = 0;
  requestAnimation();
  draw();
});
video.addEventListener('pause', () => {
  playing = false;
  progress = progressAtVideoTime();
  requestAnimation();
  draw();
});
video.addEventListener('timeupdate', () => {
  if (video.currentTime < playbackStartTime() - 0.02) {
    video.currentTime = playbackStartTime();
    return;
  }
  progress = progressAtVideoTime();
  draw();
});
video.addEventListener('seeking', () => {
  if (video.currentTime < playbackStartTime() - 0.02) {
    video.currentTime = playbackStartTime();
    return;
  }
  progress = progressAtVideoTime();
  draw();
});
video.addEventListener('ended', () => {
  playing = false;
  progress = 1;
  requestAnimation();
  draw();
});
video.addEventListener('error', () => {
  videoFrame.classList.remove('has-video');
  videoFrame.classList.add('video-error');
  $('#video-state').textContent = 'VIDEO COULD NOT BE LOADED';
  $('#sync-label').textContent = 'VIDEO UNAVAILABLE';
  playing = false;
  draw();
});
video.addEventListener('loadedmetadata', () => {
  if (video.currentTime < playbackStartTime()) video.currentTime = playbackStartTime();
  draw();
});
$('#live-replay').addEventListener('load', draw);
video.addEventListener('volumechange', () => {
  if (!video.muted || video.volume !== 0) {
    video.muted = true;
    video.volume = 0;
  }
});

function formatClock(seconds) {
  const value = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

async function init() {
  const syncPromise = fetch('sync.json').then((response) => response.ok ? response.json() : null).catch(() => null);
  await Promise.all(Object.entries(sessions).map(async ([key, session]) => {
    const response = await fetch(`recordings/${session.file}`);
    if (!response.ok) throw new Error(`Unable to load ${session.file}`);
    sessionsReady[key] = await response.json();
  }));
  syncInfo = await syncPromise || { sessions: {} };
  setVideoForSession();
  updateDownload();
  draw();
}

init().catch((error) => {
  console.error(error);
  $('#play-state').textContent = 'RECORDINGS NOT LOADED';
  $('#sync-label').textContent = 'SESSION DATA UNAVAILABLE';
});
