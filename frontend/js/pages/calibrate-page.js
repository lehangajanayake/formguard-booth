// Page 2: show the calibration pose on the 3D arm, connect the sensors, then calibrate.
import { setMarkersVisible, setMarkerState, MARKER_IDS } from '../model/sensor-markers.js';
import { SensorLink } from '../sensor/ble-link.js';
import { batteryIconHtml, renderBatteries } from '../ui/battery-icon.js';
import { collectPackets } from '../record/recorder.js';
import { RAISE_MIN_DEG } from '../sensor/arm-estimator.js';
import { $ } from '../ui/dom.js';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const RAISE_DONE_DEG = 15;        // after reaching RAISE_MIN_DEG, the raise is over once the arm is back below this
const RAISE_TIMEOUT_MS = 12000;

/** @param {{stage, model, labels, state, router, rig, cfg, setArmSide}} ctx */
export function createCalibratePage({ stage, model, labels, state, router, rig: currentRig, cfg, setArmSide }) {
  let root = null, rig = null;
  let running = false, cancelled = false, advanceTimer = 0;
  let raising = null;   // {tilt, max} while waiting for the arm raise
  let stopRaise = null;
  let message = null;   // { text, tone } shown under the sensors, e.g. after a failed calibration
  let hadData = [];     // per slot: data has arrived since connecting
  const cleanups = [];

  function slotStatus(slot, i) {
    const name = rig.slots.length > 1 && slot.name ? ` (${slot.name})` : '';
    if (slot.link.connecting) return { text: `${slot.label}: connecting…`, tone: 'wait' };
    if (!slot.link.connected && slot.link.asleep) return { text: `${slot.label}: asleep. Double-tap it to wake, then Connect`, tone: 'off' };
    if (!slot.link.connected) return { text: `${slot.label}: not connected${name}`, tone: 'off' };
    if (!hadData[i]) return { text: `${slot.label}: connected, waiting for data`, tone: 'wait' };
    return { text: `${slot.label}: ${slot.link.rateHz} Hz`, tone: 'live' };
  }

  function status() {
    if (message) return message;
    if (raising) {
      const deg = `${Math.round(raising.tilt)}°`;
      return raising.max < RAISE_MIN_DEG
        ? { text: `Now keep the arm straight and raise it out in front of you, to shoulder height (${deg})`, tone: 'wait' }
        : { text: `Good. Now lower it back to your side (${deg})`, tone: 'wait' };
    }
    if (running) return { text: 'Calibrating: hold the pose', tone: 'wait' };
    if (rig.connected && hadData.every(Boolean)) return { text: 'Ready. Hold the pose, then press Calibrate', tone: 'live' };
    return null;   // the sensor rows say what is missing
  }

  function refresh() {
    rig.slots.forEach((slot, i) => {
      const s = slotStatus(slot, i);
      $(`#cal-dot-${i}`, root).dataset.s = s.tone;
      $(`#cal-text-${i}`, root).textContent = s.text;
      renderBatteries($(`#cal-batt-${i}`, root), batteryIconHtml(slot.link.connected ? slot.link.battery : null));
      const connect = $(`#cal-connect-${i}`, root);
      connect.textContent = slot.link.connected ? 'Disconnect' : 'Connect';
      connect.disabled = slot.link.connecting || running;
      const sleep = $(`#cal-sleep-${i}`, root);
      sleep.hidden = !slot.link.connected;
      sleep.disabled = running;
    });
    const s = status();
    $('#cal-status', root).hidden = !s;
    if (s) { $('#cal-dot', root).dataset.s = s.tone; $('#cal-text', root).textContent = s.text; }
    $('#cal-start', root).disabled = !(rig.connected && hadData.every(Boolean)) || running;
    $('#cal-back', root).disabled = running;
    root.querySelectorAll('[data-arm]').forEach(btn => {
      btn.setAttribute('aria-pressed', String(btn.dataset.arm === state.arm));
      btn.disabled = running;
    });
  }

  function chooseArm(side) {
    if (running || side === state.arm) return;
    state.arm = side; state.calibrated = false;
    setArmSide(side);
    refresh();
  }

  /** Waits for the arm to go up and come back down, feeding the samples to the estimator. Resolves with the raw packets. */
  async function recordRaise() {
    const { estimator } = rig;
    estimator.beginRaise();
    raising = { tilt: 0, max: 0 };
    const raw = collectPackets(rig.slots), startHostMs = performance.now();
    refresh();
    await new Promise(resolve => {
      const timer = setTimeout(() => stopRaise(), RAISE_TIMEOUT_MS);
      const off = rig.on('sample', s => {
        const tilt = estimator.addRaiseSample(s);
        raising.tilt = tilt; raising.max = Math.max(raising.max, tilt);
        if (raising.max >= RAISE_MIN_DEG && tilt < RAISE_DONE_DEG) stopRaise();
        else refresh();
      });
      stopRaise = () => { clearTimeout(timer); off(); stopRaise = null; resolve(); };
    });
    raw.stop(); raising = null;
    return { start_host_ms: startHostMs, end_host_ms: performance.now(), packets: raw.packets };
  }

  async function connectClicked(slot) {
    message = null;
    if (slot.link.connected) { slot.link.disconnect(); return; }
    try { await rig.connect(slot); }
    catch (e) { message = { text: e.message || 'Could not connect.', tone: 'err' }; }
    refresh();
  }

  async function sleepClicked(slot) {
    message = null;
    try { await slot.link.sendSleep(); }
    catch (e) { message = { text: 'Could not send the sleep command.', tone: 'err' }; }
    refresh();
  }

  async function runCalibration() {
    message = null; running = true; cancelled = false; state.calibrated = false; state.calibration = null; refresh();
    try {
      await rig.calibrateBoards(4000);   // the boards recalibrate themselves first; carry on if a signal is missed
    } catch (e) {
      running = false; message = { text: 'Could not send the calibrate command.', tone: 'err' }; refresh(); return;
    }
    if (cancelled) return;
    const { estimator } = rig;
    estimator.beginCalibration();
    const off = rig.on('sample', s => estimator.addSample(s));
    const raw = collectPackets(rig.slots), startHostMs = performance.now();
    await sleep(cfg.calibrationMs);
    off(); raw.stop();
    if (cancelled) return;

    let result = estimator.finishCalibration();
    const calibration = { arm: state.arm, start_host_ms: startHostMs, end_host_ms: performance.now(), packets: raw.packets, raise: null };
    if (result.ok && estimator.needsRaise) {
      calibration.raise = await recordRaise();
      if (cancelled) return;
      result = estimator.finishRaise(state.arm);
    }
    running = false;
    if (!result.ok) { message = { text: result.reason, tone: 'err' }; refresh(); return; }
    state.calibrated = true;
    state.calibration = calibration;
    message = { text: `Calibrated (${rig.slots.length > 1 ? '' : 'forearm axis '}${estimator.axisLabel})`, tone: 'live' };
    refresh();
    advanceTimer = setTimeout(() => router.go('live'), 800);
  }

  return {
    title: 'Calibrate',
    subtitle: 'Match the pose shown on the arm, then press Calibrate.',
    enter(el) {
      root = el; rig = currentRig(); message = null; running = false; raising = null;
      rig.releaseMismatched();
      hadData = rig.slots.map(s => s.link.msSincePacket() < cfg.staleMs);
      state.calibrated = false; rig.estimator.reset();
      const { setup } = rig;

      model.setCalibrationView(true);
      setMarkersVisible(setup.positions);
      for (const id of MARKER_IDS) setMarkerState(id, setup.positions.includes(id) ? 'selected' : 'idle');
      labels.show(setup.positions, setup.positions);
      stage.requestRender();

      root.innerHTML = `
        <h2>Calibration pose</h2>
        <p class="hint">${setup.label}: ${rig.slots.map(s => s.label.toLowerCase()).join(' + ')}.</p>
        <div class="seg" role="group" aria-label="Arm">
          <span class="lbl">Arm</span>
          <button type="button" data-arm="left" aria-pressed="false">Left</button>
          <button type="button" data-arm="right" aria-pressed="false">Right</button>
        </div>
        <ul class="steps">${setup.calibrationSteps.map(s => `<li>${s}</li>`).join('')}</ul>
        ${rig.slots.map((_, i) => `
          <div class="row">
            <span class="stat"><i id="cal-dot-${i}" data-s="off"></i><span id="cal-text-${i}"></span></span>
            <span class="batts" id="cal-batt-${i}"></span>
            <button type="button" class="fg-btn fg-btn-quiet" id="cal-sleep-${i}" hidden>Sleep</button>
            <button type="button" class="fg-btn fg-btn-quiet" id="cal-connect-${i}">Connect</button>
          </div>`).join('')}
        <p class="stat" id="cal-status" hidden><i id="cal-dot" data-s="off"></i><span id="cal-text"></span></p>
        ${SensorLink.supported ? '' : '<p class="note warn">Web Bluetooth is not available. Use Chrome or Edge, served from localhost or https.</p>'}
        <div class="row actions">
          <button type="button" class="fg-btn fg-btn-quiet" id="cal-back">Back</button>
          <button type="button" class="fg-btn fg-btn-primary" id="cal-start" disabled>Calibrate</button>
        </div>`;
      rig.slots.forEach((slot, i) => {
        $(`#cal-connect-${i}`, root).addEventListener('click', () => connectClicked(slot));
        $(`#cal-sleep-${i}`, root).addEventListener('click', () => sleepClicked(slot));
      });
      $('#cal-start', root).addEventListener('click', runCalibration);
      root.querySelectorAll('[data-arm]').forEach(btn => btn.addEventListener('click', () => chooseArm(btn.dataset.arm)));
      $('#cal-back', root).addEventListener('click', () => router.go('select'));

      rig.slots.forEach((slot, i) => {
        cleanups.push(slot.link.on('disconnected', () => { hadData[i] = false; refresh(); }));
        cleanups.push(slot.link.on('packet', () => { if (!hadData[i]) { hadData[i] = true; refresh(); } }));
      });
      for (const event of ['connecting', 'connected', 'stats', 'battery']) cleanups.push(rig.on(event, refresh));
      refresh();
    },
    leave() {
      cancelled = true; clearTimeout(advanceTimer);
      stopRaise?.(); raising = null;
      cleanups.splice(0).forEach(off => off());
      labels.hide();
    },
  };
}
